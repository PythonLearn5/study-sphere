// src/app/dashboard/layout.tsx
"use client"

import { redirect } from 'next/navigation'
import { Sidebar } from "@/components/dashboard/sidebar"
import { FlashcardsProvider } from "@/lib/flashcards/flashcards-provider"
import { TasksProvider } from "@/lib/tasks/tasks-provider"
import { FlowchartProvider } from "@/lib/flowcharts/flowcharts-provider"
import { useEffect, useState } from "react"

// ⚠️ 已禁用 CopilotKit Provider
// 原因：聊天页已经重写为直接调用 /api/chat/completion（原生 SSE 流式），
// 不再依赖 CopilotKit。如果保留 CopilotKit Provider，它会在每个 dashboard 页面
// 自动发起 GET /api/copilotkit/info 握手探测，一旦探测失败就反复 404 + 5000ms
// 超时报警（Runtime did not answer within 5000ms / runtime_info_fetch_failed），
// 污染 Console，干扰我们调 Vercel AI Gateway。
//
// 将来如果要用回 CopilotKit 的 side panel 聊天功能，把下面 import 恢复、
// 并在 return 里恢复 <CopilotKit runtimeUrl="/api/copilotkit"> 包裹 children 即可。
//
// import { CopilotKit } from "@copilotkit/react-core"
// import { CopilotPopup } from "@copilotkit/react-ui"
// import "@copilotkit/react-ui/styles.css"

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
        </FlowchartProvider>
      </TasksProvider>
    </FlashcardsProvider>
  )
}
