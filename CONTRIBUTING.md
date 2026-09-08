# 为 Study Sphere 做贡献

首先，感谢您考虑为 Study Sphere 做贡献！🙌

---

## 开始使用

1. **Fork 仓库**
2. **克隆您的 Fork**

```bash
git clone https://github.com/<your-username>/study-sphere.git
cd study-sphere
```

3. **设置项目**

   * 按照 [开发指南](./DEVELOPMENT.md) 在本地安装和运行。

---

## 贡献指南

### 项目设置说明

* 确保您已安装 `bun`：[https://bun.sh](https://bun.sh)
* 安装依赖：

```bash
bun install
```

* 运行开发服务器：

```bash
bun run dev
```

* 格式化和检查代码：

```bash
bun run format
bun run lint
```

### 分支策略

* 始终从 `main` 分支创建新分支：

```bash
git checkout -b feat/your-feature-name
```

* 分支命名使用以下前缀：

| 类型      | 前缀       |
| ------- | -------- |
| 功能      | `feat/`  |
| 修复      | `fix/`   |
| 文档      | `docs/`  |
| 杂项      | `chore/` |

### 提交消息格式

使用 [约定式提交](https://www.conventionalcommits.org/en/v1.0.0/)：

```bash
git commit -m "feat(component): add navbar component"
```

### 拉取请求流程

* 确保您的 PR 包含清晰的标题和描述。
* 关联任何相关的 issue。
* 如适用，请添加截图或演示。
* PR 应满足以下要求：

  * 通过代码检查和格式化检查
  * 至少经过一位维护者审核
  * 与 `main` 分支可以干净地变基或合并

---

## 如何提交 Bug 报告

* 打开一个 [issue](https://github.com/k0msenapati/study-sphere/issues)
* 选择 **Bug Report** 模板
* 包含以下内容：

  * 复现步骤
  * 预期行为与实际行为
  * 如有帮助，请提供截图或日志

---

## 如何请求新功能

* 打开一个 [issue](https://github.com/k0msenapati/study-sphere/issues)
* 选择 **Feature Request** 模板
* 描述以下内容：

  * 您要解决的问题
  * 为什么它很重要
  * 您提议的解决方案

---

## 拉取请求清单

在提交拉取请求之前，请确保满足以下条件：

* [ ] **清晰的标题和描述**，说明 PR 的内容
* [ ] **遵循分支策略**（`feat/`、`fix/` 等）并**使用约定式提交**
* [ ] 代码**格式规范**并通过代码检查：

  ```bash
  bun run format && bun run lint
  ```
* [ ] 如适用，包含**测试**或**相关使用示例**
* [ ] 所有**新增/更新的组件都已记录文档**
* [ ] 包含截图/演示（用于 UI 更改）
* [ ] 关联到相关的 **issue**（如果存在）
* [ ] PR 与 `main` 分支保持同步（推送前执行 `git pull origin main`）
* [ ] 准备好审核：标记适当的标签（如 `enhancement`、`bug`、`docs`）
* [ ] 至少经过一位维护者审核和批准

---

## 有用的资源

* [Bun 文档](https://bun.sh/docs)
* [约定式提交指南](https://www.conventionalcommits.org/en/v1.0.0/)
* [开源指南](https://opensource.guide/how-to-contribute/)

---

## 行为准则

我们遵循 [贡献者公约行为准则](./CODE_OF_CONDUCT.md)。请在所有贡献中保持尊重、包容和协作精神。

---

让我们一起构建伟大的东西！
