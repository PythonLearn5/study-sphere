import Groq from "groq-sdk";

/**
 * 统一 LLM 调用层（自定义 BaseURL 用原生 Fetch，Groq 官方直连用 SDK）
 *
 * 关键修复：
 * - groq-sdk 即使给自定义 baseURL，内部也会强制加 /openai/v1 前缀，
 *   导致 Vercel AI Gateway / 自建 OpenAI 中转的路径拼错（出现 /v1/openai/v1/... 双层 /v1）。
 * - 自定义 BaseURL 的场景我们直接用原生 fetch，最终请求 URL 是:
 *     `${NORMALIZED_BASE_URL}/chat/completions`
 *   即：用户在 LLM_BASE_URL 里写什么前缀，我们就用什么（不额外拼接），完全可控。
 * - Groq 官方直连（LLM_BASE_URL 为空）的场景仍然走 SDK，以获得更好的错误处理/流式封装。
 */

// ============ 环境变量解析 ============
const RAW_BASE_URL = process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || "";
const GROQ_OFFICIAL_BASE = "https://api.groq.com/openai/v1";

const USING_CUSTOM_BASE = !!RAW_BASE_URL;

function normalizeBaseURL(raw: string): string {
  let url = raw.trim();
  if (!url) return "";
  // 去掉用户可能多余地包的引号/反引号（避免 .env.local 手滑写错）
  if (
    (url.startsWith('"') && url.endsWith('"')) ||
    (url.startsWith("'") && url.endsWith("'")) ||
    (url.startsWith("`") && url.endsWith("`"))
  ) {
    url = url.slice(1, -1).trim();
  }
  // 去掉末尾斜杠，统一后续 /chat/completions 拼接
  return url.replace(/\/+$/, "");
}

/** 最终使用的 Base URL（不含 /chat/completions 后缀） */
export const LLM_BASE_URL_USED = USING_CUSTOM_BASE
  ? normalizeBaseURL(RAW_BASE_URL)
  : GROQ_OFFICIAL_BASE;

// 找到合适的 API Key：自定义 Base 先看 LLM/OPENAI 前缀，Groq 官方看 GROQ_API_KEY
let API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || "";
if (!USING_CUSTOM_BASE && !API_KEY) {
  API_KEY = process.env.GROQ_API_KEY || "";
}
if (
  (API_KEY.startsWith('"') && API_KEY.endsWith('"')) ||
  (API_KEY.startsWith("'") && API_KEY.endsWith("'")) ||
  (API_KEY.startsWith("`") && API_KEY.endsWith("`"))
) {
  API_KEY = API_KEY.slice(1, -1).trim();
}
export const LLM_API_KEY_SET = !!API_KEY;

// ============ Groq 官方直连 SDK（仅 LLM_BASE_URL 为空时启用） ============
function createGroqSdkClient(): Groq | null {
  if (USING_CUSTOM_BASE || !API_KEY) return null;
  return new Groq({ apiKey: API_KEY, baseURL: GROQ_OFFICIAL_BASE });
}
/** 旧接口兼容导出（仅 Groq 官方才非 null；自定义 Base 场景请用下面 run* 函数） */
export const llmClient: Groq | null = createGroqSdkClient();

// ============ 模型名（Vercel Gateway 必须是 provider:model 格式） ============
export const LLM_MODELS = {
  chat: process.env.LLM_MODEL_CHAT || process.env.OPENAI_MODEL || "groq:llama-3.1-8b-instant",
  fast: process.env.LLM_MODEL_FAST || "groq:llama-3.1-8b-instant",
  smart: process.env.LLM_MODEL_SMART || "groq:llama-3.3-70b-versatile",
  flowchart: process.env.LLM_MODEL_FLOWCHART || "groq:gemma2-9b-it",
  quiz: process.env.LLM_MODEL_QUIZ || "groq:llama3-8b-8192",
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
      "未配置 API Key（LLM_API_KEY / OPENAI_API_KEY / GROQ_API_KEY 至少填一个）。" +
        `当前 BaseURL=${LLM_BASE_URL_USED}`,
    );
    err.status = 503;
    throw err;
  }

  // Groq 官方直连分支：直接 SDK
  if (!USING_CUSTOM_BASE && llmClient) {
    const { stream: _s, ...rest } = params;
    const completion = await llmClient.chat.completions.create({
      ...rest,
      stream: false,
    } as any);
    const content = completion.choices?.[0]?.message?.content ?? "";
    return { content };
  }

  // 自定义 Base 分支：原生 fetch
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
 * （相比自己处理 fetch stream，所有场景都走同一个函数，避免 bug 分散。）
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
      "未配置 API Key（LLM_API_KEY / OPENAI_API_KEY / GROQ_API_KEY 至少填一个）。" +
        `当前 BaseURL=${LLM_BASE_URL_USED}`,
    );
    err.status = 503;
    await handlers.onError(err);
    return;
  }

  // 1) Groq 官方直连分支：SDK 原生 for-await
  if (!USING_CUSTOM_BASE && llmClient) {
    try {
      const streamRes = await llmClient.chat.completions.create({
        messages: params.messages,
        model: params.model,
        temperature: params.temperature ?? 0.7,
        max_tokens: params.max_tokens ?? 2048,
        stream: true,
      } as any);
      let full = "";
      for await (const part of streamRes as any) {
        if (handlers.signal?.aborted) break;
        const delta: string = part?.choices?.[0]?.delta?.content ?? "";
        if (delta) {
          full += delta;
          await handlers.onToken(delta);
        }
      }
      await handlers.onDone(full);
    } catch (e: any) {
      const err: LLMError = e;
      if (!err.status) err.status = e?.status || 500;
      await handlers.onError(err);
    }
    return;
  }

  // 2) 自定义 Base 分支：原生 fetch + ReadableStream 逐行解析
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
    // flush 最后一段 buffer
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
      "[llm] ⚠️ 未配置 API Key（需要 LLM_API_KEY/GROQ_API_KEY 至少一个）。" +
        `BaseURL=${LLM_BASE_URL_USED}，自定义 Base=${USING_CUSTOM_BASE}`,
    );
  } else {
    console.info(
      `[llm] ✅ 已初始化。BaseURL=${LLM_BASE_URL_USED}，自定义 Base=${USING_CUSTOM_BASE}，` +
        `chat 模型=${LLM_MODELS.chat}，smart 模型=${LLM_MODELS.smart}`,
    );
  }
}
