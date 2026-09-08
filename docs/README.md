# Study Sphere 文档

## 📚 欢迎

Study Sphere 是一款 AI 驱动的学习助手，帮助学生有效地组织、学习和记忆信息。

<details>
<summary>🎯 <strong>快速开始</strong></summary>

### 面向用户
1. [功能概览](features.md) - Study Sphere 提供的功能
2. [数据库设置](db.md) - 启动应用
3. [UI 组件](ui.md) - 了解界面

### 面向开发者
1. [文件结构](files.md) - 代码库组织
2. [技术栈](tech.md) - 技术基础
3. [数据库模式](schema.md) - 数据建模
4. [工作流程](working.md) - 开发流程

</details>

<details>
<summary>📑 <strong>文档文件</strong></summary>

| 文件 | 用途 | 读者 |
|------|------|------|
| [files.md](files.md) | 项目结构 | 开发者 |
| [features.md](features.md) | 功能文档 | 所有用户 |
| [tech.md](tech.md) | 技术栈 | 开发者 |
| [schema.md](schema.md) | 数据库设计 | 后端开发者 |
| [db.md](db.md) | 数据库设置 | 开发者 |
| [working.md](working.md) | 工作流程 | 开发者 |
| [ui.md](ui.md) | UI 组件 | 前端开发者 |
| [api.md](api.md) | API 端点 | 后端开发者 |

</details>

<details>
<summary>🚀 <strong>设置</strong></summary>

```bash
# 克隆并安装
git clone <repo-url>
bun install

# 环境设置
cp .env.example .env.local
# 添加 LLM_API_KEY / OPENAI_API_KEY（推荐 Vercel AI Gateway 的 vck_ 开头密钥）和 JWT_SECRET

# 数据库
bun run db:generate
bun run db:migrate

# 启动开发
bun run dev
```

</details>

<details>
<summary>📖 <strong>功能</strong></summary>

### 核心功能
- **📝 智能笔记** - [功能介绍](features.md#1--smart-notes-management) | [UI 组件](ui.md#notes-grid-component-notes-gridtsx)
- **🃏 AI 抽认卡** - [功能介绍](features.md#3--ai-powered-flashcards-generator) | [工作流程](working.md#flashcards-generation-workflow)
- **❓ 互动测验** - [功能介绍](features.md#2--interactive-quiz-system) | [工作流程](working.md#quiz-system-workflow)
- **🤖 学习伙伴对话** - [功能介绍](features.md#4--study-buddy-ai-mentor) | [数据库](schema.md#chats-table-chats)
- **📋 任务管理** - [功能介绍](features.md#5--smart-task-management) | [数据库](schema.md#tasks-table-tasks)
- **📊 每日回顾** - [功能介绍](features.md#6--daily-reviews-and-analytics) | [数据库](schema.md#daily-reviews-table-dailyreviews)

</details>

<details>
<summary>🔧 <strong>API 参考</strong></summary>

```typescript
// 认证
POST /api/auth/register    // 用户注册
POST /api/auth/login       // 用户登录
GET  /api/auth/session     // 会话验证

// 功能
GET    /api/notes          // 获取用户笔记
POST   /api/notes          // 创建笔记
GET    /api/tasks          // 获取用户任务
POST   /api/tasks          // 创建任务
POST   /api/copilotkit     // AI 端点
GET    /api/chats          // 获取对话历史
POST   /api/daily-reviews  // 创建回顾
```

完整文档请参阅 [api.md](api.md)。

</details>

## 技术栈

- **前端**：Next.js、React、TypeScript、Tailwind CSS
- **后端**：Next.js API Routes、Drizzle ORM
- **数据库**：SQLite
- **AI**：CopilotKit、Vercel AI Gateway（OpenAI 兼容协议）
- **认证**：JWT

详细架构请参阅 [tech.md](tech.md)。

---

## 📞 支持

- **问题反馈**：创建详细描述的 GitHub Issue
- **文档问题**：报告不清楚的内容
- **贡献代码**：遵循现有代码中的模式

**祝您在 Study Sphere 学习愉快！🚀📚**
