import { NextRequest, NextResponse } from "next/server"
import {
  deleteMemo,
  getActiveRoomParticipantIds,
  mergeInboxRecipientIds,
  updateMemo,
  verifyRoomMembership,
} from "@/lib/db/queries"
import { notifyRoomMemosUpdated } from "@/lib/socket/notify-relay"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; memoId: string }> }
) {
  try {
    const { roomId, memoId } = await params
    const { authorParticipantId, content, mentionParticipantIds } =
      await request.json()

    if (!authorParticipantId || !content?.trim()) {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 })
    }

    const membership = await verifyRoomMembership(roomId, authorParticipantId)
    if (!membership) {
      return NextResponse.json({ error: "방 참여 권한이 없습니다." }, { status: 403 })
    }

    const activeIds = await getActiveRoomParticipantIds(roomId)
    const mentions = (mentionParticipantIds ?? []).filter((id: string) =>
      activeIds.includes(id)
    )

    const { memo, affectedRecipientIds } = await updateMemo({
      roomId,
      memoId,
      authorParticipantId,
      content: content.trim(),
      mentionParticipantIds: mentions,
    })

    if (!memo) {
      return NextResponse.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 })
    }

    const inboxRecipients = mergeInboxRecipientIds(
      affectedRecipientIds,
      mentions,
      [authorParticipantId]
    )
    await notifyRoomMemosUpdated(roomId, inboxRecipients)

    return NextResponse.json({ memo })
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "수정 권한이 없습니다." }, { status: 403 })
    }
    console.error("Update memo error:", error)
    return NextResponse.json({ error: "메모 수정에 실패했습니다." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string; memoId: string }> }
) {
  try {
    const { roomId, memoId } = await params
    const { participantId } = await request.json()

    if (!participantId) {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 })
    }

    const { deleted, affectedRecipientIds } = await deleteMemo({
      roomId,
      memoId,
      participantId,
    })

    if (!deleted) {
      return NextResponse.json({ error: "메모를 찾을 수 없습니다." }, { status: 404 })
    }

    const inboxRecipients = mergeInboxRecipientIds(
      affectedRecipientIds,
      [participantId]
    )
    await notifyRoomMemosUpdated(roomId, inboxRecipients)

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return NextResponse.json({ error: "삭제 권한이 없습니다." }, { status: 403 })
    }
    console.error("Delete memo error:", error)
    return NextResponse.json({ error: "메모 삭제에 실패했습니다." }, { status: 500 })
  }
}
