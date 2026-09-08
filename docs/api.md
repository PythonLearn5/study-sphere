# API 文档

## 🚀 概述

Study Sphere 提供 REST API 用于管理笔记、任务、抽认卡和 AI 驱动功能。

<details>
<summary>🔐 <strong>认证</strong></summary>

所有 API 端点都需要通过 HTTP-only Cookie 进行 JWT 认证。

### 认证端点
```typescript
POST /api/auth/register   // 用户注册
POST /api/auth/login      // 用户登录
POST /api/auth/logout     // 用户登出
GET  /api/auth/session    // 检查会话
GET  /api/auth/me         // 获取用户信息
```

</details>

<details>
<summary>📋 <strong>核心端点</strong></summary>

### 笔记
```typescript
GET    /api/notes         // 获取用户笔记
POST   /api/notes         // 创建笔记
PUT    /api/notes/:id     // 更新笔记
DELETE /api/notes/:id     // 删除笔记
```

### 任务
```typescript
GET    /api/tasks         // 获取用户任务
POST   /api/tasks         // 创建任务
PUT    /api/tasks/:id     // 更新任务
DELETE /api/tasks/:id     // 删除任务
```

### AI 对话
```typescript
GET    /api/chats         // 获取对话历史
POST   /api/chats         // 保存对话消息
DELETE /api/chats/:id     // 删除对话
```

### 抽认卡（AI 驱动）
```typescript
POST /api/copilotkit/generate-flashcards  // 从文本生成
POST /api/copilotkit/explain-flashcard    // 解释抽认卡
```

### 设置与回顾
```typescript
GET  /api/user-settings   // 获取偏好设置
PUT  /api/user-settings   // 更新偏好设置
GET  /api/daily-reviews   // 获取回顾记录
POST /api/daily-reviews   // 创建回顾记录
```

</details>

<details>
<summary>🤖 <strong>AI 集成</strong></summary>

### CopilotKit 端点
```typescript
POST /api/copilotkit     // 主 AI 处理端点
```

**功能包括：**
- 学习伙伴对话回复
- 从文本生成抽认卡
- 内容解释
- 学习建议

**AI 模型：** openai/gpt-4o-mini（通过 Vercel AI Gateway）

</details>

<details>
<summary>📝 <strong>使用示例</strong></summary>

### 创建笔记
```bash
curl -X POST /api/notes \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Physics Notes",
    "content": "Newton'\''s laws of motion...",
    "categories": ["physics", "mechanics"]
  }'
```

### 生成抽认卡
```bash
curl -X POST /api/copilotkit/generate-flashcards \
  -H "Content-Type: application/json" \
  -d '{
    "content": "Photosynthesis is the process...",
    "count": 5,
    "difficulty": "medium"
  }'
```

</details>

---

## 📞 支持

- **问题反馈**：在 GitHub 提交 Bug 报告
- **API 问题**：检查认证和请求格式
- **功能建议**：使用 GitHub 讨论区
