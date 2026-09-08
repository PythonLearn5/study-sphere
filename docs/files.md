# 文件结构

## 📁 项目概述

Study Sphere 遵循 Next.js App Router 约定，目录组织有序。

## 🗂️ 根目录

```
├── package.json           # 依赖和脚本
├── next.config.mjs        # Next.js 配置
├── tailwind.config.ts     # Tailwind CSS 设置
├── tsconfig.json          # TypeScript 配置
├── drizzle.config.ts      # 数据库配置
├── biome.json            # 代码格式化规则
├── components.json        # UI 组件配置
├── sqlite.db             # SQLite 数据库
└── drizzle/              # 数据库迁移
```

## 📱 源代码结构

### `src/app/` - Next.js App Router
```
src/app/
├── layout.tsx            # 根布局
├── page.tsx              # 落地页
├── globals.css           # 全局样式
├── auth/                # 认证页面
│   ├── login/
│   └── register/
├── dashboard/           # 主应用
│   ├── page.tsx         # 仪表盘首页
│   ├── notes/           # 笔记功能
│   ├── flashcards/      # 抽认卡功能
│   ├── quizzes/         # 测验功能
│   ├── chat/            # AI 对话功能
│   └── todos/           # 任务管理
└── api/                 # API 路由
    ├── auth/            # 认证 API
    ├── notes/           # 笔记 CRUD
    ├── tasks/           # 任务管理
    ├── chats/           # 对话历史
    ├── daily-reviews/   # 回顾系统
    ├── user-settings/   # 用户偏好
    └── copilotkit/      # AI 集成
```

### `src/components/` - React 组件
```
src/components/
├── auth/                # 认证组件
├── landing/             # 落地页区块
├── tasks/               # 任务管理组件
└── ui/                  # 可复用 UI 组件
    ├── button.tsx
    ├── card.tsx
    ├── dialog.tsx
    ├── input.tsx
    └── ...
```

### `src/lib/` - 工具和库
```
src/lib/
├── utils.ts             # 通用工具
├── auth/                # 认证逻辑
│   ├── jwt.ts
│   └── password.ts
├── db/                  # 数据库配置
│   ├── index.ts
│   └── schema.ts
├── notes/               # 笔记功能逻辑
├── tasks/               # 任务管理逻辑
├── flashcards/          # 抽认卡功能逻辑
└── quizzes/             # 测验功能逻辑
```

## 🎨 公共资源

```
public/
├── og banner.png        # 社交媒体横幅
└── sqlite_db_error.png # 错误示意图
```

## 📄 文档

```
docs/
├── README.md            # 文档概览
├── api.md              # API 参考
├── features.md         # 功能文档
├── tech.md             # 技术栈
├── working.md          # 工作流程
├── db.md               # 数据库设置
├── files.md            # 文件结构
├── ui.md               # UI 组件
└── schema.md           # 数据库模式
```

## 关键文件

- **middleware.ts**：路由保护
- **drizzle.config.ts**：数据库配置
- **tailwind.config.ts**：样式配置
- **next.config.mjs**：Next.js 设置
- **biome.json**：代码格式化规则
