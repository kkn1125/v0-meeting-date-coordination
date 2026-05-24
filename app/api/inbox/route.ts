import { NextRequest, NextResponse } from "next/server"
import { getInboxByParticipantId } from "@/lib/db/queries"
import { requireAuth, isAuthError } from "@/lib/auth"

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (isAuthError(auth)) return auth

    const notifications = await getInboxByParticipantId(auth.participantId)
    const unreadCount = notifications.filter((n) => !n.is_read).length

    return NextResponse.json({
      notifications,
      unreadCount,
      participantId: auth.participantId,
    })
  } catch (error) {
    console.error("Get inbox error:", error)
    return NextResponse.json({ error: "알림 조회에 실패했습니다." }, { status: 500 })
  }
}
