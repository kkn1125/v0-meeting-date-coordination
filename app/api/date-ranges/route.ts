import { NextRequest, NextResponse } from "next/server"
import {
  insertDateRange,
  verifyRoomMembership,
  verifyValidLabelInRoom,
} from "@/lib/db/queries"
import { broadcastRoomParticipants } from "@/lib/socket/broadcast"

export async function POST(request: NextRequest) {
  try {
    const { participantId, roomId, startDate, endDate, isAvailable, labelId } =
      await request.json()

    if (!participantId || !roomId || !startDate || !endDate) {
      return NextResponse.json(
        { error: "필수 필드가 누락되었습니다." },
        { status: 400 }
      )
    }

    const membership = await verifyRoomMembership(roomId, participantId)
    if (!membership) {
      return NextResponse.json({ error: "방 참여 권한이 없습니다." }, { status: 403 })
    }

    if (labelId) {
      const valid = await verifyValidLabelInRoom(roomId, labelId)
      if (!valid) {
        return NextResponse.json({ error: "유효하지 않은 라벨입니다." }, { status: 400 })
      }
    }

    await insertDateRange({
      participantId,
      roomId,
      startDate,
      endDate,
      isAvailable: Boolean(isAvailable),
      labelId: labelId ?? null,
    })

    await broadcastRoomParticipants(roomId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Insert date range error:", error)
    return NextResponse.json({ error: "날짜 저장에 실패했습니다." }, { status: 500 })
  }
}
