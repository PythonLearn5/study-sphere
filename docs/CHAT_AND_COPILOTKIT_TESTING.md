# Study Sphere 聊天 & CopilotKit 测试步骤与样例

> 文档分两部分：
> 1. **聊天部分（主路径 / 推荐日常使用）**：`/dashboard/chat` 页面 + `/api/chat/completion` 流式接口
> 2. **CopilotKit 部分（备用 / 底层 Agent 能力）**：`/api/copilotkit` 端点 + 握手探测 + OpenAIAdapter

相关文件索引：
- 聊天前端：[dashboard/chat/page.tsx](../src/app/dashboard/chat/page.tsx)
- 聊天后端 SSE：[api/chat/completion/route.ts](../src/app/api/chat/completion/route.ts)
- 聊天历史 CRUD：[api/chats/route.ts](../src/app/api/chats/route.ts)
- 统一 LLM 调用层：[lib/llm.ts](../src/lib/llm.ts)
- CopilotKit 运行时：[api/copilotkit/route.ts](../src/app/api/copilotkit/route.ts)
- 握手端点：由 [api/copilotkit/route.ts](../src/app/api/copilotkit/route.ts)（Hono single-route）自动处理 `/info`，已删除独立 info stub 文件
- Dashboard Provider（当前已启用）：[dashboard/layout.tsx](../src/app/dashboard/layout.tsx) — useSingleEndpoint=true + agents__unsafe_dev_only 注册 HttpAgent(keys=[default]) + CopilotPopup 悬浮气泡
- 环境变量示例：[.env.local](../.env.local) / [.env.local.example](../.env.local.example)

---

## 一、聊天部分（Study Sphere Chat · 主路径）

### 1.1 前置条件 & 环境检查清单

在测试前，先确认 `.env.local` 满足：

```env
# 1) 自定义 Base（本项目走 Vercel AI Gateway，推荐）
LLM_BASE_URL=https://ai-gateway.vercel.sh/v1
LLM_API_KEY=vck_XXXXXXXXXXXXXXXXXXXXXXXXXX         # Vercel AI Gateway Key（vck_ 开头）
OPENAI_API_KEY=vck_XXXXXXXXXXXXXXXXXXXXXXXXXX      # 同上，兼容别名

# 模型名：Vercel Gateway 必须是 provider/model，推荐模型如下
LLM_MODEL_CHAT=openai/gpt-4o-mini
LLM_MODEL_FAST=openai/gpt-4o-mini
LLM_MODEL_SMART=openai/gpt-3.5-turbo
LLM_MODEL_FLOWCHART=openai/gpt-4o-mini
LLM_MODEL_QUIZ=openai/gpt-3.5-turbo
```

启动后在 **Node 终端** 观察这一行：

```
[llm] ✅ 已初始化。BaseURL=https://ai-gateway.vercel.sh/v1，自定义 Base=true，
      chat 模型=openai/gpt-4o-mini，smart 模型=openai/gpt-3.5-turbo
```

如果看到的是 `⚠️ 未配置 API Key` → 重新检查 `.env.local` 是否保存、并重启 `npm run dev`（改 `.env.local` 必须重启）。

### 1.2 启动开发服务器

```bash
# 如果有缓存污染（vendors.js SyntaxError），先清缓存
npm run clean

npm run dev
```

浏览器访问：
1. 先注册登录：`http://localhost:3000/auth/register`
2. 进入聊天页：`http://localhost:3000/dashboard/chat`

### 1.3 浏览器 UI 测试步骤（逐步）

| 步骤 | 操作 | 预期结果 | 调试信息（Console / Node 终端） |
|------|------|---------|------------------------------|
| 1 | 打开 `/dashboard/chat` | 显示 "What can I help you study?" 标题 + 4 个快捷按钮 + 4 个示例气泡 | Console 不应有红色报错 |
| 2 | 点任一快捷按钮（如 Essay Help） | 发送区自动填入 "Help me with essay help" 并立刻提交；对话区滚动出来（左边 AI 空气泡 + 右边用户气泡） | Browser Console：`[Chat Debug] send user message: ...`<br>Node 终端：`[api/chat/completion] start userMessages=1 model=...` |
| 3 | 等待 5~15s | AI 空气泡开始逐字"打字机式"出现文本，最后结束，"发送中"恢复 | Browser：`[Chat Debug] /api/chat/completion status=200 OK ...`<br>Node：`[api/chat/completion] done stream elapsed=XXXms` |
| 4 | 再发一条中文问题（如："帮我列一个高中物理力学复习计划"） | AI 自动用中文回复；文本逐字流畅出现 | 同上 |
| 5 | **生成过程中点击 ⬛ 停止按钮** | 立刻停止生成，当前已收到的 token 保留 | Browser：请求 `canceled`<br>Node：AbortError 不报错 |
| 6 | 点击左下角 **Previous Chats** | 弹出历史对话抽屉，包含刚才发的 2 条问答对 | 抽屉里点单条对应 → 目前不跳转但能看/删除 |
| 7 | 历史里点 🗑️ 删除某条 | 该条立刻从抽屉里消失 | 后端 `/api/chats DELETE` 返回 2xx |
| 8 | 顶栏 🗑️（清空 chat）按钮 | 消息列表清空，回到首屏空状态 | — |

### 1.4 用 curl / Postman 直接测 `/api/chat/completion`

因为 AI 调用可能受 UI 状态、登录态 Cookie 影响，"先把接口调通再测 UI"是更快的排错套路。

#### 样例 A：非流式（先跑这个，失败时信息最全）

PowerShell：

```powershell
$body = @{
  messages = @(
    @{ role = "user"; content = "请给我 3 个提高英语阅读理解的方法，用中文回答" }
  )
  stream = $false
} | ConvertTo-Json -Depth 5

# 注意：实际部署里接口需要登录 Cookie。测试接口前先在浏览器里登录一下，
# 然后用 DevTools Network 复制任意 dashboard 请求的 Cookie 作为 -Headers @{ Cookie="..." }
Invoke-RestMethod -Method Post `
  -Uri "http://localhost:3000/api/chat/completion" `
  -ContentType "application/json" `
  -Body $body
```

##### 成功时响应样例 (HTTP 200 JSON)

```json
{
  "content": "1. 先读题目再看文章；2. 记每段主旨句；3. 陌生词先结合上下文猜、再查词典……",
  "model": "openai/gpt-4o-mini",
  "elapsedMs": 3820,
  "baseURL": "https://ai-gateway.vercel.sh/v1"
}
```

##### 典型失败响应样例（接口会原样打印 Vercel Gateway 的真实错误）

| 错误场景 | 典型 status / message | 排查建议 |
|---------|----------------------|---------|
| Token 错 / 过期 | 401 `Invalid authentication token` | 去 Vercel → Dashboard → AI → AI Gateway → Keys 重新生成一个 `vck_` 开头的 key（注意不是 Vercel 个人 Account Token） |
| 模型名错 | 404 `The requested resource was not found: /v1/chat/completions` 或 `model not found` | 必须 `provider/model`，例如 `openai/gpt-4o-mini`，纯模型名 `gpt-4o-mini` 不认识 |
| 速率限制 | 429 `Rate limited` / `You exceeded your current quota` | 等 1 分钟再试，或升级 Vercel 额度 |
| Provider Billing 未绑 | 如 `openai provider is not configured` | `openai/*` / `anthropic/*` 都需要 Vercel AI Gateway 后台绑定对应 Provider 的 Billing |
| 自定义 Base 路径拼错（修过的 bug） | 旧错误：`/v1/openai/v1/chat/completions 404` | 用新版本的 [lib/llm.ts](../src/lib/llm.ts) 自定义 Base 原生 fetch 分支，不会再加 `/openai/v1` |

#### 样例 B：流式 SSE（打字机效果）

```powershell
# 在 PowerShell 中写一个简单监听脚本，观察 server 推送
$body = @{
  messages = @(@{ role = "user"; content = "1+1=?" })
  stream = $true
} | ConvertTo-Json -Depth 5

# 推荐用 curl.exe（Windows 自带），更直观看到 data: 帧
curl.exe -N -X POST "http://localhost:3000/api/chat/completion" `
  -H "Content-Type: application/json" `
  --data $body
```

##### 流式帧格式（SSE）

服务端会逐帧推送 `data: { JSON }\n\n`：

```
: ping

data: {"type":"delta","delta":"2"}

data: {"type":"delta","delta":"。"}

data: {"type":"done","model":"openai/gpt-4o-mini","elapsedMs":820,"finalContent":"2。"}
```

错误时会推 `type=error`：

```
data: {"type":"error","name":"HTTPError","message":"Invalid authentication token","status":401}
```

### 1.5 聊天历史 API（`/api/chats`）样例

| 方法 | 用途 | 样例 Body | 响应 |
|------|------|----------|------|
| `GET /api/chats` | 取当前登录用户的所有历史问答对 | — | `[{id, prompt, response, createdAt}, ...]` |
| `POST /api/chats` | 保存一条问答对（UI 里对话结束后会自动调用） | `{ "prompt": "...", "response": "..." }` | `{ "success": true, "chat": {...} }` |
| `DELETE /api/chats` | 删除一条历史 | `{ "id": "<chat_id>" }` | `{ "success": true }` |

### 1.6 故障排查思路（按优先级）

1. **接口直连测不通？** → 用 1.4 的非流式 curl 先排除：是 Token / 模型名 / Vercel Billing / 网络 哪一层的问题。
2. **接口通但 UI 没渲染？** → 看 Console：
   - `/api/chat/completion status=200 OK` → 说明网络好，继续看是否收到了 `type: delta` 帧。
   - 不是 200 → 直接点开 Network 看响应体，内容通常就是 Vercel Gateway 原话。
3. **流式首帧慢** → 看 Node 里 `elapsedMs`，如果整体超过 20s 仍未结束但 Token 还在推，说明是 provider 本身慢；SSE 帧首加了 `: ping\n\n`，浏览器不会判死。
4. **Cookie 失效报 302 / 401** → 重新登录一次 `/auth/login`。

---

## 二、CopilotKit 部分（备用 / 底层 Agent）

> ⚠️ 说明：主聊天（/dashboard/chat）**仍然不走 CopilotKit**，它直接调用 /api/chat/completion。
> CopilotKit 目前使用场景：
> - 右下角悬浮气泡 CopilotPopup（通过 CopilotKit Provider + useSingleEndpoint + 注册 @ag-ui/client HttpAgent）。
> - 闪卡 AI 生成接口 /api/copilotkit/generate-flashcards 仍在此目录下（但它现在只复用 LLM 层，不通过 CopilotRuntime）。
> - 握手探测 GET /api/copilotkit/info 已由 single-route 自动托管，**不再需要独立 info stub 文件**（已删除），也不会再 404 刷屏。

### 2.1 架构关系图

```
  ┌──────────────────────────────────────────────────────────┐
  │ Dashboard 页面                                            │
  │ ┌─────────────────────┐   ┌────────────────────────────┐ │
  │ │  /dashboard/chat    │   │  未来可能恢复的 CopilotKit  │ │
  │ │  (自己 useState+SSE)│   │  Provider + CopilotPopup   │ │
  │ └──────────┬──────────┘   └──────────────┬─────────────┘ │
  └────────────┼─────────────────────────────┼───────────────┘
               │  POST /api/chat/completion  │  POST /api/copilotkit
               ▼                             ▼
     聊天后端 (route.ts)              CopilotRuntime
     调用 runChatCompletionStream      OpenAIAdapter
               │                             │
               └──────────────┬──────────────┘
                              ▼
                    统一 LLM 层 (lib/llm.ts)
                    自定义 Base (Vercel AI Gateway) → 原生 fetch
                    OpenAI 兼容协议
                              │
                              ▼
               Vercel AI Gateway / OpenAI 兼容后端
```

### 2.2 当前 CopilotKit Provider 配置（已启用）
Provider 已在 [dashboard/layout.tsx](../src/app/dashboard/layout.tsx#L30-L36) 配置完成并启用，关键 props 如下：
- `useSingleEndpoint={true}`：CopilotKit v1.9+ 修复 Agent 'default' not found 必须项（告诉前端只走单一后端端点，不再额外请求 runtime 元信息）。
- `agents__unsafe_dev_only={{ default: new HttpAgent({ description, url: "/api/copilotkit" }) }}`：通过 @ag-ui/client 的 HttpAgent 显式注册 agent key=`default`，name 不需要在构造参数里传（key 就是 agent name）。
- 组件：<CopilotPopup defaultOpen={false} labels={{ title, initial, placeholder }} clickOutsideToClose={true} />
- 如需关闭气泡：删除 layout.tsx 里 <CopilotPopup/> 这一行即可（Provider 保留不影响性能）。

每次进 dashboard 任一页面，会自动走 single-route 模式：**不再单独发 GET /api/copilotkit/info**（由后端 single-route 内自动处理），发送消息走 POST /api/copilotkit（Hono 托管）。

### 2.3 测握手探测（`GET /api/copilotkit/info`）

> ℹ️ 自切换到 Hono single-route 模式后，/info 端点已与 POST /api/copilotkit 合并在同一 Route Handler 文件（api/copilotkit/route.ts）内自动托管，**不再有独立的 src/app/api/copilotkit/info/route.ts 文件**（已删除）。如果你本地还看到 404，请先执行 npm run clean 清 .next 缓存并重启。

```bash
curl.exe http://localhost:3000/api/copilotkit/info
```

**预期响应 (HTTP 200)：**
```json
{
  "protocol": "copilotkit-http",
  "version": "1.0.0",
  "capabilities": { "actions": false, "agents": false, "chat": false },
  "agents": [],
  "actions": []
}
```

如果不做这个 stub，以前的问题就是：
- Console 刷屏：`GET /api/copilotkit/info 404 (Not Found)`
- 然后 CopilotKit 判定 Runtime 不可达 → `Runtime did not answer within 5000ms / runtime_info_fetch_failed / no-answer` → 真正聊天请求都还没发就被 Abort。

### 2.4 测 CopilotKit 运行时 POST（`POST /api/copilotkit`）

> CopilotKit 前端协议是 **GraphQL over POST + SSE**（私有格式），通常建议通过 UI 的 CopilotPopup 直接测试；直接手写 body 非常冗长。所以这里给**最低成本验证法**：在前端恢复 Provider 后点侧栏 CopilotPopup 发一句话，然后看 Node 终端的日志。

#### 启用 SafeAdapter 后预期日志

1. 发送消息后 Node 先打：
   ```
   [CopilotKit OpenAIAdapter(Vercel-Gateway)] process start userMessages=1 model=openai/gpt-4o-mini baseURL=https://ai-gateway.vercel.sh/v1
   ```
2. 成功后打：
   ```
   [CopilotKit OpenAIAdapter(Vercel-Gateway)] process done
   ```
3. 如果失败（401 / 模型名错 / 429），会打印详细错误对象并仍然 `eventSource.stream(... complete())`，保证前端不会 `isLoading=true` 卡死：
   ```
   [CopilotKit OpenAIAdapter(Vercel-Gateway)] process error ⚠️ : {
     name: 'HTTPError',
     message: 'Invalid authentication token',
     status: 401,
     cause: '...',
     body: '{ "error": {...} }'
   }
   ```

#### 如果 CopilotKit 报 `Code: agent_run_error_event Message: Forbidden`

**排错顺序：**
1. `.env.local` 的 API Key 是否是 Vercel AI Gateway Key（`vck_` 开头），而不是个人 token。
2. 模型名是否写成 `openai/...`；如果写 `gpt-4o-mini` 但没绑 OpenAI Billing，也会 Forbidden / model not found。
3. 用 1.4 节的 `/api/chat/completion` 非流式先把 Token / 模型名跑通。**只要 `/api/chat/completion` 能通，CopilotKit 调 LLM 就一定也能通**，因为它们共用同一层 `lib/llm.ts`（区别只在于 CopilotKit 的 OpenAIAdapter 目前仍用 SDK，出问题时建议直接复用聊天部分的 `runChatCompletionStream` 去改 `serviceAdapter.process`）。

### 2.5 CopilotKit 子目录下的 AI 工具端点（非流式）测试样例

虽然路径挂在 `/api/copilotkit/*`，但它们现在只是普通的 JSON HTTP 接口，与 CopilotKit GraphQL 协议解耦。直接 Postman 调即可。

#### 样例 C：AI 生成闪卡

```http
POST /api/copilotkit/generate-flashcards
Content-Type: application/json

{
  "studyMaterial": "Photosynthesis is the process used by plants, algae and certain bacteria to convert light energy into chemical energy stored in glucose. During photosynthesis, plants absorb carbon dioxide (CO2) from the air and water (H2O) from the soil. Chlorophyll in the leaves captures sunlight. Oxygen is released as a byproduct.",
  "numberOfCards": 3,
  "difficulty": "beginner",
  "focusArea": "definitions"
}
```

**成功响应样例：**
```json
{
  "flashcards": [
    {
      "id": "card-1757300000000-0",
      "question": "光合作用的定义是什么？",
      "answer": "植物、藻类和某些细菌将光能转化为葡萄糖中化学能的过程。",
      "audioReadableAnswer": "植物、藻类和某些细菌将光能转化为葡萄糖中化学能的过程。",
      "topic": "definitions",
      "tags": ["photosynthesis","biology"]
    },
    { "...": "..." },
    { "...": "..." }
  ],
  "metadata": {
    "difficulty": "beginner",
    "focusArea": "definitions",
    "numberOfCards": 3,
    "generatedAt": "2026-09-08T08:00:00.000Z"
  }
}
```

#### 样例 D：AI 讲解某张闪卡

```http
POST /api/copilotkit/explain-flashcard
Content-Type: application/json

{
  "flashcard": {
    "question": "What is photosynthesis?",
    "answer": "Plants convert light energy into chemical energy (glucose).",
    "topic": "Biology"
  },
  "userQuestion": "为什么植物需要叶绿素？",
  "studyMaterial": "Chlorophyll in the leaves captures sunlight."
}
```

**成功响应样例：**
```json
{
  "explanation": "叶绿素位于叶片的叶绿体中，它能吸收红光和蓝紫光（主要波段），把阳光的能量"传递"给后续的暗反应……"
}
```

---

## 三、快速自检表格（上线前 checklist）

| 检查项 | 预期 | 工具 / 方法 |
|--------|------|------------|
| `.env.local` LLM_API_KEY 是否是 `vck_` 开头 | 是 | 肉眼 |
| 5 个模型是否都写成 `provider/model` | 是 | `.env.local` 搜索 `/` 即可 |
| `GET /api/copilotkit/info` 返回 200 JSON（single-route 自动托管，无独立 stub 文件） | 通过 | curl |
| `POST /api/chat/completion stream=false` 返回 200 + content 非空 | 通过 | 1.4 样例 A |
| `/dashboard/chat` 空屏 UI 正常 | 通过 | 浏览器 |
| `/dashboard/chat` 发消息能逐字渲染 | 通过 | 浏览器 + 看 Node elapsedMs |
| 生成中点击停止确实能停 | 通过 | 手动点 ⬛ |
| Previous Chats 能看 / 能删 | 通过 | 浏览器点 2 下抽屉 |
| `POST /api/copilotkit/generate-flashcards` 能生成 ≥1 张卡 | 通过 | 2.5 样例 C |
| reCAPTCHA（生产）/ 跳过（开发）配置一致 | 通过 | 注册 / 登录页各走一遍 |

如果以上 10 项都 ✅，说明**聊天 + CopilotKit 底层 Agent + AI 工具端点**三条链路全部可用。
