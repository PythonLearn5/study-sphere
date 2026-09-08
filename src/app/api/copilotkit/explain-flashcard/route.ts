import { NextRequest, NextResponse } from 'next/server'
import { LLM_MODELS, LLM_BASE_URL_USED, runChatCompletionJSON, ChatMessage } from '@/lib/llm'

export async function POST(request: NextRequest) {
  try {
    if (!process.env.LLM_API_KEY && !process.env.OPENAI_API_KEY && !process.env.GROQ_API_KEY) {
      return NextResponse.json(
        {
          error: 'LLM 未配置',
          details: '请在 .env.local 配置 LLM_API_KEY 或 GROQ_API_KEY，然后重启 dev 服务器。',
          baseURL: LLM_BASE_URL_USED,
        },
        { status: 503 },
      )
    }

    const { flashcard, userQuestion, studyMaterial } = await request.json()

    if (!flashcard || !userQuestion) {
      return NextResponse.json(
        { error: 'Flashcard and question are required' },
        { status: 400 },
      )
    }

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

    const { content: explanation } = await runChatCompletionJSON({
      messages,
      model: LLM_MODELS.fast,
      temperature: 0.7,
      max_tokens: 500,
    })

    if (!explanation) {
      throw new Error('No explanation generated (empty content from AI)')
    }

    return NextResponse.json({
      explanation: explanation.trim(),
    })
  } catch (error: any) {
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
