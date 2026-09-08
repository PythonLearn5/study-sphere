# 数据库设置

## 概述

Study Sphere 使用 SQLite 配合 Drizzle ORM 进行类型安全的数据库操作。

## 快速开始

### 前置条件
- Bun 运行时
- SQLite（内置）

### 安装
```bash
# 克隆仓库
git clone https://github.com/k0msenapati/study-sphere.git
cd study-sphere

# 安装依赖
bun install

# 设置环境
cp .env.example .env.local
# 编辑 .env.local，填入你的 LLM_API_KEY / OPENAI_API_KEY（推荐 Vercel AI Gateway 的 vck_ 开头密钥）
```

## 环境配置

### 必需变量
```env
# 数据库
DATABASE_URL="file:./sqlite.db"

# AI 集成（Vercel AI Gateway，推荐 vck_ 开头密钥）
LLM_API_KEY="your-vercel-ai-gateway-key-here"
OPENAI_API_KEY="your-vercel-ai-gateway-key-here"

# 安全
JWT_SECRET="your-jwt-secret-key"
```

## 数据库设置

### 初始化数据库
```bash
# 生成迁移文件
bun run db:generate

# 应用迁移
bun run db:migrate

# 可选：打开数据库管理界面
bun run db:studio
```

### 配置文件

#### drizzle.config.ts
```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: './sqlite.db', 
  },
} satisfies Config;
```

#### src/lib/db/index.ts
```typescript
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';

const sqlite = new Database('./sqlite.db');
export const db = drizzle(sqlite);
```

## 模式概述

### 核心表
- **users**：用户认证
- **notes**：富文本笔记
- **tasks**：任务管理
- **chats**：AI 对话历史
- **daily_reviews**：进度追踪
- **user_settings**：用户偏好设置

### 关系
- 所有表通过 `userId` 关联到用户
- 外键约束带级联删除
- 创建/更新时间戳自动追踪

## 可用命令

```bash
# 数据库操作
bun run db:generate    # 生成迁移
bun run db:migrate     # 应用迁移
bun run db:push        # 推送模式变更
bun run db:studio      # 打开数据库管理界面

# 开发
bun run dev           # 启动开发服务器
bun run build         # 构建生产版本
```

## 开发注意事项

- SQLite 文件存储在项目根目录
- 迁移文件存储在 `/drizzle` 文件夹
- 模式定义在 `src/lib/db/schema.ts`
- 自动生成时间戳
- 使用 Drizzle ORM 进行类型安全查询
