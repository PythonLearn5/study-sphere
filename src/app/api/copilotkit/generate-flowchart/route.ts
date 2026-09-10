import { NextRequest, NextResponse } from 'next/server'

// 请求参数类型：concept(必填), chartType(默认 flowchart), complexity(默认 detailed)
interface FlowchartGenerationRequest {
  concept: string
  chartType?: string
  complexity?: string
}

/**
 * POST /api/copilotkit/generate-flowchart
 * 转发代理：将请求原样转发到主生成端点 /api/generate-flowchart，
 * 确保 CopilotKit 子路由和直接调用走同一套生成逻辑。
 * 实际的 Mermaid 生成 + sanitize 在 /api/generate-flowchart/route.ts 中。
 */
export async function POST(req: NextRequest) {
  try {
    // 解析参数，提供默认值
    const { concept, chartType = 'flowchart', complexity = 'detailed' }: FlowchartGenerationRequest = await req.json()

    // 守卫：concept 为空 → 400
    if (!concept) {
      return NextResponse.json(
        { error: 'Concept description is required' },
        { status: 400 }
      )
    }

    // 转发到主生成 API（同源 fetch，保持参数一致）
    const response = await fetch(`${req.nextUrl.origin}/api/generate-flowchart`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        concept,
        chartType,
        complexity
      })
    })

    // 上游失败 → 500
    if (!response.ok) {
      throw new Error(`Failed to generate flowchart: ${response.statusText}`)
    }

    // 原样返回上游结果：{ success, mermaidCode, chartType, concept }
    const result = await response.json()
    return NextResponse.json(result)

  } catch (error) {
    console.error('Error in CopilotKit flowchart generation:', error)
    return NextResponse.json(
      { error: 'Failed to generate flowchart' },
      { status: 500 }
    )
  }
}
