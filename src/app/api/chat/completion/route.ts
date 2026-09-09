/**
 * 聊天补全 API — 自研 SSE 流式聊天端点（不依赖 CopilotKit）
 *
 * 支持两种模式：
 * - 流式（默认）：通过 Server-Sent Events 逐 token 推送，前端实现打字机效果
 * - 非流式（stream=false）：一次性返回完整 JSON
 */
import { NextRequest, NextResponse } from "next/server";
import {
  LLM_MODELS,
  LLM_BASE_URL_USED,
  LLM_API_KEY_SET,
  runChatCompletionStream,
  ChatMessage,
  LLMError,
} from "@/lib/llm";

// 使用 Node.js 运行时（Edge 运行时对 ReadableStream 流式支持有限）
export const runtime = "nodejs";
// 禁止静态缓存，每次请求都重新执行
export const dynamic = "force-dynamic";

// AI 人设 & 行为规则，自动拼接到每段对话最前面作为 system 消息
const DEFAULT_SYSTEM_PROMPT = `You are Study Sphere AI, a helpful, patient, expert study assistant.
Follow these rules:
- Help with essay writing, proofreading, concept explanations, study plans, homework hints.
- Keep explanations clear and structured (use short paragraphs, bullet points, numbered steps where helpful).
- When asked for writing help, give concrete examples and outline, and be encouraging.
- If the question is vague, ask a brief clarifying question before giving a long answer.
- Never make up facts; say when you're not sure.
- Keep markdown in responses minimal, compatible with simple rendering.
- Respond in the same language as the user's latest message.`;

export async function POST(req: NextRequest) {
  // ── 守卫：API Key 未配置时直接返回 503 ──
  if (!LLM_API_KEY_SET) {
    return NextResponse.json(
      {
        error: "LLM 未配置",
        details:
          "请在 .env.local 配置 LLM_API_KEY 或 OPENAI_API_KEY（推荐 Vercel AI Gateway vck_ 开头密钥），然后重启 dev 服务器。",
        baseURL: LLM_BASE_URL_USED,
      },
      { status: 503 },
    );
  }

  // ── 解析请求体：提取 messages 数组 + stream 开关（默认 true）──
  let rawMessages: ChatMessage[] = [];
  let wantStream = true;
  try {
    const body = await req.json();
    rawMessages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
    wantStream = body.stream !== false;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  // ── 守卫：messages 不能为空 ──
  if (!rawMessages.length) {
    return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
  }

  const userCount = rawMessages.filter((m) => m.role === "user").length;
  console.log(
    `[api/chat/completion] start userMessages=${userCount} model=${LLM_MODELS.chat} ` +
      `baseURL=${LLM_BASE_URL_USED} stream=${wantStream}`,
  );

  // ── 消息清洗：角色白名单过滤 + content 强制转字符串 ──
  const sanitized: ChatMessage[] = rawMessages.map((m) => ({
    role:
      m.role === "assistant" || m.role === "system" || m.role === "user" ? m.role : "user",
    content: String(m.content || ""),
  }));
  // 在用户消息前插入 system prompt，引导 AI 行为
  const messages: ChatMessage[] = [
    { role: "system", content: DEFAULT_SYSTEM_PROMPT },
    ...sanitized,
  ];
  const startAt = Date.now();

  // ==================== 非流式分支 ====================
  // 复用流式接口，但 onToken 只累加不做 SSE 推送，最终一次性返回完整 JSON
  if (!wantStream) {
    try {
      let full = "";
      await runChatCompletionStream(
        { messages, model: LLM_MODELS.chat, temperature: 0.7, max_tokens: 2048 },
        {
          onToken: (d) => { full += d; },
          onDone: () => {},
          onError: (err: LLMError) => {
            console.error("[api/chat/completion] non-stream error:", err.message, {
              status: err.status,
              cause: (err.cause as any)?.message ?? undefined,
            });
            throw err;
          },
        },
      );
      const elapsed = Date.now() - startAt;
      console.log(`[api/chat/completion] done non-stream elapsed=${elapsed}ms`);
      return NextResponse.json({
        content: full,
        model: LLM_MODELS.chat,
        elapsedMs: elapsed,
        baseURL: LLM_BASE_URL_USED,
      });
    } catch (err: any) {
      console.error("[api/chat/completion] non-stream fatal:", {
        name: err?.name,
        message: err?.message,
        status: err?.status,
      });
      return NextResponse.json(
        {
          error: "Chat completion failed",
          details: err?.message || "Unknown error",
          baseURL: LLM_BASE_URL_USED,
          model: LLM_MODELS.chat,
        },
        { status: err?.status || 500 },
      );
    }
  }

  // ==================== 流式分支：SSE ====================
  const encoder = new TextEncoder();
  // 错误暂存：onError 回调不能直接抛异常（会中断流），先存起来等流结束后再推送
  let errorPayload: { type: "error"; name: string; message: string; status: number; details?: string } | null = null;
  // 标记是否已推送过至少一条 SSE 事件（用于决定 catch 中如何兜底）
  let startedAtLeastOneEvent = false;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        // pushText：将文本编码后推入 SSE 流
        const pushText = (text: string) => {
          controller.enqueue(encoder.encode(text));
          startedAtLeastOneEvent = true;
        };
        // 心跳：LLM 冷启动可能慢，先推一行注释帧防止浏览器把 SSE 连接判为超时
        pushText(": ping\n\n");

        await runChatCompletionStream(
          {
            messages,
            model: LLM_MODELS.chat,
            temperature: 0.7,
            max_tokens: 2048,
          },
          {
            // 传入 AbortSignal：用户断开连接时自动取消 LLM 调用
            signal: req.signal,
            // 每收到一个 token → 推送一条 SSE data 事件（前端拼成打字机效果）
            onToken: (delta) => {
              pushText(`data: ${JSON.stringify({ type: "delta", delta })}\n\n`);
            },
            // 流结束 → 推送 done 事件（含完整文本 + 耗时），然后关闭流
            onDone: (fullContent) => {
              const elapsed = Date.now() - startAt;
              console.log(`[api/chat/completion] done stream elapsed=${elapsed}ms`);
              pushText(
                `data: ${JSON.stringify({
                  type: "done",
                  model: LLM_MODELS.chat,
                  elapsedMs: elapsed,
                  finalContent: fullContent,
                })}\n\n`,
              );
              try {
                controller.close();
              } catch {
                /* ignore */
              }
            },
            // 流中出错 → 不抛异常（会中断 stream），暂存错误，等 runChatCompletionStream 返回后再推送
            onError: (err: LLMError) => {
              console.error("[api/chat/completion] stream error ⚠️ :", {
                name: err.name,
                message: err.message,
                status: err.status,
                cause: (err.cause as any)?.message ?? undefined,
                responseBody: typeof err.responseBody === "string"
                  ? err.responseBody.slice(0, 800)
                  : err.responseBody,
              });
              errorPayload = {
                type: "error",
                name: err.name || "StreamError",
                message: err.message || "Unknown stream error",
                status: err.status || 500,
                details: (err.cause as any)?.message ?? undefined,
              };
            },
          },
        );

        // 流正常返回后检查是否有暂存的错误，有则推送 error 事件再关闭
        if (errorPayload) {
          pushText(`data: ${JSON.stringify(errorPayload)}\n\n`);
          try {
            controller.close();
          } catch {
            /* ignore */
          }
        }
      } catch (err: any) {
        // 用户主动断开 → 静默关闭流
        if (err?.name === "AbortError") {
          try {
            controller.close();
          } catch {
            /* ignore */
          }
          return;
        }
        // 其他未捕获异常 → 如果还没发过任何事件，至少给前端一条错误信息
        console.error("[api/chat/completion] stream controller error:", {
          name: err?.name,
          message: err?.message,
          status: err?.status,
        });
        const payload = JSON.stringify({
          type: "error",
          name: err?.name || "FatalError",
          message: err?.message || "Unknown error",
          status: err?.status || 500,
          baseURL: LLM_BASE_URL_USED,
        });
        try {
          if (!startedAtLeastOneEvent) {
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          }
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
  });

  // 返回 SSE 流响应
  return new NextResponse(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // 禁止 Nginx/反向代理缓冲，确保每个 token 立即到达浏览器
      "X-Accel-Buffering": "no",
    },
  });
}
