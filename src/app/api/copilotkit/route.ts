import {
  CopilotRuntime,
  GroqAdapter,
  OpenAIAdapter,
  copilotRuntimeNextJSAppRouterEndpoint,
} from "@copilotkit/runtime"
import { NextRequest } from "next/server"
import { randomUUID } from "crypto"
import Groq from "groq-sdk"
import { LLM_DISABLED, LLM_MODELS, llmClient, LLM_BASE_URL_USED } from "@/lib/llm"

if (LLM_DISABLED) {
  console.warn("[CopilotKit route] DISABLE_GROQ/DISABLE_LLM=true，使用 mock 回复。")
}

const copilotKit = new CopilotRuntime()

/**
 * 按 CopilotKit Runtime 规定的方式，通过 eventSource 把一条纯文本消息流式发给前端。
 * 只有这样前端 useCopilotChat().visibleMessages 才会增加 assistant 消息，从而触发渲染。
 */
function streamTextMessage(eventSource: any, text: string) {
  eventSource.stream(async (eventStream$: any) => {
    const messageId = randomUUID()
    try {
      eventStream$.sendTextMessageStart({ messageId })
      // 流式一段一段推，体验更好，同时保证写入 visibleMessages
      const chunkSize = 12
      for (let i = 0; i < text.length; i += chunkSize) {
        eventStream$.sendTextMessageContent({
          messageId,
          content: text.slice(i, i + chunkSize),
        })
        // 给前端一个流式更新的感觉（也保证事件顺序 flush）
        await new Promise((r) => setTimeout(r, 5))
      }
      eventStream$.sendTextMessageEnd({ messageId })
    } finally {
      eventStream$.complete()
    }
  })
}

function createMockAdapter() {
  return new (class {
    async process({ messages, threadId: threadIdFromRequest, eventSource }: any): Promise<any> {
      const threadId = threadIdFromRequest ?? randomUUID()
      const lastUserMessage =
        [...messages].reverse().find((m: any) => {
          const type = typeof m?._getType === "function" ? m._getType() : m?.role
          return type === "human" || type === "user" || type === "User"
        })?.content ?? "你的问题"
      const userText = Array.isArray(lastUserMessage)
        ? lastUserMessage
            .map((p: any) => (typeof p === "string" ? p : p?.text ?? p?.content ?? ""))
            .join("")
        : String(lastUserMessage)
      const reply =
        `🤖 [开发模式 Mock 回复]\n\n你说的是："${userText.slice(0, 100)}"\n\n` +
        `这是本地 mock AI 回复，因为 DISABLE_GROQ / DISABLE_LLM=true 或 LLM_API_KEY 没配置。\n` +
        `如果想用真实 AI：在 .env.local 里配置 LLM_API_KEY + LLM_BASE_URL（例如 Vercel AI Gateway）。`
      // 故意等一下，模拟网络延迟
      await new Promise((r) => setTimeout(r, 300))
      streamTextMessage(eventSource, reply)
      return { threadId }
    }
  })() as any
}

function createSafeAdapter(baseAdapter: any, label: string) {
  return new Proxy(baseAdapter, {
    get(target, prop, receiver) {
      const original = Reflect.get(target, prop, receiver)
      if (typeof original !== "function" || prop !== "process") return original
      return async function (...args: any[]) {
        const request: any = args[0] ?? {}
        const { eventSource, messages, threadId: threadIdFromRequest } = request
        const threadId = threadIdFromRequest ?? randomUUID()
        try {
          // 打印一下请求摘要，方便 Node 端调试
          const userCount = (messages || []).filter((m: any) => {
            const type = typeof m?._getType === "function" ? m._getType() : m?.role
            return type === "human" || type === "user"
          }).length
          console.log(`[CopilotKit ${label}] process start userMessages=${userCount} model=${LLM_MODELS.chat}`)
          const result = await original.apply(target, args)
          console.log(`[CopilotKit ${label}] process done`)
          return result
        } catch (err: any) {
          console.error(`[CopilotKit ${label}] process error:`, {
            name: err?.name,
            message: err?.message,
            status: err?.status,
            statusCode: err?.statusCode,
            cause: err?.cause?.message ?? undefined,
            stack: err?.stack?.split("\n").slice(0, 6).join("\n"),
          })
          const lastUserMessage =
            (request.messages || [])
              .slice(-1)[0]?.content ?? "你的问题"
          const userText = Array.isArray(lastUserMessage)
            ? lastUserMessage
                .map((p: any) => (typeof p === "string" ? p : p?.text ?? p?.content ?? ""))
                .join("")
            : String(lastUserMessage).slice(0, 100)
          const reply =
            `⚠️ LLM 调用失败（${err?.message || "未知错误"}）。\n\n` +
            `你说的是："${userText}"\n\n` +
            `排查建议：\n` +
            `1. 确认 .env.local 里 LLM_API_KEY / LLM_BASE_URL 是否正确（当前 BaseURL = ${LLM_BASE_URL_USED}，模型 = ${LLM_MODELS.chat}）\n` +
            `2. Vercel AI Gateway 的模型名要写成 provider:model 形式，例如 openai:gpt-4o-mini / groq:gemma2-9b-it\n` +
            `3. 暂时不想折腾？在 .env.local 加 DISABLE_LLM=true 即可使用本地 mock 回复。`
          // 注意：即使出错，也要通过 eventSource 推送一条 assistant 消息给前端，否则 visibleMessages 不会更新
          streamTextMessage(eventSource, reply)
          return { threadId }
        }
      }
    },
  })
}

function buildServiceAdapter(): any {
  if (LLM_DISABLED || !llmClient) return createMockAdapter()

  // 只要有自定义 baseURL，就视为通用 OpenAI 兼容接口（例如 Vercel AI Gateway），走 OpenAIAdapter
  // 否则走 GroqAdapter（Groq 官方原生）——这样最稳
  const usingCustomBase = !!process.env.LLM_BASE_URL || !!process.env.OPENAI_BASE_URL

  if (usingCustomBase) {
    const baseAdapter = new OpenAIAdapter({
      // 虽然字段叫 openai，但任何 OpenAI 兼容 client 都可用（groq-sdk 完全兼容协议）
      openai: llmClient as unknown as import("openai").OpenAI,
      model: LLM_MODELS.chat,
    })
    return createSafeAdapter(baseAdapter, "OpenAIAdapter")
  }

  const baseAdapter = new GroqAdapter({
    groq: llmClient,
    model: LLM_MODELS.chat,
  })
  return createSafeAdapter(baseAdapter, "GroqAdapter")
}

const serviceAdapter: any = buildServiceAdapter()

export const POST = async (req: NextRequest) => {
  try {
    const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
      runtime: copilotKit,
      serviceAdapter,
      endpoint: "/api/copilotkit",
    })
    return handleRequest(req)
  } catch (err: any) {
    console.error("[CopilotKit route] handleRequest error:", {
      name: err?.name,
      message: err?.message,
      status: err?.status,
      cause: err?.cause?.message ?? undefined,
    })
    return new Response(
      JSON.stringify({
        error: "CopilotKit runtime error",
        message: err?.message || "Unknown error",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    )
  }
}
