import { NextRequest, NextResponse } from 'next/server'
import { LLM_MODELS, LLM_BASE_URL_USED, runChatCompletionJSON, ChatMessage } from '@/lib/llm'

export async function POST(request: NextRequest) {
  try {
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

    const { studyMaterial, numberOfCards, difficulty, focusArea } = await request.json()

    if (!studyMaterial?.trim()) {
      return NextResponse.json(
        { error: 'Study material is required' },
        { status: 400 },
      )
    }

    const prompt = `You are an expert educational content creator. Create ${numberOfCards} high-quality flashcards based on the following study material. 

Study Material:
${studyMaterial}

Requirements:
- Difficulty level: ${difficulty}
- Focus area: ${focusArea}
- Generate exactly ${numberOfCards} flashcards
- Each flashcard should have a clear, concise question and a comprehensive answer
- Questions should test understanding, not just memorization
- Answers should be educational and help with learning
- For audio readability, ensure answers are well-structured and pronounceable
- For ${focusArea === 'definitions' ? 'focus on key terms and their meanings' : focusArea === 'concepts' ? 'focus on understanding core concepts' : focusArea === 'problem-solving' ? 'focus on application and problem-solving scenarios' : 'cover a broad range of topics from the material'}

Return your response as a JSON object with the following structure:
{
  "flashcards": [
    {
      "question": "Clear, specific question",
      "answer": "Comprehensive, educational answer that reads well when spoken aloud",
      "topic": "Main topic/category",
      "tags": ["relevant", "tags"],
      "audioReadableAnswer": "Simplified version of the answer optimized for text-to-speech (optional, defaults to main answer)"
    }
  ]
}

Make sure the JSON is valid and contains exactly ${numberOfCards} flashcards.`

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content:
          'You are an expert educational content creator specializing in creating effective flashcards for learning. Always respond with valid JSON only. Make answers suitable for text-to-speech reading.',
      },
      {
        role: 'user',
        content: prompt,
      },
    ]

    const { content } = await runChatCompletionJSON({
      messages,
      model: LLM_MODELS.smart,
      temperature: 0.7,
      max_tokens: 4000,
      response_format: { type: 'json_object' },
    })

    if (!content) {
      throw new Error('No response from AI (empty content)')
    }

    let flashcardsData
    try {
      flashcardsData = JSON.parse(content)
    } catch (parseError) {
      console.error('Failed to parse AI response (first 500 chars):', content.slice(0, 500))
      throw new Error('Invalid JSON response from AI')
    }

    if (!flashcardsData.flashcards || !Array.isArray(flashcardsData.flashcards)) {
      throw new Error('Invalid flashcards format in AI response')
    }

    if (flashcardsData.flashcards.length === 0) {
      throw new Error('No flashcards generated')
    }

    const validatedFlashcards = flashcardsData.flashcards.map((card: any, index: number) => {
      if (!card.question || !card.answer) {
        throw new Error(`Flashcard ${index + 1} is missing question or answer`)
      }
      return {
        id: `card-${Date.now()}-${index}`,
        question: card.question.trim(),
        answer: card.answer.trim(),
        audioReadableAnswer: card.audioReadableAnswer ? card.audioReadableAnswer.trim() : card.answer.trim(),
        topic: card.topic || focusArea,
        tags: Array.isArray(card.tags) ? card.tags : [],
      }
    })

    return NextResponse.json({
      flashcards: validatedFlashcards,
      metadata: {
        difficulty,
        focusArea,
        numberOfCards: validatedFlashcards.length,
        generatedAt: new Date().toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Error generating flashcards ⚠️ :', {
      name: error?.name,
      message: error?.message,
      status: error?.status,
      statusCode: error?.statusCode,
      cause: error?.cause?.message ?? undefined,
      stack: error?.stack?.split('\n').slice(0, 6).join('\n'),
    })

    if (error?.message?.includes('model')) {
      return NextResponse.json(
        {
          error: 'AI model temporarily unavailable',
          details: error?.message,
          baseURL: LLM_BASE_URL_USED,
          model: LLM_MODELS.smart,
        },
        { status: 503 },
      )
    }

    return NextResponse.json(
      {
        error: 'Failed to generate flashcards',
        details: error?.message || 'Unknown error',
        baseURL: LLM_BASE_URL_USED,
        model: LLM_MODELS.smart,
      },
      { status: 500 },
    )
  }
}
