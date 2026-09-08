# Study Sphere 功能清单（FEATURES.md）

> 本文档用于快速了解 Study Sphere 项目的模块组成与功能全貌。
> 代码路径一律以仓库根目录为基准，点击文件名可直接跳到对应源文件。

---

## 1. 系统总体模块

| 模块 | 前端主要页面 | 后端主要 API | 说明 |
|------|-------------|-------------|------|
| ① 认证 | [auth 组件](file:///d:/GITHUB_tmp/study-sphere/src/components/auth) | [api/auth/*](file:///d:/GITHUB_tmp/study-sphere/src/app/api/auth) | 注册 / 登录 / 登出 / 会话 |
| ② Landing 页 | [app/page.tsx 方向](file:///d:/GITHUB_tmp/study-sphere/src/app)（landing 组件在 [landing/](file:///d:/GITHUB_tmp/study-sphere/src/components/landing)） | — | 首页宣传 & 入口 |
| ③ Dashboard 总览 | [dashboard/page.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/page.tsx) | [api/dashboard/stats](file:///d:/GITHUB_tmp/study-sphere/src/app/api/dashboard/stats/route.ts) | 学习数据统计、功能入口卡片、每日警句 |
| ④ 笔记 | [dashboard/notes](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/notes/page.tsx) | [api/notes](file:///d:/GITHUB_tmp/study-sphere/src/app/api/notes/route.ts) + [api/notes/bookmarks](file:///d:/GITHUB_tmp/study-sphere/src/app/api/notes/bookmarks/route.ts) | 富文本笔记、收藏 |
| ⑤ 任务 / 待办 | [dashboard/todos](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/todos/page.tsx) | [api/tasks](file:///d:/GITHUB_tmp/study-sphere/src/app/api/tasks/route.ts) | 日历调度、智能建议、专注会话、每日复盘 |
| ⑥ 闪卡 / 卡组 | [dashboard/flashcards](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/flashcards/page.tsx) + [dashboard/decks](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/decks/page.tsx) + [study](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/decks/[id]/study/page.tsx) | [api/flashcards/*](file:///d:/GITHUB_tmp/study-sphere/src/app/api/flashcards) + [api/decks/*](file:///d:/GITHUB_tmp/study-sphere/src/app/api/decks) + [daily-reviews](file:///d:/GITHUB_tmp/study-sphere/src/app/api/daily-reviews/route.ts) + [AI 生成闪卡](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/generate-flashcards/route.ts) + [AI 讲解单卡](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/explain-flashcard/route.ts) | 卡组管理、学习模式、艾宾浩斯复习 + AI 一键生成/讲解 |
| ⑦ 流程图 | [dashboard/flowcharts](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/flowcharts/page.tsx) | [api/flowcharts](file:///d:/GITHUB_tmp/study-sphere/src/app/api/flowcharts/route.ts) + [generate-flowchart (旧)](file:///d:/GITHUB_tmp/study-sphere/src/app/api/generate-flowchart/route.ts) | Mermaid 可视化 + AI 生成流程图/时序图/思维导图等 |
| ⑧ 测验 | [dashboard/quizzes](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/quizzes/page.tsx) + [generate](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/quizzes/generate/page.tsx) + [做答](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/quizzes/[id]/page.tsx) | [quiz-subjects](file:///d:/GITHUB_tmp/study-sphere/src/app/api/quiz-subjects/route.ts) + [quiz-topics](file:///d:/GITHUB_tmp/study-sphere/src/app/api/quiz-topics/route.ts) + [AI 生成测验](file:///d:/GITHUB_tmp/study-sphere/src/app/api/quizzes/generate/route.ts) + [seed](file:///d:/GITHUB_tmp/study-sphere/src/app/api/seed-quiz-data/route.ts) | 科目 / 主题 / AI 自动出题 / 答题 / 收藏 / 完成记录 |
| ⑨ 学习专注区 | [dashboard/study-area](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/study-area/page.tsx) | [focus-sessions](file:///d:/GITHUB_tmp/study-sphere/src/app/api/focus-sessions/route.ts) + [focus-sessions/stats](file:///d:/GITHUB_tmp/study-sphere/src/app/api/focus-sessions/stats/route.ts) | 番茄钟 / 专注记录统计 |
| ⑩ AI 聊天（主聊天页） | [dashboard/chat](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/chat/page.tsx) | [api/chat/completion](file:///d:/GITHUB_tmp/study-sphere/src/app/api/chat/completion/route.ts) + [api/chats (历史保存)](file:///d:/GITHUB_tmp/study-sphere/src/app/api/chats/route.ts) | SSE 流式打字机、AI 学习助手对话、保存历史会话 |
| ⑪ CopilotKit 集成（悬浮气泡 / Agent 层） | [dashboard/layout.tsx (Provider 已启用 + CopilotPopup 悬浮气泡)](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/layout.tsx) | [api/copilotkit (single-route 主端点 · Hono 模式)](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/route.ts) | 右下角 AI 悬浮气泡 / HttpAgent 注册 / useSingleEndpoint；Info 端点由 single-route 自动托管（已删除独立 info stub）；主聊天仍走 ⑩ |
| ⑫ 个人中心 | [dashboard/profile](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/profile/page.tsx) | [api/profile/*](file:///d:/GITHUB_tmp/study-sphere/src/app/api/profile) + [api/user-settings](file:///d:/GITHUB_tmp/study-sphere/src/app/api/user-settings/route.ts) | 基本资料、头像、改密码、主题/学习设置、学习数据展示 |
| ⑬ 通用 UI / 主题 | [theme-provider](file:///d:/GITHUB_tmp/study-sphere/src/components/theme-provider.tsx) + [components/ui](file:///d:/GITHUB_tmp/study-sphere/src/components/ui) | — | 亮色/深色主题、Shadcn/UI 组件库、Spotlight、Sparkle 等动效 |

---

## 2. 详细功能点分解

### 2.1 认证 (Authentication)

| 功能 | 文件 / 路径 | 说明 |
|------|------------|------|
| 用户注册 | [Register.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/auth/Register.tsx) + [/api/auth/register](file:///d:/GITHUB_tmp/study-sphere/src/app/api/auth/register/route.ts) | 姓名 / 邮箱 / 密码注册；开发模式下已跳过 reCAPTCHA |
| 用户登录 | [Login.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/auth/Login.tsx) + [/api/auth/login](file:///d:/GITHUB_tmp/study-sphere/src/app/api/auth/login/route.ts) | JWT 登录，Token 存 Cookie |
| 会话校验 | [/api/auth/session](file:///d:/GITHUB_tmp/study-sphere/src/app/api/auth/session/route.ts) + [/api/auth/me](file:///d:/GITHUB_tmp/study-sphere/src/app/api/auth/me/route.ts) | dashboard layout 登录态校验 |
| 登出 | [Logout.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/auth/Logout.tsx) + [/api/auth/logout](file:///d:/GITHUB_tmp/study-sphere/src/app/api/auth/logout/route.ts) | 清理 Cookie |
| JWT 生成/校验 | [jwt.ts](file:///d:/GITHUB_tmp/study-sphere/src/lib/auth/jwt.ts) + [recaptcha.ts](file:///d:/GITHUB_tmp/study-sphere/src/lib/auth/recaptcha.ts) | JWT 工具、reCAPTCHA 跳过逻辑 |
| 密码哈希 | [password.ts](file:///d:/GITHUB_tmp/study-sphere/src/lib/auth/password.ts) | bcryptjs 封装 |

### 2.2 Dashboard 总览

| 功能 | 文件 | 说明 |
|------|------|------|
| 学习统计卡片 | [dashboard-stats.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/dashboard/dashboard-stats.tsx) + [/api/dashboard/stats](file:///d:/GITHUB_tmp/study-sphere/src/app/api/dashboard/stats/route.ts) | 连续打卡、完成任务、学习时长、闪卡/测验数量 |
| 功能入口卡片 | [feature-cards.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/dashboard/feature-cards.tsx) | 笔记/闪卡/任务/流程图/测验/聊天 等 6~8 个入口 |
| 每日警句 | [dynamic-quote.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/dashboard/dynamic-quote.tsx) | 本地随机激励文案 |
| 侧边栏导航 | [sidebar.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/dashboard/sidebar.tsx) | 带图标、支持折叠 |

### 2.3 笔记 (Notes)

| 功能 | 文件 |
|------|------|
| 笔记列表 / 新建 / 编辑 / 删除 | [notes/page.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/notes/page.tsx) + [/api/notes](file:///d:/GITHUB_tmp/study-sphere/src/app/api/notes/route.ts) |
| 富文本编辑 | 用了 react-quill（见 [package.json](file:///d:/GITHUB_tmp/study-sphere/package.json#L66-L66)） |
| 收藏笔记 | [/api/notes/bookmarks](file:///d:/GITHUB_tmp/study-sphere/src/app/api/notes/bookmarks/route.ts) |

### 2.4 任务 / 待办 (Tasks / Todos)

| 功能 | 文件 |
|------|------|
| 任务 CRUD | [todos/page.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/todos/page.tsx) + [/api/tasks](file:///d:/GITHUB_tmp/study-sphere/src/app/api/tasks/route.ts) + [/api/tasks/[id]](file:///d:/GITHUB_tmp/study-sphere/src/app/api/tasks/[id]/route.ts) |
| 任务表单 + 标签 + 优先级 | [TaskForm.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/tasks/TaskForm.tsx) |
| 日程调度 (日历) | [TaskScheduler.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/tasks/TaskScheduler.tsx) |
| 智能建议 (AI) | [SmartSuggestions.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/tasks/SmartSuggestions.tsx) |
| 每日复盘 | [DailyReview.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/tasks/DailyReview.tsx) + [/api/daily-reviews](file:///d:/GITHUB_tmp/study-sphere/src/app/api/daily-reviews/route.ts) |
| 生产率设置 | [ProductivitySettings.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/tasks/ProductivitySettings.tsx) |
| 专注会话 (番茄钟) | [study-area/page.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/study-area/page.tsx) + [/api/focus-sessions](file:///d:/GITHUB_tmp/study-sphere/src/app/api/focus-sessions/route.ts) + [stats](file:///d:/GITHUB_tmp/study-sphere/src/app/api/focus-sessions/stats/route.ts) |

### 2.5 闪卡 / 卡组 (Flashcards & Decks)

| 功能 | 文件 |
|------|------|
| 闪卡列表 / CRUD / 批量 | [flashcards/page.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/flashcards/page.tsx) + [/api/flashcards](file:///d:/GITHUB_tmp/study-sphere/src/app/api/flashcards/route.ts) + [bulk](file:///d:/GITHUB_tmp/study-sphere/src/app/api/flashcards/bulk/route.ts) |
| 卡组管理 | [decks/page.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/decks/page.tsx) + [decks/[id]](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/decks/[id]/page.tsx) + [/api/decks](file:///d:/GITHUB_tmp/study-sphere/src/app/api/decks/route.ts) + [/api/decks/[id]/flashcards](file:///d:/GITHUB_tmp/study-sphere/src/app/api/decks/[id]/flashcards/route.ts) |
| 学习模式 (翻卡) | [decks/[id]/study](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/decks/[id]/study/page.tsx) |
| 艾宾浩斯每日复习 | [/api/daily-reviews](file:///d:/GITHUB_tmp/study-sphere/src/app/api/daily-reviews/route.ts) |
| 🤖 AI 批量生成闪卡 | [/api/copilotkit/generate-flashcards](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/generate-flashcards/route.ts)（非流式 JSON） |
| 🤖 AI 讲解某张闪卡 | [/api/copilotkit/explain-flashcard](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/explain-flashcard/route.ts) |

### 2.6 流程图 (Flowcharts)

| 功能 | 文件 |
|------|------|
| 流程图列表 / 保存 / 删除 | [flowcharts/page.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/flowcharts/page.tsx) + [/api/flowcharts](file:///d:/GITHUB_tmp/study-sphere/src/app/api/flowcharts/route.ts) |
| Mermaid 渲染器 | [flowchart-viewer.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/flowcharts/flowchart-viewer.tsx) + [mermaid](file:///d:/GITHUB_tmp/study-sphere/package.json#L58-L58) |
| 内置模板 | [flowchart-templates.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/flowcharts/flowchart-templates.tsx) |
| 🤖 AI 生成 Mermaid 代码 | [flowchart-generator.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/flowcharts/flowchart-generator.tsx) + [/api/generate-flowchart (旧入口)](file:///d:/GITHUB_tmp/study-sphere/src/app/api/generate-flowchart/route.ts) + [/api/copilotkit/generate-flowchart (备用)](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/generate-flowchart/route.ts) |
| 支持的图类型 | flowchart / sequenceDiagram / classDiagram / stateDiagram-v2 / mindmap / timeline |

### 2.7 测验 (Quizzes)

| 功能 | 文件 |
|------|------|
| 科目列表 | [quiz-subjects](file:///d:/GITHUB_tmp/study-sphere/src/app/api/quiz-subjects/route.ts) |
| 主题列表 | [quiz-topics](file:///d:/GITHUB_tmp/study-sphere/src/app/api/quiz-topics/route.ts) |
| 测验列表 / 做答页 | [quizzes/page.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/quizzes/page.tsx) + [quizzes/[id]](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/quizzes/[id]/page.tsx) |
| 🤖 AI 生成测验 | [quiz-generator.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/quizzes/quiz-generator.tsx) + [quizzes/generate/page](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/quizzes/generate/page.tsx) + [/api/quizzes/generate](file:///d:/GITHUB_tmp/study-sphere/src/app/api/quizzes/generate/route.ts) |
| 收藏测验 / 完成记录 | Schema 中 [quizBookmarks / quizCompletions](file:///d:/GITHUB_tmp/study-sphere/drizzle/schema.ts#L153-L181) |

### 2.8 AI 聊天 (Study Sphere Chat)

> 这是当前**主路径**（替代 CopilotKit 聊天页）。

| 功能 | 文件 |
|------|------|
| 聊天首页 (空状态) + 快捷建议 | [chat/page.tsx 首屏](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/chat/page.tsx) |
| 发送消息 / 流式渲染 (打字机) / 停止生成 | [chat/page.tsx sendMessage/stopGeneration](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/chat/page.tsx) |
| 会话历史 (保存 / 删除) | [/api/chats](file:///d:/GITHUB_tmp/study-sphere/src/app/api/chats/route.ts) + 左下 Previous Chats 抽屉 |
| 后端流式接口 (SSE) | [/api/chat/completion](file:///d:/GITHUB_tmp/study-sphere/src/app/api/chat/completion/route.ts) |
| 统一 LLM 调用层 | [src/lib/llm.ts](file:///d:/GITHUB_tmp/study-sphere/src/lib/llm.ts)：自定义 Base (Vercel AI Gateway) 原生 Fetch / OpenAI 兼容协议 |

### 2.9 CopilotKit 集成 (悬浮气泡 / 备用 Agent 层)

| 功能 | 文件 |
|------|------|
| 运行时 HTTP 端点 (single-route) | [/api/copilotkit](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/route.ts) — Hono single-route 模式，自动托管 /info 握手及 POST 消息 |
| 前端 Provider 配置（已启用） | [dashboard/layout.tsx](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/layout.tsx) — 开启 useSingleEndpoint=true + 通过 agents__unsafe_dev_only 注册 @ag-ui/client 的 HttpAgent（key=default） |
| 悬浮气泡 UI | [dashboard/layout.tsx CopilotPopup](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/layout.tsx#L89-L97) |
| 生成闪卡 / 讲解闪卡 | 已在 2.5 列出（调用统一 LLM 层） |
| 生成流程图 (备用 CopilotKit 入口) | [/api/copilotkit/generate-flowchart](file:///d:/GITHUB_tmp/study-sphere/src/app/api/copilotkit/generate-flowchart/route.ts) |

### 2.10 个人中心 / 设置

| 功能 | 文件 |
|------|------|
| 个人中心页 | [dashboard/profile](file:///d:/GITHUB_tmp/study-sphere/src/app/dashboard/profile/page.tsx) |
| 基本资料表单 | [ProfileForm.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/profile/ProfileForm.tsx) + [/api/profile](file:///d:/GITHUB_tmp/study-sphere/src/app/api/profile/route.ts) |
| 头像上传 | [AvatarUpload.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/profile/AvatarUpload.tsx) + [/api/profile/avatar](file:///d:/GITHUB_tmp/study-sphere/src/app/api/profile/avatar/route.ts) |
| 改密码 | [PasswordChange.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/profile/PasswordChange.tsx) + [/api/profile/password](file:///d:/GITHUB_tmp/study-sphere/src/app/api/profile/password/route.ts) |
| 账户设置 (主题等) | [AccountSettings.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/profile/AccountSettings.tsx) + [ThemeSettings.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/profile/ThemeSettings.tsx) + [/api/profile/settings](file:///d:/GITHUB_tmp/study-sphere/src/app/api/profile/settings/route.ts) + [/api/user-settings](file:///d:/GITHUB_tmp/study-sphere/src/app/api/user-settings/route.ts) |
| 学习统计展示 | [StudyStats.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/profile/StudyStats.tsx) |

### 2.11 通用 / 主题 / 主题切换

| 功能 | 文件 |
|------|------|
| 主题 Provider | [theme-provider.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/theme-provider.tsx) |
| 主题切换按钮 | [theme-toggle.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/theme-toggle.tsx) + [theme-toggle-with-db.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/theme-toggle-with-db.tsx) |
| Navbar / Landing | [navbar.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/navbar.tsx) + [landing/*](file:///d:/GITHUB_tmp/study-sphere/src/components/landing) |
| FAQ / 回到顶部 | [FAQ.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/FAQ.tsx) + [ScrollToTopButton.tsx](file:///d:/GITHUB_tmp/study-sphere/src/components/ScrollToTopButton.tsx) |
| Shadcn UI 组件库 | [components/ui/*](file:///d:/GITHUB_tmp/study-sphere/src/components/ui) |

### 2.12 数据库 / Schema

| 领域 | 主要 Schema 位置 |
|------|-----------------|
| SQLite + Drizzle ORM | [drizzle/schema.ts](file:///d:/GITHUB_tmp/study-sphere/drizzle/schema.ts) |
| 主要表 | users / notes / note_bookmarks / tasks / flashcards / decks / deck_flashcards / daily_reviews / flowcharts / focus_sessions / quizzes / quiz_subjects / quiz_topics / quiz_bookmarks / quiz_completions / chats / user_settings / daily_visits 等 |
| 迁移目录 | [drizzle/](file:///d:/GITHUB_tmp/study-sphere/drizzle) |

---

## 3. AI 统一配置说明

- **入口配置文件**：[.env.local](file:///d:/GITHUB_tmp/study-sphere/.env.local) / [.env.local.example](file:///d:/GITHUB_tmp/study-sphere/.env.local.example)
- **统一 LLM 调用层**：[src/lib/llm.ts](file:///d:/GITHUB_tmp/study-sphere/src/lib/llm.ts)
  - 配置 `LLM_BASE_URL` = Vercel AI Gateway `https://ai-gateway.vercel.sh/v1`（推荐）：
    - 走原生 `fetch`，最终 URL = `${LLM_BASE_URL}/chat/completions`，**不会**额外拼接 `/openai/v1`
    - 模型名必须写成 `provider:model`（如 `openai:gpt-4o-mini`）
    - 使用 `LLM_API_KEY` 或 `OPENAI_API_KEY`，推荐 Vercel AI Gateway 的 `vck_` 开头密钥
- **5 个模型档位**：
  ```
  LLM_MODEL_CHAT   (聊天/讲解)      ← 默认 openai:gpt-4o-mini
  LLM_MODEL_FAST   (快速任务)       ← 默认 openai:gpt-4o-mini
  LLM_MODEL_SMART  (JSON/推理)      ← 默认 openai:gpt-3.5-turbo
  LLM_MODEL_FLOWCHART (Mermaid)     ← 默认 openai:gpt-4o-mini
  LLM_MODEL_QUIZ   (出题)           ← 默认 openai:gpt-3.5-turbo
  ```

---

## 4. 命令速查

见 [package.json](file:///d:/GITHUB_tmp/study-sphere/package.json#L5-L16)：

```bash
npm run dev            # 开发
npm run build && npm run start   # 生产
npm run db:push        # Schema 直接推到 sqlite.db（开发）
npm run db:generate && npm run db:migrate  # 正式迁移
npm run db:studio      # 可视化管理 sqlite.db
npm run clean          # 清除 .next / node_modules/.cache / .turbo 缓存
```
