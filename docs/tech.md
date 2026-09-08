# 技术栈

## 🚀 概述

Study Sphere 采用现代 Web 技术构建，专注于性能和开发者体验。

## 核心技术

### 运行时与框架
- **Bun**：JavaScript 运行时和包管理器
- **Next.js 14**：基于 App Router 的 React 框架
- **React 18**：带 TypeScript 的 UI 库
- **TypeScript**：类型安全开发

### 前端
- **Tailwind CSS**：实用优先的 CSS 框架
- **Radix UI**：无头组件原语
- **React Quill**：富文本编辑器
- **Lucide React**：图标库

### 后端与数据库
- **Next.js API Routes**：服务端端点
- **SQLite**：轻量级数据库
- **Better SQLite3**：Node.js SQLite 驱动
- **Drizzle ORM**：类型安全 SQL 查询
- **bcryptjs**：密码哈希

### AI 集成
- **CopilotKit**：AI 驱动的 React 组件
- **Vercel AI Gateway（OpenAI 兼容协议）**：LLM 推理

### 开发工具
- **Biome**：格式化器和 linter
- **Drizzle Kit**：数据库迁移工具

## 📁 项目结构

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API 路由
│   ├── auth/           # 认证页面
│   └── dashboard/      # 主应用页面
├── components/         # React 组件
├── lib/               # 工具和数据库
└── middleware.ts      # 路由保护
```

## 🗄️ 数据库模式

### 核心表
- **users**：用户账户和认证
- **notes**：带分类的富文本笔记
- **tasks**：任务管理
- **chats**：AI 对话历史
- **daily_reviews**：进度追踪
- **user_settings**：用户偏好

## 🤖 AI 功能

### CopilotKit 集成
- 学习伙伴对话界面
- 与用户数据共享上下文
- AI 驱动的建议

### Vercel AI Gateway（OpenAI 兼容协议）
- 通过 OpenAI 模型进行快速 LLM 推理
- 抽认卡生成
- 教育性对话

## 🔒 安全

- 基于 HTTP-only Cookie 的 JWT 认证
- bcrypt 密码哈希
- 路由保护中间件
- 输入验证
