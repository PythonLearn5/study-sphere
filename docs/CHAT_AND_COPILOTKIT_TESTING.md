# Study Sphere 聊天 & CopilotKit 测试指南

> 本文档覆盖两条 AI 链路的测试方法：
> 1. **自研聊天**：`/dashboard/chat` 页面 + `/api/chat/completion` 流式 SSE 接口
> 2. **CopilotKit 气泡**：右下角悬浮气泡 + `/api/copilotkit` Runtime 端点 + AI 工具端点

相关文件索引：
- 聊天前端：[dashboard/chat/page.tsx](../src/app/dashboard/chat/page.tsx)
- 聊天后端 SSE：[api/chat/completion/route.ts](../src/app/api/chat/completion/route.ts)
- 聊天历史 CRUD：[api/chats/route.ts](../src/app/api/chats/route.ts)
- 统一 LLM 调用层：[lib/llm.ts](../src/lib/llm.ts)
- CopilotKit 运行时：[api/copilotkit/route.ts](../src/app/api/copilotkit/route.ts)
- Dashboard Provider：[dashboard/layout.tsx](../src/app/dashboard/layout.tsx)
- 闪卡 AI 生成：[api/copilotkit/generate-flashcards/route.ts](../src/app/api/copilotkit/generate-flashcards/route.ts)
- 闪卡 AI 讲解：[api/copilotkit/explain-flashcard/route.ts](../src/app/api/copilotkit/explain-flashcard/route.ts)
- 流程图 AI 生成：[api/generate-flowchart/route.ts](../src/app/api/generate-flowchart/route.ts)
- 环境变量示例：[.env.local](../.env.local) / [.env.local.example](../.env.local.example)

---

## 目录

- [一、前置条件 & 环境配置](#一前置条件--环境配置)
- [二、自研聊天测试](#二自研聊天测试)
- [三、CopilotKit 气泡测试](#三copilotkit-气泡测试)
- [四、AI 工具端点测试](#四ai-工具端点测试)
- [五、CopilotKit Hooks 测试](#五copilotkit-hooks-测试)
- [六、快速自检 Checklist](#六快速自检-checklist)

---

## 一、前置条件 & 环境配置

### 1.1 .env.local 配置

```env
# Base URL（本项目走 Vercel AI Gateway）
LLM_BASE_URL=https://ai-gateway.vercel.sh/v1

# API Key（Vercel AI Gateway Key，必须 vck_ 开头）
LLM_API_KEY=vck_XXXXXXXXXXXXXXXXXXXXXXXXXX
OPENAI_API_KEY=vck_XXXXXXXXXXXXXXXXXXXXXXXXXX   # 兼容别名，同上

# 模型名（Vercel Gateway 必须是 provider/model 格式）
LLM_MODEL_CHAT=openai/gpt-4o-mini
LLM_MODEL_FAST=openai/gpt-4o-mini
LLM_MODEL_SMART=openai/gpt-3.5-turbo
LLM_MODEL_FLOWCHART=openai/gpt-4o-mini
LLM_MODEL_QUIZ=openai/gpt-3.5-turbo
```

**关键点**：
- Key 必须是 `vck_` 开头的 Vercel AI Gateway Key（不是 Vercel 个人 Account Token）
- 模型名必须 `provider/model` 格式（如 `openai/gpt-4o-mini`，纯模型名 `gpt-4o-mini` 会 404）
- 改完 `.env.local` 必须**重启 dev 服务器**（Next.js 不会热加载 env）

### 1.2 启动

```bash
# 清缓存（有缓存污染时先跑）
npm run clean

# 启动
npm run dev
```

**验证 LLM 初始化**：启动后 Node 终端应出现：
```
[llm] ✅ 已初始化。BaseURL=https://ai-gateway.vercel.sh/v1，自定义 Base=true，
      chat 模型=openai/gpt-4o-mini，smart 模型=openai/gpt-3.5-turbo
```

如果看到 `⚠️ 未配置 API Key` → 检查 `.env.local` 是否保存、重启 dev。

### 1.3 登录

1. 访问 `http://localhost:3000/auth/register` 注册
2. 或 `http://localhost:3000/auth/login` 登录
3. 登录后进入 `http://localhost:3000/dashboard`

---

## 二、自研聊天测试

> 自研聊天 **不走 CopilotKit**，直接调用 `/api/chat/completion`（纯 SSE）。

### 2.1 浏览器 UI 测试

| 步骤 | 操作 | 预期结果 | 调试信息 |
|------|------|---------|----------|
| 1 | 打开 `/dashboard/chat` | 显示标题 + 4 个快捷按钮 + 4 个示例气泡 | Console 无红色报错 |
| 2 | 点快捷按钮（如 Essay Help） | 自动填入消息并提交，出现用户气泡 + AI 空气泡 | Node: `[api/chat/completion] start userMessages=1 ...` |
| 3 | 等待 5~15s | AI 气泡逐字"打字机式"出现文本 | Node: `[api/chat/completion] done stream elapsed=XXXms` |
| 4 | 发中文问题（如"帮我列一个物理复习计划"） | AI 自动用中文回复，逐字流畅 | 同上 |
| 5 | 生成中点 ⬛ 停止 | 立刻停止，已收到的 token 保留 | Browser: 请求 `canceled`; Node: AbortError 不报错 |
| 6 | 点左下角 Previous Chats | 弹出历史抽屉，包含问答对 | — |
| 7 | 删除某条历史 | 从抽屉消失 | `DELETE /api/chats` 返回 2xx |
| 8 | 点顶栏 🗑️ 清空 | 消息列表清空，回到首屏 | — |

### 2.2 curl 测试 — 非流式（先跑这个排错）

```powershell
$body = @{
  messages = @(
    @{ role = "user"; content = "请给我 3 个提高英语阅读理解的方法" }
  )
  stream = $false
} | ConvertTo-Json -Depth 5

# 注意：接口需要登录 Cookie。先在浏览器登录，然后从 DevTools 复制 Cookie
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/chat/completion" `
  -ContentType "application/json" `
  -Body $body `
  -Headers @{ Cookie = "your-cookie-here" }
```

**成功响应 (HTTP 200)**：
```json
{
  "content": "1. 先读题目再看文章；2. 记每段主旨句；3. 陌生词先结合上下文猜…",
  "model": "openai/gpt-4o-mini",
  "elapsedMs": 3820,
  "baseURL": "https://ai-gateway.vercel.sh/v1"
}
```

### 2.3 curl 测试 — 流式 SSE

```powershell
$body = @{
  messages = @(@{ role = "user"; content = "1+1=?" })
  stream = $true
} | ConvertTo-Json -Depth 5

curl.exe -N -X POST "http://localhost:3000/api/chat/completion" `
  -H "Content-Type: application/json" `
  -H "Cookie: your-cookie-here" `
  --data $body
```

**SSE 帧格式**：
```
: ping                          ← 心跳帧（防超时）

data: {"type":"delta","delta":"2"}        ← 增量 token

data: {"type":"delta","delta":"。"}

data: {"type":"done","model":"openai/gpt-4o-mini","elapsedMs":820,"finalContent":"2。"}

data: {"type":"error","name":"HTTPError","message":"Invalid authentication token","status":401}
```

### 2.4 常见错误排查

| 错误场景 | 状态码 / 消息 | 排查建议 |
|---------|--------------|---------|
| Token 错/过期 | 401 `Invalid authentication token` | Vercel → Dashboard → AI → AI Gateway → Keys 重新生成 `vck_` 开头的 key |
| 模型名错 | 404 `model not found` | 必须 `provider/model`，如 `openai/gpt-4o-mini` |
| 速率限制 | 429 `Rate limited` | 等 1 分钟再试 |
| Provider Billing 未绑 | `openai provider is not configured` | Vercel AI Gateway 后台绑定对应 Provider Billing |
| Cookie 失效 | 302 / 401 | 重新登录 `/auth/login` |

---

## 三、CopilotKit 气泡测试

> CopilotKit 气泡通过 Provider + `/api/copilotkit` 端点工作，使用 Fake OpenAI Client 桥接到 `lib/llm.ts`。

### 3.1 启动验证

进入任一 dashboard 页面后，检查 Node 终端：

```
[CopilotKit route] ✅ ServiceAdapter 构建完成：baseURL=https://ai-gateway.vercel.sh/v1 model=openai/gpt-4o-mini
```

如果看到 `❌ buildServiceAdapter failed` → API Key 未配置，回到 1.1 检查。

### 3.2 气泡 UI 测试

| 步骤 | 操作 | 预期结果 | 调试信息 |
|------|------|---------|----------|
| 1 | 进入 `/dashboard` 任一页面 | 右下角出现悬浮按钮 | Console 无红色报错 |
| 2 | 点击按钮 | 展开气泡，标题"Study Sphere AI 助手" | — |
| 3 | 输入"你好"并发送 | AI 逐字流式回复中文 | Node: `[CopilotKit ...] process start userMessages=1 ...` |
| 4 | 等待回复完成 | 回复完整显示，气泡输入框恢复可用 | Node: `[CopilotKit ...] process done` |
| 5 | 点气泡外部 | 气泡关闭 | `clickOutsideToClose={true}` 生效 |

### 3.3 错误场景验证

| 场景 | 操作 | 预期 |
|------|------|------|
| API Key 无效 | `.env.local` 写错 key → 重启 → 发消息 | 气泡显示错误消息（SafeAdapter 推送），不会 `isLoading` 卡死 |
| 模型名错 | 改成不存在的模型名 → 重启 → 发消息 | 同上，Node 终端打印详细错误对象 |

**SafeAdapter 错误日志格式**：
```
[CopilotKit OpenAIAdapter(Vercel-Gateway·FakeClient)] process error ⚠️ : {
  name: 'HTTPError',
  message: 'Invalid authentication token',
  status: 401,
  body: '{ "error": {...} }'
}
```

### 3.4 握手端点验证

`useSingleEndpoint={true}` 使 info 和 POST 走同一 URL，不再有独立 `/info` 文件。

```bash
curl.exe http://localhost:3000/api/copilotkit/info
```

预期返回 200 JSON（由 `copilotRuntimeNextJSAppRouterEndpoint` 自动托管）。

如果出现 404 → 运行 `npm run clean` 清 `.next` 缓存并重启。

---

## 四、AI 工具端点测试

> 这些端点路径在 `/api/copilotkit/*` 下，但它们是普通 JSON 接口，与 CopilotKit GraphQL 协议解耦。

### 4.1 生成闪卡

```powershell
$body = @{
  studyMaterial = "Photosynthesis is the process used by plants to convert light energy into chemical energy stored in glucose. Chlorophyll captures sunlight. Oxygen is released as a byproduct."
  numberOfCards = 3
  difficulty = "beginner"
  focusArea = "definitions"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/copilotkit/generate-flashcards" `
  -ContentType "application/json" `
  -Body $body `
  -Headers @{ Cookie = "your-cookie-here" }
```

**成功响应**：
```json
{
  "flashcards": [
    {
      "id": "card-1757300000000-0",
      "question": "光合作用的定义是什么？",
      "answer": "植物将光能转化为葡萄糖中化学能的过程。",
      "audioReadableAnswer": "植物将光能转化为葡萄糖中化学能的过程。",
      "topic": "definitions",
      "tags": ["photosynthesis", "biology"]
    }
  ],
  "metadata": {
    "difficulty": "beginner",
    "focusArea": "definitions",
    "numberOfCards": 3,
    "generatedAt": "2026-09-09T08:00:00.000Z"
  }
}
```

### 4.2 讲解闪卡

```powershell
$body = @{
  flashcard = @{
    question = "What is photosynthesis?"
    answer = "Plants convert light energy into chemical energy (glucose)."
    topic = "Biology"
  }
  userQuestion = "为什么植物需要叶绿素？"
  studyMaterial = "Chlorophyll in the leaves captures sunlight."
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/copilotkit/explain-flashcard" `
  -ContentType "application/json" `
  -Body $body `
  -Headers @{ Cookie = "your-cookie-here" }
```

**成功响应**：
```json
{
  "explanation": "叶绿素位于叶片的叶绿体中，它能吸收阳光的能量，将其传递给后续的反应……"
}
```

### 4.3 生成流程图

```powershell
$body = @{
  concept = "软件开发流程"
  chartType = "mindmap"
  complexity = "detailed"
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/generate-flowchart" `
  -ContentType "application/json" `
  -Body $body `
  -Headers @{ Cookie = "your-cookie-here" }
```

**成功响应**：
```json
{
  "success": true,
  "mermaidCode": "mindmap\n  root((软件开发流程))\n    需求分析\n      用户调研\n      功能定义\n    设计\n      架构设计\n      UI设计\n    开发\n      编码\n      测试\n    部署\n      上线\n      监控",
  "chartType": "mindmap",
  "concept": "软件开发流程"
}
```

**支持图表类型**：`flowchart` / `sequence` / `class` / `state` / `mindmap` / `timeline`

**复杂度选项**：`simple` / `detailed` / `comprehensive`

---

## 五、CopilotKit Hooks 测试

> CopilotKit Hooks 让气泡 AI 能读取页面状态并触发操作。需要在浏览器中测试。

### 5.1 useCopilotReadable 测试

| 页面 | 测试方法 | 预期 |
|------|----------|------|
| `/dashboard/flashcards` | 气泡问"我现在有几张闪卡？" | AI 能回答数量（从 readable 数据获取） |
| `/dashboard/flowcharts` | 气泡问"我有哪些流程图？" | AI 列出已有流程图 |
| `/dashboard/notes` | 气泡问"我的笔记有哪些分类？" | AI 列出分类 |
| `/dashboard/quizzes` | 气泡问"我有什么测验？" | AI 列出测验 |

### 5.2 useCopilotAction 测试

| 页面 | 气泡输入 | 预期 |
|------|----------|------|
| `/dashboard/flashcards` | "帮我生成5张关于光合作用的闪卡" | 触发 `generateFlashcards` action → 页面跳到学习步骤 |
| `/dashboard/flashcards` | "讲解一下当前这张卡" | 触发 `explainFlashcard` action → 返回讲解文本 |
| `/dashboard/flowcharts` | "画一个软件开发流程的流程图" | 触发 `generateFlowchart` action → 页面切到预览 |
| `/dashboard/flowcharts` | "保存当前流程图，标题叫软件开发" | 触发 `saveFlowchart` action → 保存到库 |
| `/dashboard/notes` | "创建一个笔记，标题叫今日学习，内容是复习了物理" | 触发 `Create a Note` action → 笔记列表新增一条 |
| `/dashboard/notes` | "删除标题为今日学习的笔记" | 触发 `Delete a Note` action → 笔记消失 |
| `/dashboard/quizzes` | "创建一个测验，标题叫物理基础" | 触发 `Create a Quiz` action → 测验列表新增 |

### 5.3 CopilotTextarea 测试

| 页面 | 操作 | 预期 |
|------|------|------|
| `/dashboard/flashcards` | 在学习材料输入框中打字 | CopilotTextarea 提供 AI 自动补全建议（灰色文字） |
| `/dashboard/flowcharts` | 在概念输入框中打字 | 同上，stop 在换行和句号处 |
| `/dashboard/quizzes/generate` | 在学习材料输入框中打字 | 注意：此页面 `autosuggestionsConfig={{}}` 为空配置，可能无补全 |

---

## 六、快速自检 Checklist

| # | 检查项 | 预期 | 方法 |
|---|--------|------|------|
| 1 | `.env.local` API Key 是 `vck_` 开头 | 是 | 肉眼 |
| 2 | 5 个模型名都是 `provider/model` 格式 | 是 | 搜索 `/` |
| 3 | Node 启动日志显示 `✅ 已初始化` | 是 | 终端 |
| 4 | `POST /api/chat/completion stream=false` 返回 200 + content 非空 | 通过 | 2.2 curl |
| 5 | `/dashboard/chat` 发消息能逐字渲染 | 通过 | 浏览器 |
| 6 | 生成中点击停止确实能停 | 通过 | 手动 |
| 7 | Previous Chats 能看 / 能删 | 通过 | 浏览器 |
| 8 | Node 显示 `[CopilotKit route] ✅ ServiceAdapter 构建完成` | 是 | 终端 |
| 9 | CopilotKit 气泡能收发消息 | 通过 | 3.2 浏览器 |
| 10 | `POST /api/copilotkit/generate-flashcards` 能生成闪卡 | 通过 | 4.1 curl |
| 11 | `POST /api/generate-flowchart` 能生成 Mermaid | 通过 | 4.3 curl |
| 12 | 气泡里说"生成闪卡"能触发 Action | 通过 | 5.2 浏览器 |

**1~3 全绿** → 环境就绪
**4~7 全绿** → 自研聊天链路通
**8~9 全绿** → CopilotKit 链路通
**10~12 全绿** → AI 工具端点 + Hooks 全通
