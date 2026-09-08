import { NextResponse } from "next/server";

/**
 * GET /api/copilotkit/info
 *
 * 这个端点只用来"消警"：旧版 CopilotKit Provider 会自动探测这个 URL，
 * 失败就反复报 Runtime did not answer within 5000ms / runtime_info_fetch_failed
 * 刷屏 Console。
 *
 * 现在我们已经把主聊天页改成直接调 /api/chat/completion 了，CopilotKit
 * Provider 也在 dashboard/layout.tsx 里被移除。这里保留一个最小化 stub，
 * 是为了将来万一恢复 CopilotKit Provider，或者用户自己在别的页面
 * import 了 CopilotKit 相关 hooks 时，不会再 404 报警。
 */
export function GET() {
  return NextResponse.json(
    {
      protocol: "copilotkit-http",
      version: "1.0.0",
      capabilities: {
        actions: false,
        agents: false,
        chat: false,
      },
      agents: [],
      actions: [],
    },
    { status: 200 },
  );
}
