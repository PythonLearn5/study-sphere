import Groq from "groq-sdk";

/**
 * 统一 LLM Client 配置
 * -----------------------------------------------------------
 * 本项目默认使用 Groq，但为了兼容任何 OpenAI 兼容接口（Vercel AI Gateway、Cloudflare、
 * OneAPI、LM Studio、本地 Ollama 等），所有 AI 路由请从这里取 client 和模型名。
 *
 * 环境变量优先级：
 *   - LLM_BASE_URL   —— 自定义 OpenAI 兼容端点（例如 Vercel AI Gateway: "https://sdk.vercel.ai/v1"）
 *                    留空则回退到 Groq 官方: "https://api.groq.com/openai/v1"
 *   - LLM_API_KEY  —— 如果配置了 LLM_BASE_URL 时优先使用；否则用 GROQ_API_KEY
 *   - LLM_MODEL_CHAT / LLM_MODEL_FAST / LLM_MODEL_SMART —— 各场景模型名
 *   - DISABLE_GROQ / DISABLE_LLM —— 任意一个 =true 则完全不走真实 LLM（走 mock）
 * -----------------------------------------------------------
 */

const DISABLED =
  process.env.DISABLE_GROQ === "true" || process.env.DISABLE_LLM === "true";

const BASE_URL =
  process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || undefined;

let API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY;
// LLM_BASE_URL 没配时，回退到 Groq 官方 key/endpoint
if (!BASE_URL) {
  API_KEY = API_KEY || process.env.GROQ_API_KEY;
}

const DEFAULT_BASE_URL_FOR_GROQ = "https://api.groq.com/openai/v1";

function createClient(): Groq | null {
  if (DISABLED || !API_KEY) return null;
  return new Groq({
    apiKey: API_KEY,
    baseURL: BASE_URL || DEFAULT_BASE_URL_FOR_GROQ,
  });
}

export const llmClient: Groq | null = createClient();

/**
 * 不同场景的默认模型名。
 *  - 用 Vercel AI Gateway 时，推荐写成 "provider:model"，例如 openai:gpt-4o-mini 或 groq:llama-3.1-8b-instant
 *  - 用任何通用 OpenAI 兼容接口（中转、OneAPI、Ollama、直接 Groq 官方等），写成纯模型名即可：
 *        常用通用模型：gpt-4o-mini  /  gpt-3.5-turbo  /  qwen-plus  /  deepseek-chat  等
 *  - 可以 5 个场景都用同一个模型，最省事。
 */
export const LLM_MODELS = {
  /** 聊天（CopilotKit 主聊天） */
  chat: process.env.LLM_MODEL_CHAT || process.env.OPENAI_MODEL || "gpt-4o-mini",
  /** 快速响应（闪卡讲解、流程图等） */
  fast: process.env.LLM_MODEL_FAST || "gpt-4o-mini",
  /** 复杂任务（闪卡生成、JSON 输出） */
  smart: process.env.LLM_MODEL_SMART || "gpt-3.5-turbo",
  /** 流程图生成 */
  flowchart: process.env.LLM_MODEL_FLOWCHART || "gpt-4o-mini",
  /** 测验生成 */
  quiz: process.env.LLM_MODEL_QUIZ || "gpt-3.5-turbo",
} as const;

export const LLM_DISABLED = DISABLED;
export const LLM_BASE_URL_USED = BASE_URL || DEFAULT_BASE_URL_FOR_GROQ;

if (typeof window === "undefined") {
  if (DISABLED) {
    console.warn("[llm] DISABLE_GROQ/DISABLE_LLM=true，所有 AI 路由将走 mock 回复。");
  } else if (!llmClient) {
    console.warn("[llm] 未配置 LLM_API_KEY 或 GROQ_API_KEY，AI 路由将走 mock 回复。");
  } else {
    console.info(
      `[llm] 使用 BaseURL = ${LLM_BASE_URL_USED}，默认 chat 模型 = ${LLM_MODELS.chat}`,
    );
  }
}
