// src/app/dashboard/layout.tsx
"use client"

import { redirect } from 'next/navigation'
import { Sidebar } from "@/components/dashboard/sidebar"
import { FlashcardsProvider } from "@/lib/flashcards/flashcards-provider"
import { TasksProvider } from "@/lib/tasks/tasks-provider"
import { FlowchartProvider } from "@/lib/flowcharts/flowcharts-provider"
import { useEffect, useMemo, useState } from "react"
import { CopilotKit } from "@copilotkit/react-core"
import { CopilotPopup } from "@copilotkit/react-ui"
import { HttpAgent } from "@ag-ui/client"
import "@copilotkit/react-ui/styles.css"

// ℹ️ CopilotKit Provider 已恢复（用于学习 CopilotKit 功能用法）
// 注意：
//  - 主聊天页 /dashboard/chat 仍然走自研 SSE 接口 /api/chat/completion（用于对比学习）
//  - 本 Provider 提供的是【右下角悬浮气泡 CopilotPopup】那套 AI 助手（基于 Copilot Runtime）
//  - 如果只想用 /dashboard/chat 而不想看到气泡，只需删除下面 <CopilotPopup/> 一行即可
//  - 握手探测端点 GET /api/copilotkit/info 已启用，不会再 404 刷屏

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [session, setSession] = useState<{ userId: number; email: string } | null>(null)
  const [loading, setLoading] = useState(true)

  const agents__unsafe_dev_only = useMemo(() => ({
    default: new HttpAgent({
      description: "默认学习助手（基于 Vercel AI Gateway 的 openai:gpt-4o-mini）。擅长笔记、闪卡、流程图、测验的一般性学习问题。",
      url: "/api/copilotkit",
    }),
  }), [])

  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch('/api/auth/session')
        if (response.ok) {
          const sessionData = await response.json()
          setSession(sessionData)
        } else {
          redirect('/auth/login')
        }
      } catch (error) {
        console.error('Failed to fetch session:', error)
        redirect('/auth/login')
      } finally {
        setLoading(false)
      }
    }

    fetchSession()
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (!session) {
    redirect('/auth/login')
    return null
  }

  return (
    <CopilotKit
      runtimeUrl="/api/copilotkit"
      agents__unsafe_dev_only={agents__unsafe_dev_only}
      useSingleEndpoint={true}
    >
      <FlashcardsProvider>
        <TasksProvider>
          <FlowchartProvider>
            <div className="flex h-screen bg-background">
              <Sidebar session={session} />
              <div className="flex-1 flex flex-col overflow-hidden">
                <main className="flex-1 overflow-y-auto bg-background">
                  {children}
                </main>
              </div>
            </div>
            <CopilotPopup
              defaultOpen={false}
              labels={{
                title: "Study Sphere AI 助手 (CopilotKit)",
                initial: "有什么学习问题？可以问我任何关于笔记、闪卡、流程图、测验的内容～",
                placeholder: "输入你的问题…",
              }}
              clickOutsideToClose={true}
            />
          </FlowchartProvider>
        </TasksProvider>
      </FlashcardsProvider>
    </CopilotKit>
  )
}
