import { NextRequest, NextResponse } from "next/server"
import { deleteDateRange } from "@/lib/db/queries"
import { broadcastRoomParticipants } from "@/lib/socket/broadcast"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const roomId = await deleteDateRange(id)

    if (roomId) {
      await broadcastRoomParticipants(roomId)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete date range error:", error)
    return NextResponse.json({ error: "날짜 삭제에 실패했습니다." }, { status: 500 })
  }
}
