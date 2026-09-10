import { CopilotRuntime, createCopilotRuntimeHandler, BuiltInAgent } from "@copilotkit/runtime/v2"
import { createOpenAI } from "@ai-sdk/openai"

// ============ 环境变量读取 ============
const apiKey = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY || ""
const baseURL = process.env.LLM_BASE_URL || "https://ai-gateway.vercel.sh/v1"
const modelName = process.env.LLM_MODEL_CHAT || "openai/gpt-4o-mini"

// ============ 构建 OpenAI 兼容 provider（指向 Vercel AI Gateway）============
// BuiltInAgent 底层使用 Vercel AI SDK，通过 createOpenAI 可以自定义 baseURL，
// 支持任何 OpenAI 兼容端点（Vercel AI Gateway / OpenRouter / Ollama 等）。
const openai = createOpenAI({ apiKey, baseURL })

// ============ 创建 BuiltInAgent ============
// model 传入 AI SDK LanguageModel 实例（openai("openai/gpt-4o-mini")），
// Vercel AI Gateway 会根据 "openai/" 前缀路由到对应 provider。
const agent = new BuiltInAgent({
  model: openai(modelName),
})

// ============ 创建 CopilotRuntime ============
const runtime = new CopilotRuntime({
  agents: { default: agent },
})

// ============ 创建 HTTP handler ============
// createCopilotRuntimeHandler 返回一个同时处理 GET（握手/info）和 POST（聊天）的 handler。
// 路由放在 [[...slug]]/route.ts 下，自动处理 /api/copilotkit 及其子路径。
const handler = createCopilotRuntimeHandler({
  runtime,
  basePath: "/api/copilotkit",
})

export const GET = handler
export const POST = handler
