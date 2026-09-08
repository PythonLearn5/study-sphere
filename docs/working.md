# Study Sphere 工作流程

## 🔄 概述

本文档描述 Study Sphere 中实际的用户工作流程和系统流程。

## 🔐 认证

### 注册流程
```mermaid
flowchart TD
    A[访问 /auth/register] --> B[填写表单：姓名、邮箱、密码]
    B --> C[提交表单]
    C --> D[POST /api/auth/register]
    D --> E[验证输入]
    E --> F{邮箱唯一？}
    F -->|否| G[返回错误]
    F -->|是| H[使用 bcrypt 哈希密码]
    H --> I[将用户存入 SQLite]
    I --> J[生成 JWT 令牌]
    J --> K[设置 HTTP-only Cookie]
    K --> L[重定向到仪表盘]
    G --> B
```

### 登录流程
```mermaid
flowchart TD
    A[访问 /auth/login] --> B[输入邮箱/密码]
    B --> C[提交表单]
    C --> D[POST /api/auth/login]
    D --> E[通过邮箱查找用户]
    E --> F{用户存在？}
    F -->|否| G[返回错误]
    F -->|是| H[使用 bcrypt 验证密码]
    H --> I{密码有效？}
    I -->|否| G
    I -->|是| J[生成 JWT 令牌]
    J --> K[设置安全 Cookie]
    K --> L[重定向到仪表盘]
    G --> B
```

## 📝 笔记工作流程

### 创建笔记流程
```mermaid
flowchart TD
    A[导航到 /dashboard/notes] --> B[点击"添加新笔记"]
    B --> C[在 React Quill 中输入标题和内容]
    C --> D[添加分类/标签]
    D --> E[触发自动保存]
    E --> F[提交到 POST /api/notes]
    F --> G[验证输入]
    G --> H[使用 userId 存入 SQLite]
    H --> I[返回笔记数据]
    I --> J[用新笔记更新 UI]
```

### 管理笔记流程
```mermaid
flowchart TD
    A[选择笔记操作] --> B{操作类型}
    B -->|编辑| C[点击笔记]
    B -->|删除| D[点击删除按钮]
    B -->|搜索| E[在搜索框中输入]
    
    C --> F[在编辑器中修改内容]
    F --> G[触发自动保存]
    G --> H[PUT /api/notes]
    
    D --> I[确认删除]
    I --> J[DELETE /api/notes]
    J --> K[从 UI 中移除]
    
    E --> L[本地过滤笔记]
    L --> M[显示过滤结果]
```

## 🃏 抽认卡工作流程

### 生成抽认卡流程
```mermaid
flowchart TD
    A[导航到 /dashboard/flashcards] --> B[输入文本内容]
    B --> C[选择卡片数量：5-25]
    C --> D[选择难度级别]
    D --> E[提交到 CopilotKit]
    E --> F[通过 Vercel AI Gateway 处理]
    F --> G[AI 通过 OpenAI 模型生成问答对]
    G --> H[返回抽认卡数据]
    H --> I[显示交互式卡片]
```

### 学习流程
```mermaid
flowchart TD
    A[开始学习会话] --> B[显示卡片问题]
    B --> C[用户思考/回忆]
    C --> D[翻转卡片]
    D --> E[显示答案]
    E --> F{标记作答}
    F -->|正确| G[标记为正确]
    F -->|错误| H[标记为错误]
    G --> I[更新进度]
    H --> I
    I --> J{还有更多卡片？}
    J -->|是| K[下一张卡片]
    J -->|否| L[显示会话结果]
    K --> B
```

## ❓ 测验系统

### 参加测验
1. 导航到 `/dashboard/quizzes`
2. 从集合中选择测验
3. 启动计时器（5 分钟）
4. 回答选择题
5. 提交答案
6. 计算分数
7. 显示结果

## 🤖 学习伙伴对话

### AI 对话流程
```mermaid
flowchart TD
    A[导航到 /dashboard/chat] --> B[输入问题/请求]
    B --> C[useCopilotChat 处理输入]
    C --> D[通过 CopilotKit 发送到 Vercel AI Gateway]
    D --> E[AI 通过 OpenAI 模型结合上下文处理]
    E --> F[生成响应]
    F --> G[流式响应到 UI]
    G --> H[在对话中显示消息]
    H --> I[将对话保存到 /api/chats]
    I --> J[更新对话历史]
```

### 对话上下文流程
```mermaid
flowchart TD
    A[用户输入] --> B[收集上下文]
    B --> C[用户笔记内容]
    B --> D[任务进度]
    B --> E[之前的对话历史]
    B --> F[学习偏好]
    C --> G[构建 AI 提示词]
    D --> G
    E --> G
    F --> G
    G --> H[发送到 Vercel AI Gateway（OpenAI 兼容协议）]
    H --> I[上下文相关的 AI 响应]
```

## 📋 任务管理

### 创建任务
1. 导航到 `/dashboard/todos`
2. 点击"添加任务"
3. 输入标题、描述、优先级、截止日期
4. 提交到 POST `/api/tasks`
5. 存储到 SQLite

### 管理任务
- 更新状态（待处理 → 进行中 → 已完成）
- 编辑任务详情
- 删除任务
- 按状态/优先级过滤

## 📊 每日回顾

### 回顾流程
1. 导航到每日回顾
2. 对生产力评分（1-10 分）
3. 添加反思笔记
4. 提交到 POST `/api/daily-reviews`
5. 查看随时间的进度

## ⚙️ 设置管理

### 用户偏好
1. 导航到设置
2. 配置学习偏好：
   - 工作时间（开始/结束时间）
   - 休息间隔
   - 专注会话时长
   - 高效时段
3. 保存到 PUT `/api/user-settings`

## 🔄 数据流

### 认证流程
```mermaid
flowchart LR
    A[用户登录] --> B[生成 JWT 令牌]
    B --> C[设置 HTTP-only Cookie]
    C --> D[中间件验证]
    D --> E[访问受保护路由]
```

### API 通信流程
```mermaid
flowchart TD
    A[前端组件] --> B[React Context Hook]
    B --> C[API 路由调用]
    C --> D[中间件认证检查]
    D --> E{已认证？}
    E -->|否| F[401 未授权]
    E -->|是| G[Drizzle ORM 查询]
    G --> H[SQLite 数据库]
    H --> I[返回数据]
    I --> J[更新 React State]
    J --> K[重新渲染 UI]
```

### AI 集成流程
```mermaid
flowchart TD
    A[用户输入] --> B[CopilotKit Hook]
    B --> C[上下文数据收集]
    C --> D[构建 AI 提示词]
    D --> E[Vercel AI Gateway（OpenAI 兼容协议）请求]
    E --> F[AI 响应]
    F --> G[流式传输到 UI]
    G --> H[可选：保存到数据库]
```

## 🚫 限制

- 无 WebSocket 连接
- 无实时协作
- 无云存储
- SQLite 仅用于开发
- 基础错误处理
- 以单用户为核心
