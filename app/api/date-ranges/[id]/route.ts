import { NextRequest, NextResponse } from "next/server"
import {
  deleteDateRange,
  getDateRangeById,
  updateDateRangeLabel,
} from "@/lib/db/queries"
import { requireRoomMember, isAuthError } from "@/lib/auth"
import { broadcastRoomParticipants } from "@/lib/socket/broadcast"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const { roomId, labelId } = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 })
    }

    const auth = await requireRoomMember(request, roomId)
    if (isAuthError(auth)) return auth

    const range = await updateDateRangeLabel({
      roomId,
      dateRangeId: id,
      participantId: auth.participantId,
      labelId: labelId ?? null,
    })

    if (!range) {
      return NextResponse.json({ error: "기간을 찾을 수 없습니다." }, { status: 404 })
    }

    await broadcastRoomParticipants(roomId)

    return NextResponse.json({ dateRange: range })
  } catch (error) {
    if (error instanceof Error) {
      if (error.message === "FORBIDDEN") {
        return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
      }
      if (error.message === "LABEL_LOCKED") {
        return NextResponse.json(
          { error: "유효하지 않은 라벨이 연결된 기간은 라벨을 변경할 수 없습니다." },
          { status: 403 }
        )
      }
      if (error.message === "INVALID_LABEL") {
        return NextResponse.json({ error: "유효하지 않은 라벨입니다." }, { status: 400 })
      }
    }
    console.error("Update date range label error:", error)
    return NextResponse.json({ error: "라벨 지정에 실패했습니다." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const existing = await getDateRangeById(id)
    if (!existing) {
      return NextResponse.json({ error: "기간을 찾을 수 없습니다." }, { status: 404 })
    }

    const auth = await requireRoomMember(request, existing.room_id)
    if (isAuthError(auth)) return auth

    if (existing.participant_id !== auth.participantId) {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 })
    }

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
