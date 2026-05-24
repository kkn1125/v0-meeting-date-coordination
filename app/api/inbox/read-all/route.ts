import { NextRequest, NextResponse } from "next/server"
import { markAllInboxRead } from "@/lib/db/queries"
import { notifyInboxUpdated } from "@/lib/socket/notify-relay"

export async function PATCH(request: NextRequest) {
  try {
    const { participantId } = await request.json()
    if (!participantId) {
      return NextResponse.json({ error: "participantId가 필요합니다." }, { status: 400 })
    }

    await markAllInboxRead(participantId)
    await notifyInboxUpdated([participantId], request)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Mark all inbox read error:", error)
    return NextResponse.json({ error: "전체 읽음 처리에 실패했습니다." }, { status: 500 })
  }
}
