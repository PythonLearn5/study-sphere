import { NextRequest, NextResponse } from 'next/server'
import Groq from 'groq-sdk'
import { LLM_DISABLED, LLM_MODELS, llmClient } from '@/lib/llm'

export async function POST(request: NextRequest) {
  try {
    const { studyMaterial, numberOfCards, difficulty, focusArea } = await request.json()

    if (!studyMaterial?.trim()) {
      return NextResponse.json(
        { error: 'Study material is required' },
        { status: 400 }
      )
    }

    // Create a prompt for flashcard generation
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

    let content: string
    if (LLM_DISABLED || !llmClient) {
      content = JSON.stringify({
        flashcards: Array.from({ length: Math.min(numberOfCards, 5) }, (_, i) => ({
          question: `闪卡示例 ${i + 1}：关于 "${studyMaterial.slice(0, 30)}" 的问题`,
          answer: `这是 mock 回复（DISABLE_LLM=true 或未配置 API Key）。\n实际部署并配置好 LLM_API_KEY/LLM_BASE_URL 后会生成真实闪卡内容。`,
          topic: focusArea || 'General',
          tags: ['mock', 'development'],
          audioReadableAnswer: '这是开发模式下的示例答案。',
        })),
      })
    } else {
      const completion = await llmClient.chat.completions.create({
        messages: [
          {
            role: 'system',
            content: 'You are an expert educational content creator specializing in creating effective flashcards for learning. Always respond with valid JSON only. Make answers suitable for text-to-speech reading.',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        model: LLM_MODELS.smart,
        temperature: 0.7,
        max_tokens: 4000,
        response_format: { type: 'json_object' },
      })

      content = completion.choices[0]?.message?.content || ''
    }

    if (!content) {
      throw new Error('No response from AI')
    }

    let flashcardsData
    try {
      flashcardsData = JSON.parse(content)
    } catch (parseError) {
      console.error('Failed to parse AI response:', content)
      throw new Error('Invalid response format from AI')
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
  } catch (error) {
    console.error('Error generating flashcards:', error)
    
    if (error instanceof Error && error.message.includes('model')) {
      return NextResponse.json(
        { 
          error: 'AI model temporarily unavailable',
          details: 'The AI service is currently updating. Please try again in a moment.',
        },
        { status: 503 },
      )
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to generate flashcards',
        details: error instanceof Error ? error.message : 'Unknown error occurred',
      },
      { status: 500 },
    )
  }
}