import { NextRequest, NextResponse } from "next/server"
import { joinRoom } from "@/lib/db/queries"
import { broadcastRoomParticipants } from "@/lib/socket/broadcast"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "이름이 필요합니다." }, { status: 400 })
    }

    const participant = await joinRoom(roomId, name.trim())
    await broadcastRoomParticipants(roomId)

    return NextResponse.json({ participant })
  } catch (error) {
    console.error("Join room error:", error)
    return NextResponse.json({ error: "참여에 실패했습니다." }, { status: 500 })
  }
}
