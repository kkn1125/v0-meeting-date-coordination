import { NextRequest, NextResponse } from "next/server"
import {
  createMemo,
  getActiveRoomParticipantIds,
  getMemosByRoom,
  mergeInboxRecipientIds,
  verifyDateRangeInRoom,
  verifyRoomMembership,
} from "@/lib/db/queries"
import { notifyRoomMemosUpdated } from "@/lib/socket/notify-relay"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
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
    const { authorParticipantId, dateRangeId, content, mentionParticipantIds } =
      await request.json()

    if (!authorParticipantId || !dateRangeId || !content?.trim()) {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 })
    }

    const membership = await verifyRoomMembership(roomId, authorParticipantId)
    if (!membership) {
      return NextResponse.json({ error: "방 참여 권한이 없습니다." }, { status: 403 })
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
      authorParticipantId,
      content: content.trim(),
      mentionParticipantIds: mentions,
    })

    const inboxRecipients = mergeInboxRecipientIds(
      memoResult.affectedRecipientIds,
      mentions,
      [authorParticipantId]
    )
    await notifyRoomMemosUpdated(roomId, inboxRecipients)

    return NextResponse.json({ memo: memoResult.memo })
  } catch (error) {
    console.error("Create memo error:", error)
    return NextResponse.json({ error: "메모 생성에 실패했습니다." }, { status: 500 })
  }
}
