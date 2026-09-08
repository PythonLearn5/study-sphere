import {
  CopilotRuntime,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime"
import { AbstractAgent } from "@ag-ui/client"
import { NextRequest } from "next/server"
import {
  LLM_MODELS,
  LLM_BASE_URL_USED,
  LLM_API_KEY_SET,
  runChatCompletionJSON,
  runChatCompletionStream,
  type ChatCompletionParams,
  type LLMError,
} from "@/lib/llm"

/**
 * CopilotKit v1.9.x 的硬性要求：
 * ① 握手端点 GET /api/copilotkit/info 的 agents[] 必须至少包含 "default"
 * ② 后端 new CopilotRuntime({ agents }) 必须同步提供 { default: new DefaultAgent() }
 * ③ 如果不希望 v2 Agent runner 接管所有推理，
 *    就必须显式传 【 delegateAgentProcessingToServiceAdapter=true 】
 *    → 含义：v2 多 Agent 框架只做"路由 / 上下文管理"，实际 LLM 调用仍然走 ServiceAdapter
 */
class DefaultAgent extends AbstractAgent {
  constructor() {
    super({
      description:
        "默认学习助手（基于 Vercel AI Gateway 的 openai/gpt-4o-mini）。" +
        "擅长笔记、闪卡、流程图、测验的一般性学习问题。",
    })
  }
  override run(_input: any): any {
    throw new Error(
      "[DefaultAgent] 不应该走到这里：delegateAgentProcessingToServiceAdapter=true 时，" +
        "所有 LLM 调用都由 ServiceAdapter 处理。",
    )
  }
}

const AGENTS = {
  default: new DefaultAgent(),
} as const

const copilotKit = new CopilotRuntime({
  agents: AGENTS,
  delegateAgentProcessingToServiceAdapter: true,
})

// ============ Safe Adapter（调试日志 + 错误兜底，避免前端 isLoading 永远 true）============
function createSafeAdapter(baseAdapter: any, label: string) {
  return new Proxy(baseAdapter, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver)
      if (typeof original !== "function" || prop !== "process") return original
      return async function (...args: any[]) {
        const request: any = args[0] ?? {}
        const { eventSource, messages } = request
        try {
          const userCount = (messages || []).filter((m: any) => {
            const type = typeof m?._getType === "function" ? m._getType() : m?.role
            return type === "human" || type === "user"
          }).length
          console.log(
            `[CopilotKit ${label}] process start userMessages=${userCount} ` +
              `model=${LLM_MODELS.chat} baseURL=${LLM_BASE_URL_USED}`,
          )
          const result = await original.apply(target, args)
          console.log(`[CopilotKit ${label}] process done`)
          return result
        } catch (err: any) {
          console.error(`[CopilotKit ${label}] process error ⚠️ :`, {
            name: err?.name,
            message: err?.message,
            status: err?.status,
            statusCode: err?.statusCode,
            cause: err?.cause?.message ?? err?.cause?.toString?.() ?? undefined,
            body: (err as any)?.error || (err as any)?.message,
            stack: err?.stack?.split("\n").slice(0, 6).join("\n"),
          })
          try {
            if (eventSource && typeof eventSource.stream === "function") {
              eventSource.stream(async (es$: any) => {
                try {
                  const userMsg =
                    (err?.message || "Unknown Error") +
                    (err?.status ? ` (HTTP ${err.status})` : "")
                  es$.sendTextMessageStart()
                  es$.sendTextMessageContent(`❌ ${userMsg}`)
                  es$.sendTextMessageEnd()
                  es$.complete()
                } catch (e) {
                  // ignore
                }
              })
            }
          } catch (e) {
            // ignore
          }
          throw err
        }
      }
    },
  })
}

// ============ Fake OpenAI Client（不依赖任何 SDK，复用 llm.ts 统一接口）============
function makeFakeOpenAIClient() {
  return {
    chat: {
      completions: {
        create: async function (params: any) {
          const { stream = false, messages, model, temperature, max_tokens, response_format } =
            params as ChatCompletionParams & { stream?: boolean }

          const callParams: ChatCompletionParams = {
            messages: (messages ?? []).map((m: any) => ({
              role: (typeof m?._getType === "function"
                ? m._getType() === "human"
                  ? "user"
                  : m._getType() === "ai"
                    ? "assistant"
                    : "system"
                : (m.role as any)) ?? "user",
              content:
                typeof m?.getContent === "function" ? String(m.getContent()) : String(m.content ?? ""),
            })),
            model: model || LLM_MODELS.chat,
            temperature,
            max_tokens,
            response_format,
          }

          // ======== 非流式 ========
          if (!stream) {
            const { content } = await runChatCompletionJSON(callParams)
            return {
              id: "chatcmpl-" + Math.random().toString(36).slice(2, 12),
              object: "chat.completion",
              created: Math.floor(Date.now() / 1000),
              model: callParams.model,
              choices: [
                {
                  index: 0,
                  message: { role: "assistant", content },
                  finish_reason: "stop",
                },
              ],
              usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
            }
          }

          // ======== 流式：返回 AsyncGenerator ========
          type StreamChunk = { delta: string; done: boolean; err?: LLMError }
          const queue: StreamChunk[] = []
          let resolveNext: ((chunk: StreamChunk) => void) | null = null
          let streamFinished = false

          function pushChunk(chunk: StreamChunk) {
            if (resolveNext) {
              const r = resolveNext
              resolveNext = null
              r(chunk)
            } else {
              queue.push(chunk)
            }
          }

          runChatCompletionStream(callParams, {
            onToken: (delta) => {
              if (!delta) return
              pushChunk({ delta, done: false })
            },
            onDone: () => {
              streamFinished = true
              pushChunk({ delta: "", done: true })
            },
            onError: (err) => {
              streamFinished = true
              pushChunk({ delta: "", done: true, err })
            },
          })

          const asyncIterator: AsyncIterator<any> = {
            async next(): Promise<IteratorResult<any>> {
              if (queue.length) {
                const chunk = queue.shift()!
                if (chunk.err) throw chunk.err
                if (chunk.done) return { value: undefined as any, done: true }
                return {
                  value: {
                    id: "chatcmpl-stream",
                    object: "chat.completion.chunk",
                    created: Math.floor(Date.now() / 1000),
                    model: callParams.model,
                    choices: [{ index: 0, delta: { content: chunk.delta }, finish_reason: null }],
                  },
                  done: false,
                }
              }
              if (streamFinished) {
                return { value: undefined as any, done: true }
              }
              return await new Promise<IteratorResult<any>>((resolve, reject) => {
                resolveNext = (chunk) => {
                  if (chunk.err) {
                    reject(chunk.err)
                    return
                  }
                  if (chunk.done) {
                    resolve({ value: undefined as any, done: true })
                    return
                  }
                  resolve({
                    value: {
                      id: "chatcmpl-stream",
                      object: "chat.completion.chunk",
                      created: Math.floor(Date.now() / 1000),
                      model: callParams.model,
                      choices: [{ index: 0, delta: { content: chunk.delta }, finish_reason: null }],
                    },
                    done: false,
                  })
                }
              })
            },
          }

          const asyncIterable: any = {
            [Symbol.asyncIterator]() {
              return asyncIterator
            },
          }
          return asyncIterable
        },
      },
    },
  }
}

// ============ 构建 Service Adapter（统一使用 Fake OpenAI Client）============
function buildServiceAdapter(): any {
  if (!LLM_API_KEY_SET) {
    throw new Error(
      "[CopilotKit route] ❌ 未配置 API Key：请在 .env.local 配置 LLM_API_KEY 或 OPENAI_API_KEY，" +
        `推荐使用 Vercel AI Gateway 的 vck_ 开头密钥。当前 BaseURL=${LLM_BASE_URL_USED}`,
    )
  }

  const fakeClient = makeFakeOpenAIClient()
  const baseAdapter = new OpenAIAdapter({
    openai: fakeClient as unknown as import("openai").OpenAI,
    model: LLM_MODELS.chat,
  })
  return createSafeAdapter(baseAdapter, "OpenAIAdapter(Vercel-Gateway·FakeClient)")
}

let serviceAdapter: any
try {
  serviceAdapter = buildServiceAdapter()
  console.log(
    `[CopilotKit route] ✅ ServiceAdapter 构建完成：` +
      `baseURL=${LLM_BASE_URL_USED} model=${LLM_MODELS.chat}`,
  )
} catch (err: any) {
  console.error("[CopilotKit route] ❌ buildServiceAdapter failed:", err?.message || err)
  serviceAdapter = null
}

export const POST = async (req: NextRequest) => {
  if (!serviceAdapter) {
    return new Response(
      JSON.stringify({
        error: "LLM not configured",
        details:
          "未配置 LLM_API_KEY 或 OPENAI_API_KEY，或 .env.local 未生效（重启 dev 服务器；" +
          "如果是 Vercel Gateway 请确保 key 以 vck_ 开头，模型名是 provider/model 格式）。",
        baseURL: LLM_BASE_URL_USED,
        model: LLM_MODELS.chat,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    )
  }

  try {
    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime: copilotKit,
      serviceAdapter,
      endpoint: "/api/copilotkit",
    })
    return handleRequest(req)
  } catch (err: any) {
    console.error("[CopilotKit route] ❌ handleRequest error:", {
      name: err?.name,
      message: err?.message,
      status: err?.status,
      cause: err?.cause?.message ?? undefined,
    })
    return new Response(
      JSON.stringify({
        error: "CopilotKit runtime error",
        message: err?.message || "Unknown error",
        details: err?.cause?.message || undefined,
        baseURL: LLM_BASE_URL_USED,
        model: LLM_MODELS.chat,
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}
