# Study Sphere CopilotKit 设计与流程详解 (COPILOTKIT_DESIGN.md)

> 本文档用于**系统学习 CopilotKit v1.9.x** 的设计理念、分层架构、握手 & 聊天时序、Service Adapter、Server-side Actions、Agents、常用 Hooks，并结合 Study Sphere 现有代码讲清楚每个概念。
> 本文档对应改动：CopilotKit Provider 已在 [dashboard/layout.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/layout.tsx#L10-L89) 恢复，侧栏 **右下角悬浮气泡**（CopilotPopup）已启用。

---

## 0. 你现在能看到的效果（先跑起来再学）

```bash
# 如果有缓存先清
npm run clean
npm run dev
```

1. 登录进入任一 dashboard 页面（比如 `/dashboard`、`/dashboard/chat`）。
2. 右下角会出现一个**紫色/蓝色的 AI 气泡**——这就是 `CopilotPopup`（AI 助手侧栏气泡）。
3. **F12 → Network 观察请求**（学习的第 1 步，先把协议看清）：
   - 当前已启用 `useSingleEndpoint=true` + Hono single-route，**不会单独发 GET /api/copilotkit/info**（/info 已与 POST 合并在同一 Route Handler 自动托管，独立 info stub 路由文件已删除）
   - 气泡里输入 "你好" → 会发 `POST /api/copilotkit`（body 是 GraphQL + SSE 格式）
   - 如需手动验证 /info 端点仍存在：`curl http://localhost:3000/api/copilotkit/info` 会返回 200 JSON（由 single-route 内部直接处理）
4. **Node 终端**会打印：
   ```
   [CopilotKit route] ✅ ServiceAdapter 构建完成：usingCustomBase=true baseURL=https://ai-gateway.vercel.sh/v1 model=openai:gpt-4o-mini
   [CopilotKit OpenAIAdapter(Vercel-Gateway·FakeClient)] process start userMessages=1 ...
   [CopilotKit OpenAIAdapter(Vercel-Gateway·FakeClient)] process done
   ```
5. 气泡里应该能看到 AI 流式打字回复 ✅。如果报错，先看 Study Sphere 另一份文档 [CHAT_AND_COPILOTKIT_TESTING.md](file:///d:/GITHUB_tmp/study-sphere/docs/CHAT_AND_COPILOTKIT_TESTING.md) 的 2.4 节先把 Token / 模型名跑通。

---

## 1. CopilotKit 是什么？（设计理念）

CopilotKit 不是一个聊天 UI 组件那么简单，它是一个 **"把 LLM Agent 能力嵌入任意 React 应用的框架"**。核心设计理念：

| 设计层面 | CopilotKit 解决了什么 |
|---------|---------------------|
| 🔌 协议统一 | 把"前端 React ↔ 后端 Next.js Route Handler ↔ LLM Provider"之间的握手、GraphQL/SSE 协议、流式传输这些底层细节全部封起来，你不需要自己写 SSE 解析（不像 `/dashboard/chat` 那个自研页面） |
| 🎨 UI 组件即插即用 | 现成 `CopilotPopup`（右下角气泡）、`CopilotSidebar`（右侧大侧栏）、`CopilotChat`（可嵌入任意页面的聊天面板），一行 import 就有 |
| ⚡ Server-side Actions（核心杀手功能） | LLM 不只是"对话"，它能**直接调用你后端注册的 TS 函数**拿数据 / 改数据库，比如"帮我创建 3 张 Java 闪卡" → LLM 自动调你写的 `createFlashcards(subject="Java", count=3)` action |
| 👥 Multi-Agents | 可以注册多个"专家 Agent"，比如 Study Sphere 可以有：大纲 Agent / 出题 Agent / 闪卡 Agent；前端切换 Agent 就切换专家 |
| 📝 Context Aware | 能用 `useCopilotReadable` 把当前页面组件里的 props/state（比如打开的笔记内容、当前闪卡卡组）**注入给 LLM 上下文**，不用用户手动粘贴 |
| 🧩 多 Provider 可切换 | 同一套前端代码，后端换个 ServiceAdapter 就能切 OpenAI / Anthropic / LangChain / Azure OpenAI / Vercel AI Gateway……不用改 UI |

### 1.1 为什么 Study Sphere 保留了"两套聊天"？
| 聊天方案 | 位置 | 适用场景（学习目的） |
|---------|------|------------------|
| 自研聊天页 | [/dashboard/chat](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/chat/page.tsx) | 学 **底层 SSE / ReadableStream / HTTP 协议**：自己发 `fetch`、自己解析 `data:` 帧、自己管 `AbortController`，把 AI 接口的底层打通 |
| CopilotKit 气泡 | 右下角悬浮（[layout.tsx 里的 CopilotPopup](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/layout.tsx#L76-L84)） | 学 **AI Agent 框架层**：不用管 SSE，专注学 `Actions / Agents / useCopilotChat / useCopilotReadable / useCopilotAction` 这些更高阶的能力 |

两套共存的目的：**先把底层搞懂（自研页），再把框架能力吃透（CopilotKit）**，不冲突。

---

## 2. 架构分层图（Study Sphere 现状）

```
┌───────────────────────────────────────────────────────────────────────────────────────────────┐
│  前端 React 层 (所有 dashboard 页面共享的 React 树)                                           │
│                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  🎨 Copilot UI 组件层（@copilotkit/react-ui）                                            │ │
│  │     CopilotPopup（右下角气泡 / 现在已启用）                                               │ │
│  │     CopilotSidebar（右侧大面板 / 未用，可加）                                             │ │
│  │     CopilotChat（可嵌入页面 / 未用，可加）                                                │ │
│  │     CopilotTextarea（AI 自动补全 textarea / package.json 已装，可加）                     │ │
│  └──────────────────────────────┬──────────────────────────────────────────────────────────┘ │
│                                 │ props / React Context                                       │
│  ┌──────────────────────────────▼──────────────────────────────────────────────────────────┐ │
│  │  🧠 React Core 状态层（@copilotkit/react-core）                                          │ │
│  │     ┌────────────────────────────────────────────────────────────────────────────────┐  │ │
│  │     │ <CopilotKit runtimeUrl="/api/copilotkit"> Provider                             │  │ │
│  │     │   - 存储 visibleMessages（AI + 用户消息列表）                                   │  │ │
│  │     │   - 存储 isLoading / runtimeConnectionState                                   │  │ │
│  │     │   - 暴露 Hooks：useCopilotChat / useCopilotReadable / useCopilotAction ...    │  │ │
│  │     └──────────────────────────────┬─────────────────────────────────────────────────┘  │ │
│  └────────────────────────────────────┼─────────────────────────────────────────────────────┘ │
└───────────────────────────────────────┼───────────────────────────────────────────────────────┘
                                        │ HTTP (fetch)
                                        │ GET /api/copilotkit/info (握手)
                                        │ POST /api/copilotkit (GraphQL over SSE)
┌───────────────────────────────────────▼───────────────────────────────────────────────────────┐
│  后端 Next.js App Router 层                                                                    │
│                                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────────────────────────┐ │
│  │  🌊 Single-Route (Hono)：同时托管握手 GET /info 和 POST 运行时                            │ │
│  │  src/app/api/copilotkit/route.ts → 同时监听 GET /info（返回 capabilities/agents/actions）│ │
│  │                        + POST（GraphQL over SSE · copilotRuntimeNextJSAppRouterEndpoint）│ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
│  │    ┌───────────────────────────────────────────────────────────────────────────────┐    │ │
│  │    │ CopilotRuntime（状态机：解析 GraphQL 请求 / 路由 / 合并上下文 / 发 SSE 响应） │    │ │
│  │    │   ↓                                                                             │    │ │
│  │    │ ServiceAdapter（本项目主要方案）                                                │    │ │
│  │    │   · OpenAIAdapter + FakeClient(本项目自定义) → 接 Vercel AI Gateway / 自建 OpenAI 兼容中转│    │ │
│  │    │   ↓                                                                             │    │ │
│  │    │ (未来可加) Server-side Actions / Agents                                        │    │ │
│  │    └───────────────────────────────────────────────────────────────────────────────┘    │ │
│  └─────────────────────────────────────────────────────────────────────────────────────────┘ │
└───────────────────────────────────────┬───────────────────────────────────────────────────────┘
                                        │ HTTPS (Bearer Token)
┌───────────────────────────────────────▼───────────────────────────────────────────────────────┐
│  LLM Provider 层                                                                               │
│  · Vercel AI Gateway（当前 .env.local 默认）：openai:gpt-4o-mini / openai:gpt-3.5-turbo    │
│  · 未来：Anthropic / Azure OpenAI / 任意 OpenAI-compatible 自建中转                          │
└───────────────────────────────────────────────────────────────────────────────────────────────┘
```

> ℹ️ **关于握手端点 /info 的说明（2026-09-08 架构更新）**：
> 上图中单独的 "src/app/api/copilotkit/info/route.ts" 文件**已删除**。现在握手探测由 Hono single-route 模式自动处理：
> - `src/app/api/copilotkit/route.ts` 同时监听 GET（/info）和 POST 两种请求；
> - 前端开启 `useSingleEndpoint={true}` 后，不再单独请求 /info，所有信息都走同一端点；
> - 另外前端通过 `agents__unsafe_dev_only={{ default: new HttpAgent({``url``: "/api/copilotkit", ``description``: "..."}) }}` 从 **@ag-ui/client** 显式注册 agent，解决 v1.9+ 常见的 `useAgent: Agent 'default' not found` 错误。

---

## 3. 前端 3 个 npm 包（分别装了什么）

看 [package.json](file:///d:/GITHUB_tmp/study-sphere/package.json#L17-L20)：

```json
"@copilotkit/react-core":     "^1.9.0",   // ← 必装：状态层（Provider / Hooks / Context）
"@copilotkit/react-ui":       "^1.9.0",   // ← 必装：UI 组件（Popup / Sidebar / Chat）
"@copilotkit/react-textarea": "^1.9.0",   // ← 可选：给 <textarea> 加 AI 自动补全
"@copilotkit/runtime":        "^1.9.0"    // ← 必装：后端 Service（Runtime + Adapters）
```

分别学什么：

### 3.1 @copilotkit/react-core — Provider + Hooks
**最重要的包**。UI 组件只是它的外观，真正"把应用变成 Copilot"的是这个包的 4 样东西：

1. **`<CopilotKit runtimeUrl="/api/copilotkit">`**：React Context Provider，**必须包在你要用到 Copilot 功能的最外层**（Study Sphere 里包在 [dashboard/layout.tsx:L64](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/layout.tsx#L64-L88)，所以任一 dashboard 页面都能用气泡 / Hooks）。
   - Props 重点：
     - `runtimeUrl`：后端端点，必须匹配你 Route Handler 的路径（本项目 `/api/copilotkit`）。
     - `showDevtools`：传 `true` 时弹出 CopilotKit 官方 DevTools（调试时强烈推荐开启）。
     - `agent`：切换默认 Agent（多 Agent 场景）。
     - `headers`：自定义 Header（比如传你的 JWT，默认会带浏览器 Cookie）。

2. **`useCopilotChat()` Hook** — 手动控消息（类似自研页的 `useState` 但是官方封装版）：
   ```tsx
   const { visibleMessages, appendMessage, reloadMessages, stopGeneration, isLoading } = useCopilotChat();
   // visibleMessages    → TextMessage[] / 类似自研页 messages 数组
   // appendMessage(msg) → 手动塞一条消息（不会走 LLM，比如初始化"系统提示词"）
   // reloadMessages()   → 重跑最后一条消息（类似 ChatGPT 再生成一次）
   // stopGeneration()   → 停掉正在流式输出的请求（对应自研页的 abortController.abort()）
   // isLoading          → 是否在等待 LLM（对应自研页 isGenerating）
   ```

3. **`useCopilotReadable(description, value)` Hook** — **上下文注入**。这是 CopilotKit 最酷的功能之一，意思是：
   > "把我当前组件里的这个 JS 变量/状态，以一段可读描述的形式塞给 LLM 上下文，LLM 问相关问题时它自动知道"。
   样例（你可以在闪卡学习页写一个试试）：
   ```tsx
   // 假设当前打开了一个 deck（卡组），有 10 张卡，用户已经复习了 3 张
   useCopilotReadable("当前正在学习的闪卡卡组信息", {
     deckName: "Java 集合框架",
     totalCards: 10,
     reviewedCount: 3,
     lastCardQuestion: "HashMap 和 Hashtable 的区别？",
   });
   // ↓ 之后你在气泡里问："我刚才复习那张 HashMap 的题没懂，再讲一下"
   // LLM 会"神奇地知道"你在说哪张卡，不用手动粘贴！
   ```

4. **`useCopilotAction<T>({name, description, parameters, handler})`** — **客户端 Action**（LLM 直接调用浏览器里的 TS 函数）。跟 Server-side Actions 对应，区别：Server-side Action 在后端调，Client-side 在浏览器调。

### 3.2 @copilotkit/react-ui — 现成 UI 组件
Study Sphere 现在用的是 `CopilotPopup`（右下角气泡）。你可以后续自己替换/添加：

| 组件 | 用途 | 替换方式 |
|------|------|---------|
| `CopilotPopup`（当前在用） | 右下角小气泡，适合"全局 AI 助手" | 删掉 Popup → 换成 `CopilotSidebar` |
| `CopilotSidebar` | 右边拉开的大侧栏，适合"代码 Copilot 式"的 AI 面板 | 放在 layout 里的 `<main>` 旁 |
| `CopilotChat` | 不带外层 UI 的纯聊天面板，适合嵌入某个特定页面（比如在闪卡页内嵌一个"AI 讲解"聊天面板） | 放在 `decks/[id]/study/page.tsx` 内部 |

`CopilotPopup` 常用 props（现在 layout 里已经用了一部分）：
```tsx
<CopilotPopup
  defaultOpen={false}                 // 第一次进页面要不要默认展开
  hitBreakpoints={[768, 1024]}        // 响应式断点
  className="..."                     // 外层样式
  clickOutsideToClose={true}          // 点外面自动关
  labels={{                           // 全部可以中文化
    title: "学习助手",
    initial: "我是 AI 学习助手，有啥可以帮你的？",
    placeholder: "输入你的问题（笔记/闪卡/测验…）…",
    send: "发送",
    stop: "停止",
  }}
  instructions="你是一个耐心的学习助手，回答多用中文，适当举例子。"  // ← 全局 System Prompt
/>
```
> 💡 `instructions` 是最常用的 prop：相当于给这个 CopilotPopup 定"人设"，不用每次在消息里说。

### 3.3 @copilotkit/react-textarea — AI 自动补全
对应 `@copilotkit/react-textarea` package。场景：在笔记页/出题页，用户输入到一半，按 `Tab` 自动让 AI 帮他续写。
文档地址：CopilotKit 官方 docs 搜 `CopilotTextarea`。安装已经装好了，你可以在 `notes/page.tsx` 里加一个练练手（学习顺序靠后，先把 Actions 搞懂）。

---

## 4. 后端 Service：@copilotkit/runtime（核心 3 件事）

对应 [api/copilotkit/route.ts](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/route.ts)。这个文件就是 CopilotKit 的后端大脑。学后端时 100% 围绕它。

### 4.1 三剑客：Runtime + Adapter + Endpoint Helper
每个 CopilotKit 后端 Route 都长这样（Study Sphere 第 290~295 行）：
```ts
const runtime = new CopilotRuntime();                          // ① Runtime：协议状态机
const adapter = new OpenAIAdapter({ openai, model }) ;         // ② Service Adapter：连接具体 LLM
const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({  // ③ Endpoint Helper：把 Next Request/Response 对接给 Runtime
  runtime, serviceAdapter: adapter, endpoint: "/api/copilotkit",
});
return handleRequest(req);                                     // 就这么一行把 GraphQL/SSE 协议全兜住
```

- **① Runtime**：最"虚"但最重要，你不用直接改它，它做了这些：
  1. 解析前端发来的 GraphQL body（里面有 `frontentInstructions`、`messages`、`actionCalls`、`agentName`、`readableState` …）
  2. 合并 context：前端 `useCopilotReadable` 塞进来的上下文 + 后端 server-side instructions + actions 描述
  3. 选一个 Agent（未来可扩展多 Agent 路由）
  4. 让 Adapter 调 LLM 拿到回复 / tool call
  5. 如果 LLM 要求调 action，就去执行 actions 函数，再把 action 返回值塞给 LLM 二次推理（多轮 tool-use loop）
  6. 用 SSE 把结果 chunk by chunk 推回前端。

- **② Service Adapter**：最"实"的一层，**直接决定你接哪家 LLM**。CopilotKit 官方 Adapter 列表：
  | Adapter 名 | 需要什么 client | 适用场景 | Study Sphere 是否用到 |
  |---|---|---|---|
  | `OpenAIAdapter` | `new OpenAI({apiKey, baseURL})` | OpenAI 官方、Azure OpenAI、Vercel Gateway、**任何 OpenAI-compatible 自建中转** | ✅（现在 Vercel Gateway 主要用这个） |
  | `LangChainAdapter` | LangChain `Runnable` | 你接了 LangChain Chain / Agent | ❌（可以自己装 langchain） |
  | `AnthropicAdapter` | Anthropic SDK | Claude 官方直连 | ❌ |
  | `GoogleGenerativeAIAdapter` | Google SDK | Gemini 直连 | ❌ |

- **③ Endpoint Helper**（`copilotRuntimeNextJSAppRouterEndpoint`）：Next.js 专用 glue，其他框架有各自对应的 helper（比如 Nuxt、Express）。它做了：
  - 自动处理 NextRequest / NextResponse 的 SSE header（`Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`）
  - 自动处理 CORS（如果 runtimeUrl 在不同域名，一般 CopilotKit 本地 Next.js 不需要）
  - 自动把 POST body 转成 Runtime 能吃的 request object

### 4.2 Study Sphere 对 Adapter 的关键改进（必须理解）
原始的 Adapter + 原生 SDK 组合在 Vercel Gateway 场景**会翻车**，我们在 [api/copilotkit/route.ts 第 82~226 行](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/route.ts#L82-L226) 写了两个增强：

**改进 A：`createSafeAdapter(baseAdapter, label)`（Proxy 包装器，第 23~80 行）**
作用：
1. **打详细日志**：process start / done / error，方便你对比 Node 终端。
2. **错误兜底避免前端卡死**：以前如果 Adapter.process 抛错（比如 Vercel Token 错），`eventSource` 不会 complete → 前端气泡的 loading 三个点**永远转**。现在 SafeAdapter 在错误分支里会主动调：
   ```ts
   es$.sendTextMessageStart()
   es$.sendTextMessageContent("❌ Invalid authentication token (HTTP 401)")
   es$.sendTextMessageEnd()
   es$.complete()
   ```
   → 前端会直接看到一句话错误，不会卡住。
3. **重新 throw**：让 CopilotKit 前端把错误也打印出来（双保险）。

**改进 B：`makeFakeOpenAIClient()` 鸭子类型 client（第 91~226 行）**
**为什么不能直接用官方 OpenAI SDK `new OpenAI({baseURL: LLM_BASE_URL_USED, apiKey})`？**
→ 部分 SDK 有一个"自作主张"的特性：只要你传了自定义 baseURL，它内部会**强制再拼一层 `/openai/v1`**。
→ Vercel Gateway 的路径是 `/v1/chat/completions`，拼完就变成 `/v1/openai/v1/chat/completions` → 404。

解法：不依赖任何 SDK，**手写一个假的 OpenAI 客户端**（鸭子类型，只实现 OpenAIAdapter 真正会调用的那一个方法 `chat.completions.create()`），内部直接调用 `src/lib/llm.ts` 里已经跑通的 `runChatCompletionJSON` / `runChatCompletionStream`：
```
OpenAIAdapter.process()
  → 调 this.openai.chat.completions.create({ stream: true, messages, model })
    → 我们 FakeClient 的 create() 被调用
      → 调 runChatCompletionStream(callParams, { onToken, onDone, onError })
        → 内部原生 fetch(`${LLM_BASE_URL_USED}/chat/completions`, ...)
          → ✅ 路径精确，不会多加前缀
      → FakeClient 把 onToken 的回调包装成一个 AsyncIterator（OpenAI SDK stream 的返回格式）
    → OpenAIAdapter 拿到 chunks，再通过 Runtime 以 CopilotKit 协议推给前端
```
→ 这样 CopilotKit 学习完全聚焦在框架本身，不用在 SDK 路径 bug 上浪费时间。

---

## 5. 握手流程详解（为什么以前 404 会导致所有消息发不出去？）
这是学习 CopilotKit 必须过的第一关。**在它发任何聊天消息之前，会先发一个握手探测。**

### 5.1 握手时序图
```
  浏览器 React 树                         Next.js 后端 (/api/copilotkit/info)
        │                                            │
        │ <CopilotKit Provider 挂载 (useEffect)>      │
        │────────────────────────────────────────────▶│
        │  GET /api/copilotkit/info                   │
        │   (Accept: application/json)                │
        │                                            200 JSON {
        │◀────────────────────────────────────────────│    protocol: "copilotkit-http",
        │                                                version:  "1.0.0",
        │                                                capabilities: {actions,agents,chat},
        │                                                agents:   [...],
        │                                                actions:  [...]
        │                                              }
        │
        │ Provider 更新 runtimeConnectionState="connected"
        │ （连接态= 可发消息；如果握手失败，就是"failed"）
        │
        │ 用户在 CopilotPopup 输入"你好" → 点发送
        │────────────────────────────────────────────▶│
        │  POST /api/copilotkit                        │
        │   (GraphQL + SSE body)                       │
        │◀────────────── (streaming chunks) ───────────│
```

> ⚠️ **架构更新说明**：采用 Hono single-route + `useSingleEndpoint={true}` 后，前端的"单独 GET /info 握手请求"**实际上不会被发送**（运行时会走单一路径）。但 CopilotKit 内部仍然按"先判握手可达、再发消息"的逻辑运行，只是 /info 和 POST 合并在一个 Route 文件里响应。以下时序逻辑仍然成立（只是 HTTP 调用被 single-route 优化了）。

### 5.2 如果握手失败会发生什么？（关键坑点）
- 握手端点**404**：Provider 内部设 5 秒超时 → 报：
  ```
  Code: runtime_info_fetch_failed
  Runtime did not answer within 5000ms (reason: no-answer)
  ```
- ⚠️ **握手失败 ≠ "只是 Console 红了一下"**：CopilotKit 会判定 Runtime 不可达，**拒绝发送后续任何 POST /api/copilotkit 请求**。所以你会看到"用户点了发送但 Node 终端一点反应都没有"，这就是原因。
- 这就是为什么现在要做（single-route 模式）：
  1. [api/copilotkit/route.ts](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/route.ts) 必须同时响应 GET /info（200 JSON）和 POST；不再有独立 info 文件。
  2. `capabilities.chat` 必须为 `true`，否则虽然握手成功，但 CopilotPopup 的发送按钮会灰掉不让发。
  3. 前端必须开启 `useSingleEndpoint={true}` 并通过 `agents__unsafe_dev_only` 注册至少一个 agent（@ag-ui/client 的 HttpAgent），否则会报 `Agent 'default' not found`。

### 5.3 握手端点里的 agents / actions 字段是干嘛的？
握手返回里 `agents` 和 `actions` 两个数组现在都是空的 `[]`，但它们其实是 **Server-side Actions / Agents 元信息下发的通道**：
```ts
// 未来你注册了这些后端能力时，info 返回会变成：
{
  actions: [
    {
      name: "createFlashcards",
      description: "创建 N 张某主题的闪卡并保存到数据库",
      parameters: { subject: "string", count: "number" },
    },
    { name: "generateQuiz", ... },
  ],
  agents: [
    { name: "flashcard-expert", description: "闪卡专家" },
    { name: "quiz-expert", description: "出题专家" },
  ],
}
```
→ 前端 Provider 拿到这个列表，把它**注入给 LLM System Prompt 或 Tool Schema**，LLM 就会在合适的时机：
> "好的，我现在帮你调用 createFlashcards(subject='数学', count=5) 创建闪卡。"
→ 这就是 Actions / Agents 的核心闭环（详见 §7）。
> 💡 以上元信息下发机制在 single-route 模式下仍然有效，只是返回内容的静态文件 info/route.ts **已不复存在**，而是写在 /api/copilotkit/route.ts 的 Hono app.get('/info', ...) 内部（或直接由 single-route helper 默认返回）。

---

## 6. 聊天流程时序图（一条消息从前端打字到流式显示的全链路）

```
  【浏览器】                                                     【Next.js 后端】                           【Vercel AI Gateway / OpenAI 兼容后端】
       │                                                               │                                          │
       │ 用户在 CopilotPopup 输入："Java HashMap 原理"                  │                                          │
       │  按下 Enter                                                   │                                          │
       │                                                               │                                          │
       │ useCopilotChat().appendMessage( TextMessage{role:human, ...}) │                                          │
       │  Provider 把 visibleMessages +1（UI 上立即出现用户气泡）        │                                          │
       │                                                               │                                          │
       │  POST /api/copilotkit (fetch + ReadableStream body="graphql") │                                          │
       │──────────────────────────────────────────────────────────────▶│                                          │
       │        body 内含：messages / frontendInstructions /           │                                          │
       │                 readableState / agentName / actionCalls ...   │                                          │
       │                                                               │                                          │
       │                                                               │ copilotRuntimeNextJSAppRouterEndpoint      │
       │                                                               │   ↓ parse body                            │
       │                                                               │   ↓ new CopilotRuntime().process({         │
       │                                                               │       messages, serviceAdapter, ...       │
       │                                                               │     })                                    │
       │                                                               │   ↓                                       │
       │                                                               │ SafeAdapter.process() 【打印 start 日志】 │
       │                                                               │   ↓                                       │
       │                                                               │ OpenAIAdapter.process()               │
       │─────────────── SSE 帧 1: 流开始 ────────────────│ Adapter.process()                          │
       │◀──────────────────────────────────────────────────────────────│         .stream()                          │
       │ (event: message-start)  → UI 出现 AI 气泡，内容为空                │ ↓ openai.chat.completions.create(stream=true) │
       │─────────────── SSE 帧 2: delta ────────────────────────────────────────────────────────────────────────────────▶
       │◀──────────────────────────────│ AAAAAA.delta 1 ──────────────│◀────────── delta 1: "哈希" ──────────────────────│
       │ Provider 把 delta 追加到 visibleMessages → UI 显示"哈"              │                                          │
       │─────────────── SSE 帧 3: delta ────────────────────────────────────────────────────────────────────────────────▶
       │◀──────────────────────────────│ AAAAAA.delta 2 ──────────────│◀────────── delta 2: "表 的" ─────────────────────│
       │ Provider 再追加 → UI 显示"哈希表的"                              │                                          │
       │                               ... 重复几百个 delta 帧 ...    │                                          │
       │─────────────── SSE 帧 N: complete ─────────────────────────────────────────────────────────────────────────────
       │◀──────────────────────────────│ AAAAAA.complete ─────────────│                                          │
       │ Provider complete() → isLoading=false → 取消三个点 loading        │                                          │
       │                                                               │ 打印 process done 日志                     │
       │                                                               │                                          │
```

### 6.1 Adapter.process() 内部的关键 API：`eventSource.stream(es$ => {...})`
CopilotKit Adapter 协议有一个很重要的约定：**不要 `return` 字符串**。要用 `eventSource.stream()` 推送事件。
学习时记住这个对比（摘自我们之前 SafeAdapter 错误兜底的写法）：

```ts
// ❌ 错误方式：直接 return 字符串
// → CopilotKit 前端的 visibleMessages 不会更新，UI 上 AI 气泡一直空（转 loading 然后消失）
async process(request) {
  return [{ role: "assistant", content: "你好" }];
}

// ✅ 正确方式：通过 eventSource.stream() 推 4 件事
// → 这样前端才会流式显示（不开流也得按这个格式，才能一次性显示完整）
async process(request) {
  const { eventSource } = request;
  return eventSource.stream(async (es$) => {
    es$.sendTextMessageStart();                                      // 1. 告诉前端"我要开始发 AI 消息了"
    es$.sendTextMessageContent("你好，我是");                         // 2. 发第 1 段文本
    es$.sendTextMessageContent("学习助手。");                         // 3. 发第 2 段文本（可多次调用 = 流式）
    es$.sendTextMessageEnd();                                        // 4. 告诉前端"这条 AI 消息结束"
    es$.complete();                                                  // 5. 本次会话结束（loading 三个点取消）
  });
}
```
> ⚠️ 早期版本我们踩过的坑（summary 里第 11 条事实）就是：Adapter 里直接 return 数组，前端看不到任何回复。**现在在 Vercel Gateway FakeClient 方案里，这一步是 OpenAIAdapter 内部帮我们做的**，你不用自己写；但理解它，才能自己写 Actions 和自定义 Adapter。

---

## 7. Server-side Actions（CopilotKit 学习重点：让 LLM 能"操作你的应用"）

Actions 是 CopilotKit 最核心的差异化能力。简单一句话：
> **Server-side Action = 一个在后端 Route Handler 里注册的普通 TS 函数，但 LLM 能自动按描述决定何时调用、填什么参数、并把返回结果再喂给 LLM 总结。**

### 7.1 Study Sphere 里最适合先练的 4 个 Action 示例
| Action 名 | 描述（告诉 LLM 什么时候调） | 参数（parameters） | handler 里实际做什么（你可以练习写） |
|---|---|---|---|
| `createFlashcards` | "当用户要求批量创建闪卡时调用" | `{ subject: string, count: number, difficulty?: string }` | 调 `src/app/api/copilotkit/generate-flashcards/route.ts` 里相同逻辑，保存到 DB，返回"创建成功 N 张卡" |
| `generateQuiz` | "当用户要求出测验题时调用" | `{ subjectId: number, topicId: number, numQuestions: number }` | 调生成测验的逻辑，返回"已创建测验 ID=xxx" |
| `listMyTasksDueToday` | "当用户问今天要做什么 / 今日任务时调用" | `{}` | 从 DB tasks 表里查 `userId=当前用户, dueDate=today`，返回列表字符串 |
| `showFlashcardStats` | "当用户问我闪卡学得怎么样时调用" | `{ lastDays?: number }` | 查 DB daily_reviews，返回"最近 N 天你复习了 XX 张，正确率 YY%" |

### 7.2 怎么注册？（往 Runtime 上挂的 API）
在 `new CopilotKit()` 的构造器里或 `runtime.register` 里加：
```ts
// 你可以在 Study Sphere 的 api/copilotkit/route.ts 第 20 行后面加这段练手：
import { Action, copilotkit } from "@copilotkit/runtime";

const listTodayTasksAction: Action = {
  name: "listMyTasksDueToday",
  description: "当用户询问今日待办、今天要做什么、今日任务截止情况时，调用这个函数查询",
  parameters: [
    { name: "includeCompleted", type: "boolean", description: "是否包含已完成的任务，默认 false", required: false },
  ],
  handler: async ({ userId }, params) => {
    // 1) userId 从哪里来？在 runtime.process() 之前解析 JWT cookie 注入 request 里即可（后续进阶练习）
    // 2) 查 DB：
    const include = params.includeCompleted ?? false;
    const rows = await db.select(...).from(tasks).where(eq(tasks.userId, userId), ...);
    // 3) 返回一段 LLM 能理解的字符串/JSON：
    return `今天共有 ${rows.length} 条待办：\n` + rows.map(r => `- [${r.priority}] ${r.title} (due ${r.dueDate})`).join("\n");
  },
};

// 挂到 Runtime 上（改构造器参数或用 register）：
const copilotKit = new CopilotRuntime({
  actions: [listTodayTasksAction, createFlashcardsAction, ...],
});
```
注册完之后，再打开 `GET /api/copilotkit/info`，你就会看到 `actions` 数组里多了一项——握手流程里 LLM 会收到这份 Tool Schema，然后它自己会决定"什么时候该调 action"。

### 7.3 Tool-use 闭环（一条消息里 LLM 调 Action 的全流程）
```
用户问气泡："今天我要做什么？"
  │
  ↓
Runtime 把消息 + actions 列表（schema + description）发给 LLM
  │
  ↓ LLM 决定："这个问题应该调用 listMyTasksDueToday(includeCompleted=false)"
  │ （它不直接返回"我查一下"的字符串，而是返回一个 tool call object）
  │
  ↓ Runtime 拦截到 tool_call → 执行 handler → 得到字符串结果
  │
  ↓ Runtime 再构造第二轮请求，把：
      【原消息 + tool_call 指令 + tool_return 字符串】 一起重新发给 LLM
  │
  ↓ LLM 第二次推理："根据查到的 3 条任务，我给用户总结一下：
      你今天有 3 个待办：1. 复习数学 ... 2. ... 3. ..."
  │
  ↓ 通过 SSE 流式推给前端
```
→ 这就是 Agent 的本质：LLM 不只是回答，它能**按工具的定义正确地自己选工具、自己调、再基于工具结果回答**。

---

## 8. Agents（进阶：多个专家 Agent 切换）

当 actions 变多之后（比如同时有闪卡、测验、笔记、流程图的 actions），一个 LLM 容易"选错工具"。这时可以拆 Agents：
```ts
// new CopilotRuntime({ agents: [...] }) 里注册
agents: [
  {
    name: "flashcard-expert",
    description: "擅长闪卡生成、复习规划。用户提到闪卡/卡组/复习时优先选。",
    model: "openai:gpt-3.5-turbo",  // 专家可用更聪明的模型
    instructions: "你是一位闪卡学习专家，回答多用例子。",
    actions: [createFlashcardsAction, showFlashcardStatsAction, ...],  // 只挂闪卡相关 action
  },
  {
    name: "quiz-expert",
    description: "擅长出题、测验。用户提到测验/出题/练习/考试时选。",
    model: "openai:gpt-3.5-turbo",
    actions: [generateQuizAction, ...],
  },
  {
    name: "general-helper",     // 默认 Agent
    description: "通用学习助手。",
    model: "openai:gpt-4o-mini",
    actions: [listTodayTasksAction, ...],
  },
]
```
前端怎么切？两种方式：
```tsx
// A. 在 Provider 上直接切（所有组件共享一个默认 agent）：
<CopilotKit runtimeUrl="/api/copilotkit" agent="flashcard-expert">

// B. 在组件里动态切（比如闪卡页打开时切到闪卡专家）：
const { setAgent } = useCopilotContext();
useEffect(() => { setAgent("flashcard-expert"); return () => setAgent("general-helper"); }, []);
```

---

## 9. 快速上手练习顺序（1~7 步，按顺序学）
结合本项目现有代码，建议按这个顺序动手，每一步做完都能在浏览器里看到效果：

| 步骤 | 练习内容 | 你要改的文件 / 加的代码 | 验证方式 |
|------|---------|----------------------|---------|
| 1 | ✅ **已自动完成**：确认 Provider 正常 → 浏览器打开任一 dashboard 页面 → F12 看请求。当前 useSingleEndpoint 模式不会单独发 GET /info；可手动执行 `curl http://localhost:3000/api/copilotkit/info | jq`，返回 JSON 中 capabilities.chat=true 且 agents/actions 至少有一个 key，右下角 CopilotPopup 气泡可点开。 | 无 404 无红色报错；右下角气泡可点开 |
| 2 | 让 AI 回复中文人设 | 在 [layout.tsx 的 CopilotPopup](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/layout.tsx#L76-L84) 上加 prop：`instructions="你是中文学习助手，永远用简体中文回答，适当举例子"` | 气泡问英文问题它仍然回中文 |
| 3 | 打开 CopilotKit DevTools | `CopilotKit` 加 prop：`showDevtools={true}` | 浏览器里多一个 Copilot 控制台，能看 messages / tool calls |
| 4 | 写一个**最简单的 Server-side Action**（如返回时间） | 在 [api/copilotkit/route.ts](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/route.ts) 里挂一个 `getCurrentTime` action（description="当用户问现在几点时调用"） | 气泡问"几点了"，DevTools 能看到 tool_call，UI 上 AI 回答正确时间 |
| 5 | 写一个**读 DB 的 Action**（如 §7.1 `listMyTasksDueToday`） | 同上，handler 里解析 JWT（从 req.cookie）→ 调 drizzle 查 tasks 表 → 返回字符串 | 气泡问"今天我要做什么"，能看到真实 DB 里的数据 |
| 6 | 写一个**写 DB 的 Action**（如 §7.1 `createFlashcards`） | handler 调闪卡生成逻辑 + 调 drizzle insert into flashcards + insert into decks | 气泡说"帮我创建 5 张 Java 多线程闪卡"，然后去闪卡页能看到新卡组 |
| 7 | 上 **Multi-Agents** | 在闪卡学习页用 `useEffect(()=>setAgent("flashcard-expert"))`；在测验页用 setAgent("quiz-expert") | 两个页面分别问问题，只允许调用各自 action，推理质量提升 |

每完成一步你就对 CopilotKit 多一分理解。1~3 步 5 分钟能搞定；4~5 步 1 小时；6~7 步半天。

---

## 10. 文件索引（全链路相关源码绝对路径）

| 功能层 | 文件 | 说明 |
|--------|------|------|
| 前端 Provider + 气泡 UI | [dashboard/layout.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/layout.tsx#L10-L89) | `CopilotKit` 包所有 dashboard + 右下角 `CopilotPopup` |
| 前端 HttpAgent 注册 | [dashboard/layout.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/layout.tsx#L30-L36) | 从 @ag-ui/client 引入 HttpAgent，通过 agents__unsafe_dev_only 注册 key=default 的 agent（不要在构造参数里写 name） |
| 自研聊天页（对比学习用） | [dashboard/chat/page.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/chat/page.tsx) | 自己写的 SSE/useState/useRef 流式聊天 |
| 后端 /info 握手 & POST 运行时（single-route 合并） | [api/copilotkit/route.ts](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/route.ts) | Hono 单文件同时托管 GET /info 和 POST；capabilities.chat=true，agents/actions 至少有返回值 |
| 后端 Runtime 主端点 | [api/copilotkit/route.ts](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/route.ts) | 本文件就是本项目的 Copilot 大脑，重点读：SafeAdapter、makeFakeOpenAIClient、buildServiceAdapter、Endpoint Helper 调用 |
| 统一 LLM 层（所有 AI 最终汇总在这里） | [lib/llm.ts](file:///d:/GITHUB_tmp/study-sphere/src/lib/llm.ts) | 自定义 Base (Vercel AI Gateway) → 原生 fetch；OpenAI 兼容协议；非流式 runChatCompletionJSON；流式 runChatCompletionStream |
| 测试文档（curl / Postman / 样例） | [CHAT_AND_COPILOTKIT_TESTING.md](file:///d:/GITHUB_tmp/study-sphere/docs/CHAT_AND_COPILOTKIT_TESTING.md) | 每一步 curl 示例 + 成功/失败响应样例 + 排错表格 |
| 系统功能清单 | [FEATURES.md](file:///d:/GITHUB_tmp/study-sphere/docs/FEATURES.md) | 所有功能模块 + 对应 API/页面总览 |
| 依赖版本 | [package.json](file:///d:/GITHUB_tmp/study-sphere/package.json#L17-L20) | @copilotkit/* 四个包版本：v1.9.x |

---

## 11. 常见学习坑速查
| 坑 | 现象 | 原因 | 解 |
|----|------|------|----|
| K1 | 气泡 loading 三个点永远转，不出现文字 | 自定义 Adapter.process 里直接 return 字符串，没走 eventSource.stream()；或 LLM Token 错，SafeAdapter 调 complete() 之前先崩了 | 看 Node 终端：是否打印 process error？然后按 SafeAdapter 错误兜底那段修你的 action handler |
| K2 | 点击发送后 Node 没反应，前端 Console 只有 runtime_info_fetch_failed | 握手失败（§5） | 检查 GET /api/copilotkit/info：路径是否 404？返回 JSON capabilities.chat 是否 true？ |
| K3 | 消息能发，但回复是 401 / model not found / 429 | LLM 配置错 | 先调 CHAT_AND_COPILOTKIT_TESTING.md 1.4 节的非流式 curl 把 Token / 模型名跑通，再试气泡 |
| K4 | 回复中出现 `/v1/openai/v1 404` | 自定义 Base 时直接用了官方 SDK（它会强制加前缀） | 用本项目 FakeClient（makeFakeOpenAIClient）方案，而不是直接塞 SDK client |
| K5 | Server-side Action 写了但 LLM 永远不调用它 | description 没写清楚，或 parameters schema 写错了 | 把 action 的 description 写得越具体越好（"当用户提到 XX/YY/ZZ 时调用"）；参数写成 JSON schema 要完整（type/description/required） |
| K6 | useCopilotReadable 没生效 | 放在 Provider 子树外 / 描述没写清楚 | 确保 Hook 在 `<CopilotKit>` 内；description 写成"当前 XX 的状态/内容"，value 是 plain object（不要给 React Ref 这种不可序列化对象） |

祝学习顺利！先把第 9 节的 1~3 步跑通（5 分钟），再按 4~7 步把 Actions / Agents 一个个加上，很快就能吃透 CopilotKit。
