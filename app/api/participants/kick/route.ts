import { NextRequest, NextResponse } from "next/server"
import { setRoomParticipantActive } from "@/lib/db/queries"
import { broadcastRoomParticipants } from "@/lib/socket/broadcast"

export async function POST(request: NextRequest) {
  try {
    const { roomId, participantId, action } = await request.json()

    if (!roomId || !participantId) {
      return NextResponse.json(
        { error: "roomId와 참여자 ID가 필요합니다." },
        { status: 400 }
      )
    }

    const isActive = action === "restore"
    await setRoomParticipantActive(roomId, participantId, isActive)
    await broadcastRoomParticipants(roomId)

    return NextResponse.json({
      success: true,
      action: isActive ? "restored" : "kicked",
    })
  } catch (error) {
    console.error("Kick/Restore error:", error)
    return NextResponse.json(
      { error: "작업에 실패했습니다." },
      { status: 500 }
    )
  }
}
