import { NextRequest, NextResponse } from "next/server"
import { joinRoom } from "@/lib/db/queries"
import { requireAuth, isAuthError } from "@/lib/auth"
import { broadcastRoomParticipants } from "@/lib/socket/broadcast"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (isAuthError(auth)) return auth

    const { roomId } = await params

    const participant = await joinRoom(roomId, auth.name)
    await broadcastRoomParticipants(roomId)

    return NextResponse.json({ participant })
  } catch (error) {
    console.error("Join room error:", error)
    return NextResponse.json({ error: "참여에 실패했습니다." }, { status: 500 })
  }
}
