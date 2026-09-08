/**
 * 统一 LLM 调用层（通过 Vercel AI Gateway，使用原生 Fetch）
 *
 * 设计说明：
 * - 统一使用原生 fetch 调用 OpenAI 兼容协议，确保路径精确控制。
 * - LLM_BASE_URL 里写什么前缀，我们就用什么（不额外拼接），完全可控。
 * - 所有场景都走统一的 runChatCompletionJSON / runChatCompletionStream 接口。
 */

// ============ 环境变量解析 ============
const RAW_BASE_URL = process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || "";
const VERCEL_AI_GATEWAY_BASE = "https://ai-gateway.vercel.sh/v1";

function normalizeBaseURL(raw: string): string {
  let url = raw.trim();
  if (!url) return "";
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'")) ||
    (url.startsWith("`") && url.endsWith("`"))
  ) {
    url = url.slice(1, -1).trim();
  }
  return url.replace(/\/+$/, "");
}

const NORMALIZED_BASE = normalizeBaseURL(RAW_BASE_URL);
export const LLM_BASE_URL_USED = NORMALIZED_BASE || VERCEL_AI_GATEWAY_BASE;

let API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
if (
  (API_KEY.startsWith('"') && API_KEY.endsWith('"')) ||
  (API_KEY.startsWith("'") && API_KEY.endsWith("'")) ||
  (API_KEY.startsWith("`") && API_KEY.endsWith("`"))
) {
  API_KEY = API_KEY.slice(1, -1).trim();
}
export const LLM_API_KEY_SET = !!API_KEY;

// ============ 旧接口兼容（现在永远为 null，保留仅避免 import 报错） ============
export const llmClient: null = null;

// ============ 模型名（Vercel Gateway 必须是 provider/model 格式） ============
export const LLM_MODELS = {
  chat: process.env.LLM_MODEL_CHAT || process.env.OPENAI_MODEL || "openai/gpt-4o-mini",
  fast: process.env.LLM_MODEL_FAST || "openai/gpt-4o-mini",
  smart: process.env.LLM_MODEL_SMART || "openai/gpt-3.5-turbo",
  flowchart: process.env.LLM_MODEL_FLOWCHART || "openai/gpt-4o-mini",
  quiz: process.env.LLM_MODEL_QUIZ || "openai/gpt-3.5-turbo",
} as const;

// ============ 共享类型 ============
export type ChatRole = "system" | "user" | "assistant";
export interface ChatMessage {
  role: ChatRole;
  content: string;
}
export interface ChatCompletionParams {
  messages: ChatMessage[];
  model: string;
  temperature?: number;
  max_tokens?: number;
  response_format?: { type?: "json_object" | "text" };
  stream?: boolean;
}
export interface LLMError extends Error {
  status?: number;
  statusCode?: number;
  cause?: unknown;
  responseBody?: unknown;
}

// ============ 非流式统一入口（Flashcard / Quiz / Flowchart / Explain 都用它） ============
export async function runChatCompletionJSON(
  params: ChatCompletionParams,
): Promise<{ content: string }> {
  if (!LLM_API_KEY_SET) {
    const err: LLMError = new Error(
      "未配置 API Key（需要 LLM_API_KEY 或 OPENAI_API_KEY，推荐使用 Vercel AI Gateway 的 vck_ 开头密钥）。" +
        `当前 BaseURL=${LLM_BASE_URL_USED}`,
    );
    err.status = 503;
    throw err;
  }

  const url = `${LLM_BASE_URL_USED}/chat/completions`;
  const bodyObj: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    stream: false,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens ?? 2048,
  };
  if (params.response_format?.type) bodyObj.response_format = params.response_format;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${API_KEY}`,
    },
    body: JSON.stringify(bodyObj),
  });

  const rawText = await res.text();
  if (!res.ok) {
    let message = `HTTP ${res.status} ${res.statusText}`;
    let parsedBody: unknown = rawText;
    try {
      parsedBody = JSON.parse(rawText);
      const asErr = parsedBody as { error?: { message?: string }; message?: string };
      if (asErr?.error?.message) message = asErr.error.message;
      else if (asErr?.message) message = asErr.message;
    } catch {
      /* 不处理 parse 失败，保留原始文本 */
    }
    const err: LLMError = new Error(message);
    err.status = res.status;
    err.statusCode = res.status;
    err.responseBody = parsedBody;
    throw err;
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawText);
  } catch (e) {
    const err: LLMError = new Error("AI 返回不是合法 JSON：" + rawText.slice(0, 500));
    err.status = 502;
    throw err;
  }
  const content: string = parsed?.choices?.[0]?.message?.content ?? "";
  return { content };
}

// ============ 流式统一入口（chat SSE 页面 & CopilotKit Adapter 可能用到） ============
export interface StreamTokenEvent {
  delta: string;
  done: boolean;
  finalFullContent?: string;
}

function parseSSELinesIntoDeltas(rawChunk: string): { leftover: string; deltas: string[]; done: boolean } {
  const deltas: string[] = [];
  let done = false;
  const parts = rawChunk.split(/\r?\n\r?\n/);
  const leftover = parts.pop() || "";
  for (const event of parts) {
    const lines = event.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line.startsWith("data:")) continue;
      const data = line.slice(5).trim();
      if (!data) continue;
      if (data === "[DONE]") {
        done = true;
        continue;
      }
      try {
        const obj = JSON.parse(data);
        const delta: string = obj?.choices?.[0]?.delta?.content ?? "";
        if (delta) deltas.push(delta);
      } catch {
        // 忽略非法单帧
      }
    }
  }
  return { leftover, deltas, done };
}

/**
 * 调用 LLM 流式接口，通过回调逐步推送 token。
 */
export async function runChatCompletionStream(
  params: ChatCompletionParams,
  handlers: {
    onToken: (delta: string) => void | Promise<void>;
    onDone: (fullContent: string) => void | Promise<void>;
    onError: (err: LLMError) => void | Promise<void>;
    signal?: AbortSignal;
  },
): Promise<void> {
  if (!LLM_API_KEY_SET) {
    const err: LLMError = new Error(
      "未配置 API Key（需要 LLM_API_KEY 或 OPENAI_API_KEY，推荐使用 Vercel AI Gateway 的 vck_ 开头密钥）。" +
        `当前 BaseURL=${LLM_BASE_URL_USED}`,
    );
    err.status = 503;
    await handlers.onError(err);
    return;
  }

  const url = `${LLM_BASE_URL_USED}/chat/completions`;
  const bodyObj: Record<string, unknown> = {
    model: params.model,
    messages: params.messages,
    stream: true,
    temperature: params.temperature ?? 0.7,
    max_tokens: params.max_tokens ?? 2048,
  };
  if (params.response_format?.type) bodyObj.response_format = params.response_format;

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${API_KEY}`,
        Accept: "text/event-stream",
      },
      body: JSON.stringify(bodyObj),
      signal: handlers.signal,
    });
  } catch (e: any) {
    const err: LLMError = e;
    if (e?.name === "AbortError") {
      await handlers.onError(e);
      return;
    }
    if (!err.status) err.status = 502;
    err.cause = e;
    await handlers.onError(err);
    return;
  }

  if (!res.ok || !res.body) {
    let rawText = "";
    try {
      rawText = await res.text();
    } catch {
      /* ignore */
    }
    let message = `HTTP ${res.status} ${res.statusText}`;
    let parsedBody: unknown = rawText;
    try {
      parsedBody = JSON.parse(rawText);
      const asErr = parsedBody as { error?: { message?: string }; message?: string };
      if (asErr?.error?.message) message = asErr.error.message;
      else if (asErr?.message) message = asErr.message;
    } catch {
      /* ignore */
    }
    const err: LLMError = new Error(message);
    err.status = res.status;
    err.statusCode = res.status;
    err.responseBody = parsedBody;
    await handlers.onError(err);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let full = "";
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = parseSSELinesIntoDeltas(buffer);
      buffer = parsed.leftover;
      for (const delta of parsed.deltas) {
        full += delta;
        await handlers.onToken(delta);
      }
      if (parsed.done) break;
    }
    if (buffer) {
      const parsed = parseSSELinesIntoDeltas(buffer + "\n\n");
      for (const delta of parsed.deltas) {
        full += delta;
        await handlers.onToken(delta);
      }
    }
    await handlers.onDone(full);
  } catch (e: any) {
    const err: LLMError = e;
    if (e?.name === "AbortError") {
      await handlers.onError(e);
      return;
    }
    if (!err.status) err.status = 500;
    await handlers.onError(err);
  } finally {
    try {
      reader.releaseLock();
    } catch {
      /* ignore */
    }
  }
}

// ============ 启动打印 ============
if (typeof window === "undefined") {
  if (!LLM_API_KEY_SET) {
    console.warn(
      "[llm] ⚠️ 未配置 API Key（需要 LLM_API_KEY / OPENAI_API_KEY，推荐 Vercel AI Gateway vck_ 开头密钥）。" +
        `BaseURL=${LLM_BASE_URL_USED}`,
    );
  } else {
    console.info(
      `[llm] ✅ 已初始化。BaseURL=${LLM_BASE_URL_USED}，` +
        `chat 模型=${LLM_MODELS.chat}，smart 模型=${LLM_MODELS.smart}`,
    );
  }
}
