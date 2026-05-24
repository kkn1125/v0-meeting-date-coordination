import { NextRequest, NextResponse } from "next/server"
import {
  findParticipantByName,
  getInboxByParticipantId,
} from "@/lib/db/queries"

export async function GET(request: NextRequest) {
  try {
    const participantName = request.nextUrl.searchParams.get("participantName")
    if (!participantName) {
      return NextResponse.json({ error: "participantName이 필요합니다." }, { status: 400 })
    }

    const participant = await findParticipantByName(participantName)
    if (!participant) {
      return NextResponse.json({ notifications: [], unreadCount: 0, participantId: null })
    }

    const notifications = await getInboxByParticipantId(participant.id)
    const unreadCount = notifications.filter((n) => !n.is_read).length

    return NextResponse.json({
      notifications,
      unreadCount,
      participantId: participant.id,
    })
  } catch (error) {
    console.error("Get inbox error:", error)
    return NextResponse.json({ error: "알림 조회에 실패했습니다." }, { status: 500 })
  }
}
