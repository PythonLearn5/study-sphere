# UI 组件

## 🎨 设计系统

Study Sphere 使用 Tailwind CSS 和 Radix UI 原语来构建一致、可访问的组件。

## 🏗️ 组件结构

```
src/components/ui/       # 基础 UI 组件
├── button.tsx          # 按钮变体
├── card.tsx           # 容器组件
├── dialog.tsx         # 模态对话框
├── input.tsx          # 表单输入
├── textarea.tsx       # 文本域
├── select.tsx         # 下拉选择
├── checkbox.tsx       # 复选框
├── switch.tsx         # 切换开关
├── badge.tsx          # 状态徽章
├── progress.tsx       # 进度条
├── flashcard.tsx      # 自定义抽认卡组件
└── ...               # 其他 UI 原语
```

## 🎯 设计令牌

### 颜色
- **主色**：深色文本和按钮
- **辅色**：浅色背景
- **柔和色**：细微背景
- **强调色**：高亮元素
- **破坏色**：错误状态

### 排版
- **Sans**：Geist Sans（主字体）
- **Mono**：Geist Mono（代码字体）

## 🧩 关键组件

### 按钮组件
```typescript
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground",
        outline: "border border-input hover:bg-accent",
        secondary: "bg-secondary text-secondary-foreground",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
  }
);
```

### 卡片组件
```typescript
const Card = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "rounded-lg border bg-card text-card-foreground shadow-sm",
      className
    )}
    {...props}
  />
));
```

## 🎨 主题支持

### 深色/浅色模式
- 系统偏好检测
- 手动主题切换
- 一致的配色方案
- 可访问的对比度比率

### CSS 变量
```css
:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
  --card: 0 0% 100%;
  --card-foreground: 222.2 84% 4.9%;
  --primary: 222.2 47.4% 11.2%;
  --primary-foreground: 210 40% 98%;
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --card: 222.2 84% 4.9%;
  --card-foreground: 210 40% 98%;
  --primary: 210 40% 98%;
  --primary-foreground: 222.2 47.4% 11.2%;
}
```

## ♿ 可访问性功能

### 可访问性实现流程
```mermaid
flowchart TD
    A[组件开发] --> B[WCAG 2.1 AA 指南]
    B --> C[键盘导航]
    B --> D[屏幕阅读器支持]
    B --> E[颜色对比度]
    B --> F[焦点管理]
    
    C --> G[Tab 顺序]
    C --> H[键盘快捷键]
    C --> I[Enter/Space 操作]
    
    D --> J[ARIA 标签]
    D --> K[ARIA 描述]
    D --> L[语义化 HTML]
    
    E --> M[对比度 4.5:1]
    E --> N[颜色独立性]
    
    F --> O[焦点指示器]
    F --> P[焦点陷阱]
    F --> Q[跳转链接]
    
    G --> R[可访问组件]
    H --> R
    I --> R
    J --> R
    K --> R
    L --> R
    M --> R
    N --> R
    O --> R
    P --> R
    Q --> R
```

### 组件可访问性流程
```mermaid
flowchart TD
    A[用户交互] --> B{输入方式}
    B -->|鼠标| C[点击处理器]
    B -->|键盘| D[按键处理器]
    B -->|屏幕阅读器| E[ARIA 播报]
    
    C --> F[视觉反馈]
    D --> G[键盘导航]
    E --> H[语义信息]
    
    F --> I[焦点样式]
    G --> J[Tab 管理]
    H --> K[角色描述]
    
    I --> L[可访问操作]
    J --> L
    K --> L
    
    L --> M[状态更新]
    M --> N[屏幕阅读器通知]
```

## 📱 响应式设计

- 移动优先方法
- 断点系统：
  - `sm`：640px
  - `md`：768px
  - `lg`：1024px
  - `xl`：1280px
  - `2xl`：1536px

## 🎯 组件使用

### 组件层次流程
```mermaid
flowchart TD
    A[应用布局] --> B[主题提供器]
    B --> C[导航组件]
    B --> D[页面组件]
    
    C --> E[导航栏]
    C --> F[主题切换]
    
    D --> G[认证页面]
    D --> H[仪表盘页面]
    
    G --> I[登录表单]
    G --> J[注册表单]
    
    H --> K[笔记页面]
    H --> L[抽认卡页面]
    H --> M[对话页面]
    H --> N[任务页面]
    
    K --> O[笔记网格]
    O --> P[笔记卡片]
    P --> Q[按钮、输入、文本域]
    
    L --> R[抽认卡组件]
    R --> S[卡片、按钮、徽章]
    
    M --> T[对话界面]
    T --> U[消息列表、输入、按钮]
    
    N --> V[任务列表]
    V --> W[任务项]
    W --> X[复选框、徽章、按钮]
```

### 表单组件流程
```mermaid
flowchart TD
    A[表单容器] --> B[表单字段]
    B --> C[输入组件]
    B --> D[选择组件]
    B --> E[操作组件]
    
    C --> F[输入框]
    C --> G[文本域]
    C --> H[标签]
    
    D --> I[选择框]
    D --> J[复选框]
    D --> K[开关]
    
    E --> L[按钮]
    E --> M[提交处理器]
    
    F --> N[验证]
    G --> N
    I --> N
    J --> N
    K --> N
    
    N --> O{有效？}
    O -->|是| P[表单提交]
    O -->|否| Q[显示错误]
```

### 布局组件流程
```mermaid
flowchart TD
    A[页面布局] --> B[卡片容器]
    B --> C[卡片头部]
    B --> D[卡片内容]
    B --> E[卡片底部]
    
    C --> F[卡片标题]
    C --> G[卡片描述]
    
    D --> H[主要内容]
    D --> I[交互元素]
    
    E --> J[操作按钮]
    E --> K[状态指示器]
    
    I --> L[表单]
    I --> M[列表]
    I --> N[数据展示]
    
    L --> O[输入字段]
    L --> P[按钮]
    
    M --> Q[可滚动区域]
    M --> R[项目卡片]
    
    N --> S[进度条]
    N --> T[徽章]
    N --> U[工具提示]
```

### 主题系统流程
```mermaid
flowchart TD
    A[主题提供器] --> B[检测系统偏好]
    B --> C{用户覆盖？}
    C -->|是| D[使用用户设置]
    C -->|否| E[使用系统设置]
    
    D --> F[应用主题]
    E --> F
    
    F --> G[更新 CSS 变量]
    G --> H[组件重新渲染]
    H --> I[主题切换更新]
    
    J[用户点击切换] --> K[切换主题]
    K --> L[保存偏好]
    L --> D
```

### 响应式设计流程
```mermaid
flowchart TD
    A[屏幕尺寸检测] --> B{断点检查}
    B -->|< 640px| C[移动端布局]
    B -->|640px - 768px| D[小平板]
    B -->|768px - 1024px| E[平板布局]
    B -->|1024px - 1280px| F[桌面布局]
    B -->|> 1280px| G[大桌面]
    
    C --> H[垂直堆叠]
    C --> I[隐藏次要导航]
    C --> J[紧凑按钮]
    
    D --> K[2 列网格]
    E --> L[3 列网格]
    F --> M[侧边栏 + 主内容]
    G --> N[宽布局]
    
    H --> O[应用移动端样式]
    I --> O
    J --> O
    K --> P[应用平板样式]
    L --> P
    M --> Q[应用桌面样式]
    N --> Q
```

### 带组件的表单示例
```tsx
<form>
  <Input placeholder="输入文本..." />
  <Textarea placeholder="输入描述..." />
  <Select>
    <SelectItem value="option1">选项 1</SelectItem>
  </Select>
  <Button type="submit">提交</Button>
</form>
```

### 带组件的布局示例
```tsx
<Card>
  <CardHeader>
    <CardTitle>标题</CardTitle>
  </CardHeader>
  <CardContent>
    内容在此处
  </CardContent>
</Card>
```

## 🔧 配置

组件通过 `components.json` 配置：
```json
{
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/app/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils"
  }
}
```
