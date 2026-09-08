import { NextRequest, NextResponse } from "next/server";
import {
  LLM_MODELS,
  LLM_BASE_URL_USED,
  LLM_API_KEY_SET,
  runChatCompletionStream,
  ChatMessage,
  LLMError,
} from "@/lib/llm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

  let rawMessages: ChatMessage[] = [];
  let wantStream = true;
  try {
    const body = await req.json();
    rawMessages = Array.isArray(body.messages) ? (body.messages as ChatMessage[]) : [];
    wantStream = body.stream !== false;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!rawMessages.length) {
    return NextResponse.json({ error: "messages 不能为空" }, { status: 400 });
  }

  const userCount = rawMessages.filter((m) => m.role === "user").length;
  console.log(
    `[api/chat/completion] start userMessages=${userCount} model=${LLM_MODELS.chat} ` +
      `baseURL=${LLM_BASE_URL_USED} stream=${wantStream}`,
  );

  const sanitized: ChatMessage[] = rawMessages.map((m) => ({
    role:
      m.role === "assistant" || m.role === "system" || m.role === "user" ? m.role : "user",
    content: String(m.content || ""),
  }));
  const messages: ChatMessage[] = [
    { role: "system", content: DEFAULT_SYSTEM_PROMPT },
    ...sanitized,
  ];
  const startAt = Date.now();

  // ===== 非流式分支 =====
  if (!wantStream) {
    try {
      // 复用流式接口，但在这里 onToken 不 push，最后 onDone 一次性返回
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

  // ===== 流式分支：SSE =====
  const encoder = new TextEncoder();
  let errorPayload: { type: "error"; name: string; message: string; status: number; details?: string } | null = null;
  let startedAtLeastOneEvent = false;

  const readable = new ReadableStream({
    async start(controller) {
      try {
        const pushText = (text: string) => {
          controller.enqueue(encoder.encode(text));
          startedAtLeastOneEvent = true;
        };
        // 先推一行心跳，保证即使 LLM 冷启动慢，浏览器也不会把 SSE 连接判死
        pushText(": ping\n\n");

        await runChatCompletionStream(
          {
            messages,
            model: LLM_MODELS.chat,
            temperature: 0.7,
            max_tokens: 2048,
          },
          {
            signal: req.signal,
            onToken: (delta) => {
              pushText(`data: ${JSON.stringify({ type: "delta", delta })}\n\n`);
            },
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

        if (errorPayload) {
          pushText(`data: ${JSON.stringify(errorPayload)}\n\n`);
          try {
            controller.close();
          } catch {
            /* ignore */
          }
        }
      } catch (err: any) {
        if (err?.name === "AbortError") {
          try {
            controller.close();
          } catch {
            /* ignore */
          }
          return;
        }
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
            // 还没发过就失败了 → 尝试通过失败 body 至少给前端一条错误
            controller.enqueue(encoder.encode(`data: ${payload}\n\n`));
          }
          controller.close();
        } catch {
          /* ignore */
        }
      }
    },
  });

  return new NextResponse(readable, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
