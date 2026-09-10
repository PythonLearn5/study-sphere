import { NextRequest, NextResponse } from 'next/server'
import { LLM_MODELS, LLM_BASE_URL_USED, runChatCompletionJSON, ChatMessage } from '@/lib/llm'

/**
 * POST /api/copilotkit/explain-flashcard
 * 输入闪卡 + 学生问题，调用 LLM 生成讲解（非流式）。
 * 返回 { explanation: string } 结构。
 */
export async function POST(request: NextRequest) {
  try {
    // 守卫1：API Key 未配置 → 503
    if (!process.env.LLM_API_KEY && !process.env.OPENAI_API_KEY) {
      return NextResponse.json(
        {
          error: 'LLM 未配置',
          details: '请在 .env.local 配置 LLM_API_KEY 或 OPENAI_API_KEY（推荐 Vercel AI Gateway vck_ 开头密钥），然后重启 dev 服务器。',
          baseURL: LLM_BASE_URL_USED,
        },
        { status: 503 },
      )
    }

    // 解析请求参数：flashcard(必填), userQuestion(必填), studyMaterial(可选)
    const { flashcard, userQuestion, studyMaterial } = await request.json()

    // 守卫2：缺 flashcard 或 userQuestion → 400
    if (!flashcard || !userQuestion) {
      return NextResponse.json(
        { error: 'Flashcard and question are required' },
        { status: 400 },
      )
    }

    // 构建 prompt：闪卡 Q/A/Topic + 学习材料上下文(截断1000字) + 学生问题
    // 要求：直接回答 + 关联闪卡 + 额外举例 + 清晰语言 + 鼓励学习，限 2-3 段
    const prompt = `You are an expert tutor helping a student understand a flashcard.

Current Flashcard:
Question: ${flashcard.question}
Answer: ${flashcard.answer}
Topic: ${flashcard.topic}

Original Study Material Context:
${studyMaterial ? studyMaterial.substring(0, 1000) + '...' : 'Not available'}

Student's Question: ${userQuestion}

Please provide a helpful, educational explanation that:
1. Directly addresses the student's question
2. Relates to the flashcard content
3. Provides additional context or examples if helpful
4. Uses clear, easy-to-understand language
5. Encourages further learning

Keep your response concise but informative (2-3 paragraphs maximum).`

    // system + user 消息
    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You are a knowledgeable and patient tutor. Provide clear, helpful explanations that enhance student understanding.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]

    // 调用 LLM（非流式），使用 fast 模型，限制 500 tokens 控制成本
    const { content: explanation } = await runChatCompletionJSON({
      messages,
      model: LLM_MODELS.fast,
      temperature: 0.7,
      max_tokens: 500,
    })

    if (!explanation) {
      throw new Error('No explanation generated (empty content from AI)')
    }

    // 返回讲解文本
    return NextResponse.json({
      explanation: explanation.trim(),
    })
  } catch (error: any) {
    // 错误处理：统一返回 500 + baseURL + model 信息
    console.error('Error generating explanation ⚠️ :', {
      name: error?.name,
      message: error?.message,
      status: error?.status,
      cause: error?.cause?.message ?? undefined,
      stack: error?.stack?.split('\n').slice(0, 6).join('\n'),
    })
    return NextResponse.json(
      {
        error: 'Failed to generate explanation',
        details: error?.message || 'Unknown error',
        baseURL: LLM_BASE_URL_USED,
        model: LLM_MODELS.fast,
      },
      { status: 500 },
    )
  }
}
