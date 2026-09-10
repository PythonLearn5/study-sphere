// src/app/dashboard/layout.tsx
"use client"

import { redirect } from 'next/navigation'
import { Sidebar } from "@/components/dashboard/sidebar"
import { FlashcardsProvider } from "@/lib/flashcards/flashcards-provider"
import { TasksProvider } from "@/lib/tasks/tasks-provider"
import { FlowchartProvider } from "@/lib/flowcharts/flowcharts-provider"
import { useEffect, useState } from "react"
import { CopilotKitProvider, CopilotPopup } from "@copilotkit/react-core/v2"
import "@copilotkit/react-core/v2/styles.css"

// ℹ️ CopilotKit v2 Provider（已升级到 ^1.70.0）
// v2 架构移除了 GraphQL，前端不再需要 agents__unsafe_dev_only / useSingleEndpoint。
// Provider 只需 runtimeUrl，后端由 createCopilotRuntimeHandler 自动处理握手 + 聊天。
// Tailwind v4 升级后，CopilotKit v2 CSS（Tailwind v4 编译）可直接 import，无需 hack。

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const [session, setSession] = useState<{ userId: number; email: string } | null>(null)
  const [loading, setLoading] = useState(true)

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
    <CopilotKitProvider runtimeUrl="/api/copilotkit">
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
            />
          </FlowchartProvider>
        </TasksProvider>
      </FlashcardsProvider>
    </CopilotKitProvider>
  )
}
