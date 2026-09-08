import { NextRequest, NextResponse } from 'next/server'
import { LLM_MODELS, LLM_BASE_URL_USED, runChatCompletionJSON, ChatMessage } from '@/lib/llm'

interface QuizGenerationRequest {
  studyMaterial: string
  numberOfQuestions: number
  difficulty: 'beginner' | 'intermediate' | 'advanced'
  quizType: 'multiple-choice' | 'true-false' | 'mixed'
  subjectId: string
  topicId: string
}

interface Question {
  question: string
  options: string[]
  correctOption: string
}

export async function POST(request: NextRequest) {
  try {
    const body: QuizGenerationRequest = await request.json()
    const { studyMaterial, numberOfQuestions, difficulty, quizType } = body

    if (!studyMaterial) {
      return NextResponse.json({ error: 'Study material is required' }, { status: 400 })
    }

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

    const questions = await generateAIQuestions(body)

    return NextResponse.json({
      success: true,
      questions,
      metadata: {
        difficulty,
        quizType,
        numberOfQuestions: questions.length,
        aiGenerated: true,
      },
    })
  } catch (error: any) {
    console.error('Error generating quiz ⚠️ :', {
      name: error?.name,
      message: error?.message,
      status: error?.status,
      cause: error?.cause?.message ?? undefined,
      stack: error?.stack?.split('\n').slice(0, 6).join('\n'),
    })
    return NextResponse.json(
      {
        error: 'Failed to generate quiz',
        details: error?.message || 'Unknown error',
        baseURL: LLM_BASE_URL_USED,
        model: LLM_MODELS.quiz,
      },
      { status: 500 },
    )
  }
}

async function generateAIQuestions(request: QuizGenerationRequest): Promise<Question[]> {
  if (!process.env.LLM_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error('LLM client not available')
  }

  const { studyMaterial, numberOfQuestions, difficulty, quizType } = request

  const prompt = `Based on the following study material, create ${numberOfQuestions} ${difficulty} level quiz questions of type ${quizType}.

Study Material:
${studyMaterial}

Requirements:
- Create exactly ${numberOfQuestions} questions
- Difficulty level: ${difficulty}
- Question type: ${quizType}
- For multiple choice questions: provide 4 options (A, B, C, D)
- For true/false questions: provide 2 options (True, False)
- For mixed type: use a combination of multiple choice and true/false
- Questions MUST be based on the provided study material content
- Make sure the questions test understanding of the key concepts in the study material

Format your response as a JSON array with this structure:
[
  {
    "question": "Question text here",
    "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
    "correctOption": "Option 1"
  }
]

Make sure the questions test understanding of the key concepts in the study material.`

  const { content: response } = await runChatCompletionJSON({
    messages: [{ role: 'user', content: prompt }],
    model: LLM_MODELS.quiz,
    temperature: 0.7,
    max_tokens: 4000,
  })

  if (!response) {
    throw new Error('No response from AI (empty content)')
  }

  const jsonMatch = response.match(/\[[\s\S]*\]/)
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]) as Question[]
    if (!Array.isArray(parsed)) throw new Error('AI response is not a JSON array')
    return parsed
  }

  throw new Error('AI response does not contain valid JSON array of questions')
}
