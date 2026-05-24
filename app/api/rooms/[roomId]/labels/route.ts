import { NextRequest, NextResponse } from "next/server"
import { createRoomLabel, getRoomLabels } from "@/lib/db/queries"
import { requireRoomMember, isAuthError } from "@/lib/auth"
import { broadcastRoomLabels } from "@/lib/socket/broadcast"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const auth = await requireRoomMember(request, roomId)
    if (isAuthError(auth)) return auth

    const labels = await getRoomLabels(roomId)
    return NextResponse.json({ labels })
  } catch (error) {
    console.error("Get labels error:", error)
    return NextResponse.json({ error: "라벨 조회에 실패했습니다." }, { status: 500 })
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const auth = await requireRoomMember(request, roomId)
    if (isAuthError(auth)) return auth

    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 })
    }

    const label = await createRoomLabel({
      roomId,
      participantId: auth.participantId,
      name: name.trim(),
    })

    await broadcastRoomLabels(roomId)

    return NextResponse.json({ label })
  } catch (error) {
    console.error("Create label error:", error)
    return NextResponse.json({ error: "라벨 생성에 실패했습니다." }, { status: 500 })
  }
}
