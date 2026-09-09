# Study Sphere CopilotKit 设计与用法详解

> 本文档基于代码实际实现，讲清楚 CopilotKit 在本项目中的架构、配置、Hooks 用法和 AI 端点。

---

## 目录

- [1. 架构总览](#1-架构总览)
- [2. 前端 Provider 配置](#2-前端-provider-配置)
- [3. 后端 Runtime 与 Fake OpenAI Client](#3-后端-runtime-与-fake-openai-client)
- [4. CopilotKit Hooks 用法清单](#4-copilotkit-hooks-用法清单)
- [5. CopilotTextarea 智能输入框](#5-copilottextarea-智能输入框)
- [6. CopilotKit 子路由（AI 工具端点）](#6-copilotkit-子路由ai-工具端点)
- [7. 统一 LLM 层](#7-统一-llm-层)
- [8. 两套聊天系统的关系](#8-两套聊天系统的关系)
- [9. 关键文件索引](#9-关键文件索引)

---

## 1. 架构总览

```
┌─────────────────────────────────────────────────────────────────┐
│  Dashboard Layout (src/app/dashboard/layout.tsx)                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  <CopilotKit runtimeUrl="/api/copilotkit"               │    │
│  │    useSingleEndpoint={true}                             │    │
│  │    agents__unsafe_dev_only={{ default: HttpAgent }}>    │    │
│  │                                                         │    │
│  │    <FlashcardsProvider>                                  │    │
│  │      <TasksProvider>                                     │    │
│  │        <FlowchartProvider>                               │    │
│  │          {children}  ← 各 Dashboard 页面                 │    │
│  │          <CopilotPopup />  ← 右下角悬浮气泡               │    │
│  │        </FlowchartProvider>                               │    │
│  │      </TasksProvider>                                    │    │
│  │    </FlashcardsProvider>                                 │    │
│  │  </CopilotKit>                                           │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
         │ POST /api/copilotkit (GraphQL over SSE)
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  CopilotKit Runtime (src/app/api/copilotkit/route.ts)           │
│                                                                 │
│  CopilotRuntime({ agents: { default },                          │
│    delegateAgentProcessingToServiceAdapter: true })              │
│         │                                                       │
│         ▼                                                       │
│  OpenAIAdapter ← makeFakeOpenAIClient()                         │
│    │   fakeClient.beta.chat.completions.stream()                │
│    │   → createStreamIterable()                                │
│    │     → runChatCompletionStream() (lib/llm.ts)              │
│    │                                                            │
│    └── createSafeAdapter() — Proxy 错误兜底                     │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  lib/llm.ts — 统一 LLM 层                                        │
│  原生 fetch → Vercel AI Gateway / OpenAI 兼容后端               │
│  runChatCompletionJSON()  (非流式)                               │
│  runChatCompletionStream() (流式 SSE)                            │
└─────────────────────────────────────────────────────────────────┘
```

**核心设计决策**：本项目不直接依赖 `openai` SDK，而是通过 `lib/llm.ts` 的原生 `fetch` 调用 Vercel AI Gateway。CopilotKit 的 `OpenAIAdapter` 期望一个 OpenAI SDK 风格的 client，因此我们构建了一个 **Fake OpenAI Client**，内部桥接到 `runChatCompletionStream`。

---

## 2. 前端 Provider 配置

**文件**：[dashboard/layout.tsx](../src/app/dashboard/layout.tsx)

### 2.1 CopilotKit Provider

```tsx
<CopilotKit
  runtimeUrl="/api/copilotkit"
  useSingleEndpoint={true}
  agents__unsafe_dev_only={agents__unsafe_dev_only}
>
```

| Prop | 值 | 说明 |
|------|----|------|
| `runtimeUrl` | `"/api/copilotkit"` | 所有 CopilotKit 流量（握手 + 消息）走单一端点 |
| `useSingleEndpoint` | `true` | v1.9+ 必须项：info 和 message 用同一个 URL，不再额外请求 `/info` |
| `agents__unsafe_dev_only` | `{ default: HttpAgent }` | 注册名为 `default` 的 agent，v1.9 握手要求至少有 `default` |

### 2.2 HttpAgent 注册

```tsx
const agents__unsafe_dev_only = useMemo(() => ({
  default: new HttpAgent({
    description: "默认学习助手（基于 Vercel AI Gateway 的 openai/gpt-4o-mini）…",
    url: "/api/copilotkit",
  }),
}), [])
```

- `url` 指向与 `runtimeUrl` 相同的端点
- `default` 是 key（也是 agent name），不需要在构造参数里写 `name`
- 通过 `@ag-ui/client` 的 `HttpAgent` 注册，告诉前端如何与后端 agent 通信

### 2.3 CopilotPopup 悬浮气泡

```tsx
<CopilotPopup
  defaultOpen={false}
  labels={{
    title: "Study Sphere AI 助手 (CopilotKit)",
    initial: "有什么学习问题？…",
    placeholder: "输入你的问题…",
  }}
  clickOutsideToClose={true}
/>
```

- `defaultOpen={false}`：默认收起为右下角按钮
- `clickOutsideToClose={true}`：点外部关闭气泡
- 如需隐藏气泡：删除 `<CopilotPopup />` 这一行即可，Provider 保留不影响其他功能

### 2.4 Provider 嵌套顺序

```
CopilotKit → FlashcardsProvider → TasksProvider → FlowchartProvider → 页面内容 + CopilotPopup
```

CopilotKit 在最外层，确保所有 dashboard 子页面都能使用 CopilotKit hooks 和气泡。

---

## 3. 后端 Runtime 与 Fake OpenAI Client

**文件**：[api/copilotkit/route.ts](../src/app/api/copilotkit/route.ts)

### 3.1 CopilotRuntime 配置

```ts
const copilotKit = new CopilotRuntime({
  agents: { default: new DefaultAgent() },
  delegateAgentProcessingToServiceAdapter: true,
})
```

- **`agents: { default: new DefaultAgent() }`**：后端必须同步提供 `{ default: ... }`
- **`delegateAgentProcessingToServiceAdapter: true`**：v2 多 Agent 框架只做路由和上下文管理，实际 LLM 调用走 ServiceAdapter
- `DefaultAgent.run()` 不会被调用（抛错兜底），因为 delegate 模式下 ServiceAdapter 处理一切

### 3.2 DefaultAgent

```ts
class DefaultAgent extends AbstractAgent {
  constructor() {
    super({ description: "默认学习助手…" })
  }
  override run(_input: any): any {
    throw new Error("不应该走到这里：delegateAgentProcessingToServiceAdapter=true 时…")
  }
}
```

一个"占位" agent，握手时返回 description，实际推理不经过它。

### 3.3 makeFakeOpenAIClient — 核心

CopilotKit 的 `OpenAIAdapter.process()` 内部调用 `this.openai.beta.chat.completions.stream(params)`，返回值需要是 async iterable。Fake Client 伪装成 OpenAI SDK：

```
返回对象结构:
{
  chat: { completions: { create, stream } },
  beta: { chat: { completions: { create, stream } } }   ← OpenAIAdapter 实际调用这里
}
```

**`stream(params)`** — 同步函数，返回 async iterable：

1. 调用 `mapMessages()` 将 CopilotKit 消息转为 `{ role, content }` 格式
2. 调用 `createStreamIterable(callParams)` 返回自定义 async iterator
3. 内部启动 `runChatCompletionStream`，通过回调推入 queue
4. `next()` 从 queue 取出 chunk，包装成 OpenAI 格式：
   ```ts
   { id: "chatcmpl-stream", object: "chat.completion.chunk",
     choices: [{ index: 0, delta: { content: chunk.delta }, finish_reason: null }] }
   ```

### 3.4 createSafeAdapter — 错误兜底 Proxy

```ts
const baseAdapter = new OpenAIAdapter({ openai: fakeClient, model: LLM_MODELS.chat })
return createSafeAdapter(baseAdapter, "OpenAIAdapter(Vercel-Gateway·FakeClient)")
```

Proxy 拦截 `process` 方法：
- **成功时**：日志记录开始/完成
- **失败时**：记录详细错误，通过 `eventSource.stream()` 推送错误消息给前端（避免 `isLoading` 永远 true），然后 re-throw

### 3.5 POST Handler

```ts
export const POST = async (req: NextRequest) => {
  if (!serviceAdapter) return /* 503 LLM not configured */
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime: copilotKit, serviceAdapter, endpoint: "/api/copilotkit",
  })
  return handleRequest(req)
}
```

- `serviceAdapter` 在模块加载时构建一次
- GET `/api/copilotkit/info` 握手由 `copilotRuntimeNextJSAppRouterEndpoint` 自动托管（`useSingleEndpoint=true` 使 info 和 POST 走同一 URL）

---

## 4. CopilotKit Hooks 用法清单

本项目在 4 个页面注册了 `useCopilotAction`，在 4 个页面注册了 `useCopilotReadable`。气泡 AI 可以读取页面状态并触发这些 Action。

### 4.1 useCopilotReadable — 向 AI 暴露页面状态

| 页面 | 文件 | 暴露内容 | description |
|------|------|----------|-------------|
| 闪卡 | [flashcards/page.tsx](../src/app/dashboard/flashcards/page.tsx) | `{ studyMaterial, generatedFlashcards, numberOfCards, difficulty, focusArea }` | "Current flashcards and study material" |
| 流程图 | [flowcharts/page.tsx](../src/app/dashboard/flowcharts/page.tsx) | `{ flowcharts, currentConcept, chartType, complexity, generatedCode, isGenerating }` (JSON 字符串) | "List of user's flowcharts and current generation state" |
| 笔记 | [notes/page.tsx](../src/app/dashboard/notes/page.tsx) | `JSON.stringify(notes)` | "Notes list with categories and bookmarks." |
| 测验 | [quizzes/page.tsx](../src/app/dashboard/quizzes/page.tsx) | `JSON.stringify({ quizzes, selectedSubject, selectedTopic, selectedDifficulty, showBookmarked, showCompleted })` | "Quizzes list with filters and organization." |

**作用**：气泡 AI 能"看到"当前页面数据，回答更精准。例如在闪卡页问"我现在有几张卡？"，AI 能从 readable 数据中知道。

### 4.2 useCopilotAction — 让 AI 触发操作

#### 闪卡页 — 2 个 Action

| Action | 参数 | 行为 |
|--------|------|------|
| `generateFlashcards` | `material`(必填), `count`, `difficultyLevel`, `focus` | 设置表单状态 → 调用 `generateFlashcards(request)` → 跳到学习步骤 |
| `explainFlashcard` | `question`(必填) | 取当前闪卡 → POST `/api/copilotkit/explain-flashcard` → 返回讲解文本 |

#### 流程图页 — 2 个 Action

| Action | 参数 | 行为 |
|--------|------|------|
| `generateFlowchart` | `concept`(必填), `chartType`, `complexity`, `title` | POST `/api/generate-flowchart` → 设置生成的 Mermaid 代码 → 切到预览 |
| `saveFlowchart` | `title`(必填), `description` | 取当前 `generatedCode` → 调用 `createFlowchart()` → 切到库列表 |

#### 笔记页 — 3 个 Action

| Action | 参数 | 行为 |
|--------|------|------|
| `Create a Note` | `title`(必填), `content`(必填), `categories`(逗号分隔, 最多2个) | 创建新笔记并添加到列表 |
| `Delete a Note` | `id`(必填) | 删除指定笔记 |
| `Update a Note` | `id`(必填), `title`(必填), `content`(必填), `categories` | 更新笔记内容 |

#### 测验页 — 1 个 Action

| Action | 参数 | 行为 |
|--------|------|------|
| `Create a Quiz` | `title`(必填), `questions`(对象数组, 必填), `description`, `subjectId`(必填), `topicId`(必填), `difficulty`(必填) | 检查标题重复 → 生成 question ID → `createQuiz()` |

**使用场景**：在气泡里说"帮我生成5张关于光合作用的闪卡"，AI 会调用 `generateFlashcards` action，闪卡页自动切换到学习步骤。

---

## 5. CopilotTextarea 智能输入框

`CopilotTextarea` 来自 `@copilotkit/react-textarea`，提供 AI 自动补全建议。在 3 个页面使用：

### 用法对比

| 页面 | 文件 | 受控方式 | autosuggestionsConfig |
|------|------|----------|----------------------|
| 闪卡 | [flashcards/page.tsx](../src/app/dashboard/flashcards/page.tsx) | `value` + `onValueChange` | `textareaPurpose: "Study material for flashcard generation"`, stop: `[".", "!", "?", ";", ":"]` |
| 流程图 | [flowcharts/page.tsx](../src/app/dashboard/flowcharts/page.tsx) | `value` + `onChange` | `textareaPurpose: "Describe a concept or process…"`, stop: `["\n", "."]` |
| 测验生成 | [quiz-generator.tsx](../src/components/quizzes/quiz-generator.tsx) | `value` + `onValueChange` | `{}` (空配置) |

**注意**：流程图页用的是 `onChange`（标准 React textarea 事件），闪卡和测验用 `onValueChange`（CopilotTextarea 的受控 API）。

---

## 6. CopilotKit 子路由（AI 工具端点）

虽然路径挂在 `/api/copilotkit/*`，但这些端点是普通 JSON HTTP 接口，与 CopilotKit GraphQL 协议解耦。

### 6.1 生成闪卡

**文件**：[api/copilotkit/generate-flashcards/route.ts](../src/app/api/copilotkit/generate-flashcards/route.ts)

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 参数 | `studyMaterial`(必填), `numberOfCards`, `difficulty`, `focusArea` |
| 模型 | `LLM_MODELS.smart` (`openai/gpt-3.5-turbo`) |
| temperature | 0.7 |
| response_format | `{ type: "json_object" }` |
| 返回 | `{ flashcards: [{ id, question, answer, audioReadableAnswer, topic, tags }], metadata }` |

### 6.2 讲解闪卡

**文件**：[api/copilotkit/explain-flashcard/route.ts](../src/app/api/copilotkit/explain-flashcard/route.ts)

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 参数 | `flashcard`(必填), `userQuestion`(必填), `studyMaterial`(可选) |
| 模型 | `LLM_MODELS.fast` (`openai/gpt-4o-mini`) |
| temperature | 0.7 |
| max_tokens | 500 |
| 返回 | `{ explanation: string }` |

### 6.3 生成流程图（代理）

**文件**：[api/copilotkit/generate-flowchart/route.ts](../src/app/api/copilotkit/generate-flowchart/route.ts)

这是一个转发代理，实际生成逻辑在 [api/generate-flowchart/route.ts](../src/app/api/generate-flowchart/route.ts)。

| 项 | 值 |
|----|----|
| 方法 | `POST` |
| 参数 | `concept`(必填), `chartType`(默认 "flowchart"), `complexity`(默认 "detailed") |
| 模型 | `LLM_MODELS.flowchart` (`openai/gpt-4o-mini`) |
| temperature | 0.3 |
| 返回 | `{ success, mermaidCode, chartType, concept }` |

**支持图表类型**：`flowchart`, `sequence`, `class`, `state`, `mindmap`, `timeline`

**`sanitizeMermaidCode`** 后处理：
- 剥离 markdown 代码块
- mindmap 分支：确保有且仅有一个 `root((...))` 节点，不应用 `((text))` 转换
- 非 mindmap 分支：`((text))` → `NODE(["text"])` 等 flowchart 语法转换
- 验证结果以已知图表关键字开头

---

## 7. 统一 LLM 层

**文件**：[lib/llm.ts](../src/lib/llm.ts)

所有 AI 功能最终汇总到这一层。使用原生 `fetch` 调用 OpenAI 兼容协议。

### 7.1 配置

```
LLM_BASE_URL = process.env.LLM_BASE_URL || process.env.OPENAI_BASE_URL || ""
默认 = "https://ai-gateway.vercel.sh/v1"
API_KEY = process.env.LLM_API_KEY || process.env.OPENAI_API_KEY
```

### 7.2 模型配置

| 名称 | 环境变量 | 默认值 | 用途 |
|------|----------|--------|------|
| `chat` | `LLM_MODEL_CHAT` | `openai/gpt-4o-mini` | 主聊天 + CopilotKit Runtime |
| `fast` | `LLM_MODEL_FAST` | `openai/gpt-4o-mini` | 讲解闪卡 |
| `smart` | `LLM_MODEL_SMART` | `openai/gpt-3.5-turbo` | 生成闪卡 |
| `flowchart` | `LLM_MODEL_FLOWCHART` | `openai/gpt-4o-mini` | 生成 Mermaid |
| `quiz` | `LLM_MODEL_QUIZ` | `openai/gpt-3.5-turbo` | 生成测验 |

模型名必须是 `provider/model` 格式（Vercel AI Gateway 要求）。

### 7.3 核心函数

**`runChatCompletionJSON(params)`** — 非流式

```ts
// 返回: { content: string }
const { content } = await runChatCompletionJSON({
  messages, model, temperature, max_tokens, response_format
})
```

- POST 到 `/chat/completions`，`stream: false`
- 解析 JSON 响应，返回 `choices[0].message.content`
- 支持 `response_format: { type: "json_object" }` 强制 JSON 输出

**`runChatCompletionStream(params, handlers)`** — 流式 SSE

```ts
await runChatCompletionStream(
  { messages, model, temperature, max_tokens },
  {
    onToken: (delta: string) => { /* 每个增量 token */ },
    onDone: (fullContent: string) => { /* 流结束，完整文本 */ },
    onError: (err: LLMError) => { /* 出错 */ },
    signal?: AbortSignal,  // 传入后支持取消
  }
)
```

- POST 到 `/chat/completions`，`stream: true`，`Accept: text/event-stream`
- 内部用 `ReadableStream.getReader()` + `TextDecoder` 解析 SSE 帧
- 逐个提取 `choices[0].delta.content` 调用 `onToken`
- 收到 `[DONE]` 或 reader 结束时调用 `onDone(完整文本)`

### 7.4 类型定义

```ts
type ChatRole = "system" | "user" | "assistant"
type ChatMessage = { role: ChatRole; content: string }
type ChatCompletionParams = {
  messages: ChatMessage[]
  model: string
  temperature?: number
  max_tokens?: number
  response_format?: { type?: "json_object" | "text" }
  stream?: boolean
}
class LLMError extends Error {
  status?: number; statusCode?: number; cause?: any; responseBody?: string
}
```

---

## 8. 两套聊天系统的关系

本项目**有意保留两套聊天系统**，用于对比学习：

| 对比项 | CopilotKit 气泡 | 自研聊天页 |
|--------|----------------|------------|
| 入口 | 右下角悬浮气泡（所有 dashboard 页面） | `/dashboard/chat` 页面 |
| 前端 | `<CopilotPopup>` + CopilotKit Provider | 手写 `fetch` + `ReadableStream` reader |
| 后端 | `POST /api/copilotkit`（GraphQL over SSE） | `POST /api/chat/completion`（纯 SSE） |
| LLM 层 | Fake OpenAI Client → `runChatCompletionStream` | 直接调 `runChatCompletionStream` |
| 状态共享 | 可读页面状态（`useCopilotReadable`）+ 触发操作（`useCopilotAction`） | 独立管理，不与其他页面交互 |
| 学习价值 | AI Agent 框架层（Actions / Agents / Hooks） | 底层 SSE / ReadableStream / AbortController 协议层 |

### 数据流对比

```
CopilotKit 路径:
  用户在气泡输入 → CopilotKit Provider → POST /api/copilotkit
  → CopilotRuntime → OpenAIAdapter → FakeClient.beta.chat.completions.stream()
  → createStreamIterable() → runChatCompletionStream() → fetch → Vercel AI Gateway

自研 SSE 路径:
  用户在聊天页输入 → fetch(POST /api/chat/completion, stream:true)
  → ReadableStream → pushText("data: {type:'delta', delta}") → 前端 reader 解析
  → runChatCompletionStream() → fetch → Vercel AI Gateway
```

---

## 9. 关键文件索引

| 层 | 文件 | 职责 |
|----|------|------|
| 前端 Provider | [dashboard/layout.tsx](../src/app/dashboard/layout.tsx) | `CopilotKit` + `HttpAgent` + `CopilotPopup` |
| 后端 Runtime | [api/copilotkit/route.ts](../src/app/api/copilotkit/route.ts) | `CopilotRuntime` + Fake OpenAI Client + SafeAdapter |
| 闪卡 AI 生成 | [api/copilotkit/generate-flashcards/route.ts](../src/app/api/copilotkit/generate-flashcards/route.ts) | 非流式 JSON 生成闪卡 |
| 闪卡 AI 讲解 | [api/copilotkit/explain-flashcard/route.ts](../src/app/api/copilotkit/explain-flashcard/route.ts) | 非流式讲解 |
| 流程图 AI 生成 | [api/generate-flowchart/route.ts](../src/app/api/generate-flowchart/route.ts) | Mermaid 生成 + sanitize |
| 流程图代理 | [api/copilotkit/generate-flowchart/route.ts](../src/app/api/copilotkit/generate-flowchart/route.ts) | 转发到上面 |
| 统一 LLM 层 | [lib/llm.ts](../src/lib/llm.ts) | `runChatCompletionJSON` / `runChatCompletionStream` |
| 自研聊天后端 | [api/chat/completion/route.ts](../src/app/api/chat/completion/route.ts) | SSE 流式 + 非流式 |
| 自研聊天前端 | [dashboard/chat/page.tsx](../src/app/dashboard/chat/page.tsx) | SSE 消费 + 打字机效果 |
| 闪卡页（hooks） | [dashboard/flashcards/page.tsx](../src/app/dashboard/flashcards/page.tsx) | `useCopilotAction` x2 + `useCopilotReadable` + `CopilotTextarea` |
| 流程图页（hooks） | [dashboard/flowcharts/page.tsx](../src/app/dashboard/flowcharts/page.tsx) | `useCopilotAction` x2 + `useCopilotReadable` + `CopilotTextarea` |
| 笔记页（hooks） | [dashboard/notes/page.tsx](../src/app/dashboard/notes/page.tsx) | `useCopilotAction` x3 + `useCopilotReadable` |
| 测验页（hooks） | [dashboard/quizzes/page.tsx](../src/app/dashboard/quizzes/page.tsx) | `useCopilotAction` x1 + `useCopilotReadable` |
| 测验生成器 | [components/quizzes/quiz-generator.tsx](../src/components/quizzes/quiz-generator.tsx) | `CopilotTextarea` (empty config) |
