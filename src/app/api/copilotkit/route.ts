import {
  CopilotRuntime,
  GroqAdapter,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime"
import { NextRequest } from "next/server"
import Groq from "groq-sdk"
import { LLM_MODELS, llmClient, LLM_BASE_URL_USED } from "@/lib/llm"

const copilotKit = new CopilotRuntime()

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
          // 确保 eventSource complete，避免前端 isLoading 永远 true 卡死
          try {
            if (eventSource && typeof eventSource.stream === "function") {
              eventSource.stream(async (es$: any) => {
                try {
                  es$.complete()
                } catch (e) {
                  // ignore
                }
              })
            }
          } catch (e) {
            // ignore
          }
          // 重新抛出真实错误，让 CopilotKit 前端能看到原始错误（含 status/message），方便你调 Vercel Gateway
          throw err
        }
      }
    },
  })
}

function buildServiceAdapter(): any {
  if (!llmClient) {
    throw new Error(
      "[CopilotKit route] ❌ llmClient 未初始化：请在 .env.local 配置 LLM_API_KEY 或 GROQ_API_KEY，" +
        `当前 BaseURL=${LLM_BASE_URL_USED}`,
    )
  }

  const usingCustomBase = !!process.env.LLM_BASE_URL || !!process.env.OPENAI_BASE_URL

  if (usingCustomBase) {
    const baseAdapter = new OpenAIAdapter({
      // groq-sdk 是完全 OpenAI 兼容的 client，可以直接塞给 OpenAIAdapter
      openai: llmClient as unknown as import("openai").OpenAI,
      model: LLM_MODELS.chat,
    })
    return createSafeAdapter(baseAdapter, "OpenAIAdapter(Vercel-Gateway)")
  }

  const baseAdapter = new GroqAdapter({
    groq: llmClient,
    model: LLM_MODELS.chat,
  })
  return createSafeAdapter(baseAdapter, "GroqAdapter")
}

let serviceAdapter: any
try {
  serviceAdapter = buildServiceAdapter()
} catch (err: any) {
  // 启动时如果配置错误，打出来不崩，但 POST 请求时仍会报错
  console.error("[CopilotKit route] ❌ buildServiceAdapter failed:", err?.message || err)
  serviceAdapter = null
}

export const POST = async (req: NextRequest) => {
  if (!serviceAdapter) {
    return new Response(
      JSON.stringify({
        error: "LLM not configured",
        details: "未配置 LLM_API_KEY 或 GROQ_API_KEY，或 .env.local 未生效（重启 dev 服务器）。",
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
