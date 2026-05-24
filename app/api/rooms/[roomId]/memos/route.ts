import { NextRequest, NextResponse } from "next/server"
import {
  createMemo,
  getActiveRoomParticipantIds,
  getMemosByRoom,
  mergeInboxRecipientIds,
  verifyDateRangeInRoom,
} from "@/lib/db/queries"
import { requireRoomMember, isAuthError } from "@/lib/auth"
import { notifyRoomMemosUpdated } from "@/lib/socket/notify-relay"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const auth = await requireRoomMember(request, roomId)
    if (isAuthError(auth)) return auth

    const dateRangeId = request.nextUrl.searchParams.get("dateRangeId") ?? undefined
    const memos = await getMemosByRoom(roomId, dateRangeId)
    return NextResponse.json({ memos })
  } catch (error) {
    console.error("Get memos error:", error)
    return NextResponse.json({ error: "메모 조회에 실패했습니다." }, { status: 500 })
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

    const { dateRangeId, content, mentionParticipantIds } = await request.json()

    if (!dateRangeId || !content?.trim()) {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 })
    }

    const dateRange = await verifyDateRangeInRoom(roomId, dateRangeId)
    if (!dateRange) {
      return NextResponse.json({ error: "유효하지 않은 기간입니다." }, { status: 400 })
    }

    const activeIds = await getActiveRoomParticipantIds(roomId)
    const mentions = (mentionParticipantIds ?? []).filter((id: string) =>
      activeIds.includes(id)
    )

    const memoResult = await createMemo({
      roomId,
      dateRangeId,
      authorParticipantId: auth.participantId,
      content: content.trim(),
      mentionParticipantIds: mentions,
    })

    const inboxRecipients = mergeInboxRecipientIds(
      memoResult.affectedRecipientIds,
      mentions,
      [auth.participantId]
    )
    await notifyRoomMemosUpdated(roomId, inboxRecipients)

    return NextResponse.json({ memo: memoResult.memo })
  } catch (error) {
    console.error("Create memo error:", error)
    return NextResponse.json({ error: "메모 생성에 실패했습니다." }, { status: 500 })
  }
}
