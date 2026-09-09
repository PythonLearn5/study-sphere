import { NextRequest, NextResponse } from 'next/server'
import { LLM_MODELS, LLM_BASE_URL_USED, runChatCompletionJSON, ChatMessage } from '@/lib/llm'

interface FlowchartGenerationRequest {
  concept: string
  chartType: string
  complexity: string
}

async function generateMermaidWithAI(concept: string, chartType: string, complexity: string): Promise<string> {
  if (!process.env.LLM_API_KEY && !process.env.OPENAI_API_KEY) {
    throw new Error(
      'LLM client 未初始化：请配置 LLM_API_KEY 或 OPENAI_API_KEY（推荐 Vercel AI Gateway vck_ 开头密钥）。' +
        `当前 BaseURL=${LLM_BASE_URL_USED}，model=${LLM_MODELS.flowchart}`,
    )
  }

  const prompt = createPromptForChartType(concept, chartType, complexity)

  const systemMsg: ChatMessage = {
    role: 'system',
    content: `You are an expert at creating Mermaid diagrams. Generate only valid Mermaid syntax without any explanation or markdown formatting. 

For flowcharts, follow this EXACT syntax:
- Start with "flowchart TD"
- Use format: NodeID["Node Text"] --> NodeID2["Node Text 2"]
- For decisions: NodeID{"Question?"} -->|Yes| NodeID2["Action"]
- For start/end: START(["Start"]) and END(["End"])
- Each line should be: NodeID["Text"] --> NextNodeID["Text"]

Example:
flowchart TD
    START(["Start"]) --> A["Process Data"]
    A --> B{"Is Valid?"}
    B -->|Yes| C["Continue"]
    B -->|No| D["Show Error"]
    C --> END(["End"])
    D --> END

Ensure all syntax is valid and each node has descriptive text in quotes.`,
  }

  const userMsg: ChatMessage = { role: 'user', content: prompt }

  const { content: result } = await runChatCompletionJSON({
    messages: [systemMsg, userMsg],
    model: LLM_MODELS.flowchart,
    temperature: 0.3,
    max_tokens: 1000,
  })

  if (!result?.trim()) {
    throw new Error('No response from AI (empty content)')
  }

  return sanitizeMermaidCode(result.trim())
}

function createPromptForChartType(concept: string, chartType: string, complexity: string): string {
  const basePrompt = `Create a ${complexity} ${chartType} diagram for: "${concept}"`

  switch (chartType) {
    case 'flowchart':
      return `${basePrompt}

Show the complete process flow including:
${complexity === 'simple' ? '- Main steps only' : complexity === 'detailed' ? '- Main steps with decision points and error handling' : '- Comprehensive flow with all branches, error handling, validation, and edge cases'}

Use proper Mermaid flowchart syntax:
- Rectangle nodes: A[Process Step] or A["Process Step"]
- Diamond nodes: B{Decision?} or B{"Is condition met?"}
- Start/End nodes: START([Start]) and END([End])
- Connections: A --> B or A -->|label| B
- Each node must have a unique ID (A, B, C, etc.)

IMPORTANT SYNTAX RULES:
- Use unique single-letter IDs for each node (A, B, C, D, etc.)
- Put text in square brackets [text] or quotes ["text"]
- No parentheses ((text)) in flowcharts - use ([text]) for rounded rectangles
- Each connection must be on its own line
- Use proper arrow syntax: --> or -->|label|

Generate ONLY the mermaid flowchart code starting with "flowchart TD"`

    case 'sequence':
      return `${basePrompt}

Show the interaction sequence between different actors/systems including:
${complexity === 'simple' ? '- Basic interactions only' : complexity === 'detailed' ? '- Detailed interactions with responses' : '- Comprehensive interactions with error handling, timeouts, and alternative flows'}

Use proper sequence diagram syntax with participants and messages.

Generate ONLY the mermaid sequence diagram code starting with "sequenceDiagram"`

    case 'class':
      return `${basePrompt}

Show the class structure including:
${complexity === 'simple' ? '- Basic classes and relationships' : complexity === 'detailed' ? '- Classes with methods and properties' : '- Comprehensive class hierarchy with detailed methods, properties, and relationships'}

Use proper class diagram syntax.

Generate ONLY the mermaid class diagram code starting with "classDiagram"`

    case 'state':
      return `${basePrompt}

Show the state transitions including:
${complexity === 'simple' ? '- Basic states and transitions' : complexity === 'detailed' ? '- States with triggers and actions' : '- Comprehensive state machine with guards, events, and nested states'}

Use proper state diagram syntax.

Generate ONLY the mermaid state diagram code starting with "stateDiagram-v2"`

    case 'mindmap':
      return `${basePrompt}

Create a mind map structure showing:
${complexity === 'simple' ? '- Main branches only (3-4 branches)' : complexity === 'detailed' ? '- Multiple levels of detail (2-3 levels deep)' : '- Comprehensive hierarchy with detailed sub-branches (3-4 levels deep)'}

IMPORTANT SYNTAX RULES for Mermaid mindmap:
- Start with "mindmap"
- There must be EXACTLY ONE root node using the syntax: root((Concept Name))
- All branches must be INDENTED under the root (use 2 spaces per level)
- Each child node is simply text on its own line, no brackets or arrows
- Use indentation to show hierarchy (2 spaces = 1 level deep)

Example:
mindmap
  root((Project Management))
    Planning
      Requirements
      Timeline
    Execution
      Development
      Testing
    Review
      Retrospective
      Improvements

Generate ONLY the mermaid mindmap code starting with "mindmap"`

    case 'timeline':
      return `${basePrompt}

Show the timeline of events including:
${complexity === 'simple' ? '- Key milestones only' : complexity === 'detailed' ? '- Detailed phases and events' : '- Comprehensive timeline with all phases, dependencies, and parallel activities'}

Generate ONLY the mermaid timeline code starting with "timeline"`

    default:
      return `${basePrompt}

Generate a mermaid flowchart showing the process flow with appropriate level of detail.

Generate ONLY the mermaid code starting with "flowchart TD"`
  }
}

function sanitizeMermaidCode(code: string): string {
  let cleaned = code.replace(/```mermaid\n?/g, '').replace(/```\n?/g, '')
  cleaned = cleaned.trim()

  // mindmap 语法特殊处理：不能应用 ((text)) → NODE(["text"]) 转换
  if (cleaned.startsWith('mindmap')) {
    const lines = cleaned.split('\n')
    // 确保有且仅有一个 root 节点
    const rootIdx = lines.findIndex((l) => l.trim().startsWith('root('))
    if (rootIdx === -1) {
      // 没有 root 节点 → 把第一个缩进行当 root，其余保持缩进
      const bodyLines = lines.slice(1).filter((l) => l.trim().length > 0)
      if (bodyLines.length > 0) {
        const firstContent = bodyLines[0].trim()
        lines.splice(1, 0, `  root((${firstContent}))`)
        // 删除原来的第一行内容（已提升为 root）
        const origIdx = lines.findIndex(
          (l, i) => i > 1 && l.trim() === firstContent,
        )
        if (origIdx !== -1) lines.splice(origIdx, 1)
      }
    }
    return lines.join('\n')
  }

  // 非 mindmap：应用 ((text)) → NODE(["text"]) 转换（仅用于 flowchart）
  cleaned = cleaned
    .replace(/\(\(([^)]+)\)\)/g, (match, text) => {
      if (text.toLowerCase().includes('start')) return 'START(["Start"])'
      if (text.toLowerCase().includes('end')) return 'END(["End"])'
      return `NODE(["${text}"])`
    })
    .replace(/\n\s*-->/g, ' -->')
    .replace(/-->\s*\n/g, ' --> ')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n')

  if (!cleaned.match(/^(flowchart|sequenceDiagram|classDiagram|stateDiagram|mindmap|timeline)/)) {
    if (cleaned.includes('flowchart')) {
      cleaned = 'flowchart TD\n' + cleaned.split('\n').slice(1).join('\n')
    }
  }
  return cleaned
}

export async function POST(req: NextRequest) {
  let concept = ''
  let chartType = 'flowchart'
  let complexity = 'simple'

  try {
    const body = await req.json()
    concept = body.concept || ''
    chartType = body.chartType || 'flowchart'
    complexity = body.complexity || 'simple'

    if (!concept) {
      return NextResponse.json(
        { error: 'Concept description is required' },
        { status: 400 },
      )
    }

    const mermaidCode = await generateMermaidWithAI(concept, chartType, complexity)

    return NextResponse.json({
      success: true,
      mermaidCode,
      chartType,
      concept,
    })
  } catch (error: any) {
    console.error('Error generating flowchart ⚠️ :', {
      name: error?.name,
      message: error?.message,
      status: error?.status,
      statusCode: error?.statusCode,
      cause: error?.cause?.message ?? undefined,
      stack: error?.stack?.split('\n').slice(0, 6).join('\n'),
    })
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate flowchart',
        details: error?.message || 'Unknown error',
        baseURL: LLM_BASE_URL_USED,
        model: LLM_MODELS.flowchart,
      },
      { status: 500 },
    )
  }
}
