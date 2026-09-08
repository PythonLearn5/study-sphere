# Study Sphere 开发指南

欢迎使用 **Study Sphere** 开发指南 —— 这是您通过笔记、测验和 AI 辅助进行智慧学习的一站式平台。

---

## 项目设置

### 前置要求

* **Bun**（JavaScript 运行时）- [安装 Bun](https://bun.sh/docs/installation)
* **Node.js**（备用方案）
* **Git**

### 1. 克隆仓库

```bash
git clone https://github.com/k0msenapati/study-sphere.git
cd study-sphere
```

### 2. 安装依赖

```bash
bun install
```

### 3. 设置环境变量

在根目录中创建 `.env.local` 文件：

```env
LLM_API_KEY=your_vercel_ai_gateway_key_here    # 推荐 Vercel AI Gateway 的 vck_ 开头密钥
OPENAI_API_KEY=your_vercel_ai_gateway_key_here # 同上，兼容别名
```

### 4. 设置 SQLITE 数据库

#### 创建 sqlite.db 文件
前往终端并运行以下命令：

```bash
npx drizzle-kit push
```

这将在项目根目录中创建一个 `sqlite.db` 文件。

⚠️ **警告：** 不建议打开 `sqlite.db` 文件并手动进行更改，因为 sqlite.db 文件以二进制格式存储。
如果您进行了更改，可以删除该文件并运行：

```bash
npx drizzle-kit push
```

这将再次创建一个新的空白 `sqlite.db` 文件，您就可以继续您的贡献工作了

#### 删除 sqlite.db 文件
尝试删除 `sqlite.db` 文件时，您可能会遇到以下错误：

![App Preview](./public/sqlite_db_error.png)

当您尝试在 `sqlite.db` 文件正在被 Next.js 应用或 drizzle studio 使用时删除它，就会发生这种情况。

解决方案：
- 停止正在使用 `sqlite.db` 文件的工作
- 然后删除该文件

### 5. 运行开发服务器

```bash
bun run dev
```

然后在浏览器中打开 [http://localhost:3000](http://localhost:3000)。

---

## 演示视频

- 以下是一个演示视频，展示如何设置和运行项目：
<a href="https://www.youtube.com/watch?v=fHgIxKXQMN4" target="_blank">
  <img src="https://img.youtube.com/vi/fHgIxKXQMN4/0.jpg" alt="Watch the demo" width="600" />
</a>

## 项目结构

```
study-sphere/
├── public/
├── src/
│   ├── app/              # Next.js 页面与路由
│   ├── components/       # UI 组件
│   ├── lib/              # 工具库
├── .env.local            # API 密钥
├── next.config.mjs       # Next.js 配置
├── tsconfig.json         # TypeScript 配置
├── tailwind.config.ts    # Tailwind CSS 配置
└── biome.json            # 代码格式化
```

---

## 测试与代码检查

* **Biome** 用于格式化和代码检查。

```bash
bun run lint
bun run format
```

---

## 有用的脚本

| 脚本           | 描述                   |
| ------------ | --------------------- |
| `bun dev`    | 启动开发服务器            |
| `bun build`  | 构建生产版本              |
| `bun lint`   | 检查代码库（Biome）       |
| `bun format` | 格式化代码（Biome）       |

---

## 故障排除

* **Bun 无法正常工作？** 尝试切换到 Node.js + npm/yarn。
* **LLM\_API\_KEY / OPENAI\_API\_KEY 无效？** 确保您的密钥正确（Vercel AI Gateway 应以 `vck_` 开头）并且可以访问 Vercel AI Gateway 服务。

---

祝您开发愉快！🎉
