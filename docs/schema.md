# 数据库模式

## 🗄️ 概述

Study Sphere 使用 SQLite 配合 Drizzle ORM 进行类型安全的数据库操作。

## 📊 配置

- **数据库**：SQLite（`sqlite.db`）
- **ORM**：Drizzle ORM 配合 Better SQLite3
- **迁移**：Drizzle Kit
- **验证**：Zod 模式

## 📋 核心表

### 用户表
```typescript
export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

**用途**：用户认证和个人资料

### 笔记表
```typescript
export const notes = sqliteTable('notes', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  content: text('content').notNull(),
  categories: text('categories', { mode: 'json' }).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  modifiedAt: integer('modified_at', { mode: 'timestamp' }).notNull(),
});
```

**用途**：带分类的富文本笔记

### 任务表
```typescript
export const tasks = sqliteTable('tasks', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  description: text('description'),
  priority: text('priority', { enum: ['low', 'medium', 'high'] }).default('medium'),
  status: text('status', { enum: ['pending', 'in_progress', 'completed'] }).default('pending'),
  dueDate: integer('due_date', { mode: 'timestamp' }),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

**用途**：带优先级和状态的任务管理

### 对话表
```typescript
export const chats = sqliteTable('chats', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  prompt: text('prompt').notNull(),
  response: text('response').notNull(),
  promptTime: integer('prompt_time', { mode: 'timestamp' }).notNull(),
});
```

**用途**：AI 对话历史

### 每日回顾表
```typescript
export const dailyReviews = sqliteTable('daily_reviews', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  reviewDate: integer('review_date', { mode: 'timestamp' }).notNull(),
  completedTasks: integer('completed_tasks').default(0).notNull(),
  totalTasks: integer('total_tasks').default(0).notNull(),
  reflection: text('reflection'),
  improvements: text('improvements'),
  productivityScore: integer('productivity_score'),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
});
```

**用途**：每日生产力追踪

### 用户设置表
```typescript
export const userSettings = sqliteTable('user_settings', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  focusSessionDuration: integer('focus_session_duration').default(90).notNull(),
  breakDuration: integer('break_duration').default(20).notNull(),
  workStartTime: text('work_start_time').default('09:00').notNull(),
  workEndTime: text('work_end_time').default('17:00').notNull(),
  peakHoursStart: text('peak_hours_start').default('10:00').notNull(),
  peakHoursEnd: text('peak_hours_end').default('12:00').notNull(),
  pomodoroEnabled: integer('pomodoro_enabled', { mode: 'boolean' }).default(false).notNull(),
  pomodoroWorkDuration: integer('pomodoro_work_duration').default(25).notNull(),
  pomodoroBreakDuration: integer('pomodoro_break_duration').default(5).notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' }).notNull(),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).notNull(),
});
```

**用途**：用户生产力偏好

## 🔗 关系

- 所有表通过级联删除引用 `users.id`
- 外键约束确保数据完整性
- 时间戳追踪创建和修改
- JSON 字段用于灵活数据存储（分类）

## 🛠️ 迁移命令

```bash
# 生成迁移
bun run db:generate

# 应用迁移
bun run db:migrate

# 推送模式变更
bun run db:push

# 打开数据库管理界面
bun run db:studio
```

## 🔍 查询示例

### 获取用户笔记
```typescript
const userNotes = await db
  .select()
  .from(notes)
  .where(eq(notes.userId, userId));
```

### 创建任务
```typescript
const newTask = await db
  .insert(tasks)
  .values({
    id: generateId(),
    userId,
    title,
    description,
    priority,
    status: 'pending',
    createdAt: new Date(),
    updatedAt: new Date(),
  });
```

### 获取对话历史
```typescript
const chatHistory = await db
  .select()
  .from(chats)
  .where(eq(chats.userId, userId))
  .orderBy(desc(chats.promptTime));
```
