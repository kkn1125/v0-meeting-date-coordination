import { NextRequest, NextResponse } from "next/server"
import {
  deleteInboxNotification,
  toggleInboxRead,
} from "@/lib/db/queries"
import { broadcastInbox } from "@/lib/socket/broadcast"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { participantId, isRead } = await request.json()

    if (!participantId || typeof isRead !== "boolean") {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 })
    }

    const updated = await toggleInboxRead(id, participantId, isRead)
    if (!updated) {
      return NextResponse.json({ error: "알림을 찾을 수 없습니다." }, { status: 404 })
    }

    await broadcastInbox(participantId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Toggle inbox read error:", error)
    return NextResponse.json({ error: "읽음 처리에 실패했습니다." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { participantId } = await request.json()

    if (!participantId) {
      return NextResponse.json({ error: "participantId가 필요합니다." }, { status: 400 })
    }

    const deleted = await deleteInboxNotification(id, participantId)
    if (!deleted) {
      return NextResponse.json({ error: "알림을 찾을 수 없습니다." }, { status: 404 })
    }

    await broadcastInbox(participantId)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete inbox error:", error)
    return NextResponse.json({ error: "알림 삭제에 실패했습니다." }, { status: 500 })
  }
}
