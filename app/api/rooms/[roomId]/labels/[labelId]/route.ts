import { NextRequest, NextResponse } from "next/server"
import {
  deleteRoomLabel,
  getRoomLabels,
  updateRoomLabel,
  verifyRoomMembership,
} from "@/lib/db/queries"
import {
  broadcastRoomLabels,
  broadcastRoomParticipants,
} from "@/lib/socket/broadcast"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; labelId: string }> }
) {
  try {
    const { roomId, labelId } = await params
    const { participantId, name, isValid } = await request.json()

    if (!participantId) {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 })
    }

    const membership = await verifyRoomMembership(roomId, participantId)
    if (!membership) {
      return NextResponse.json({ error: "방 참여 권한이 없습니다." }, { status: 403 })
    }

    const label = await updateRoomLabel({
      roomId,
      labelId,
      name: name !== undefined ? String(name) : undefined,
      isValid: isValid !== undefined ? Boolean(isValid) : undefined,
    })

    if (!label) {
      return NextResponse.json({ error: "라벨을 찾을 수 없습니다." }, { status: 404 })
    }

    await broadcastRoomLabels(roomId)

    const labels = await getRoomLabels(roomId)
    const enriched = labels.find((l) => l.id === labelId) ?? label
    return NextResponse.json({ label: enriched })
  } catch (error) {
    console.error("Update label error:", error)
    return NextResponse.json({ error: "라벨 수정에 실패했습니다." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; labelId: string }> }
) {
  try {
    const { roomId, labelId } = await params
    const { participantId } = await request.json()

    if (!participantId) {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 })
    }

    const deleted = await deleteRoomLabel({ roomId, labelId, participantId })

    if (!deleted) {
      return NextResponse.json({ error: "라벨을 찾을 수 없습니다." }, { status: 404 })
    }

    await broadcastRoomLabels(roomId)
    await broadcastRoomParticipants(roomId)

    const labels = await getRoomLabels(roomId)
    return NextResponse.json({ success: true, labels })
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 })
    }
    console.error("Delete label error:", error)
    return NextResponse.json({ error: "라벨 삭제에 실패했습니다." }, { status: 500 })
  }
}
