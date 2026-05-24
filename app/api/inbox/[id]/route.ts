import { NextRequest, NextResponse } from "next/server"
import {
  deleteInboxNotification,
  toggleInboxRead,
} from "@/lib/db/queries"
import { requireAuth, isAuthError } from "@/lib/auth"
import { notifyInboxUpdated } from "@/lib/socket/notify-relay"

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (isAuthError(auth)) return auth

    const { id } = await params
    const { isRead } = await request.json()

    if (typeof isRead !== "boolean") {
      return NextResponse.json({ error: "필수 필드가 누락되었습니다." }, { status: 400 })
    }

    const updated = await toggleInboxRead(id, auth.participantId, isRead)
    if (!updated) {
      return NextResponse.json({ error: "알림을 찾을 수 없습니다." }, { status: 404 })
    }

    await notifyInboxUpdated([auth.participantId], request)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Toggle inbox read error:", error)
    return NextResponse.json({ error: "읽음 처리에 실패했습니다." }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request)
    if (isAuthError(auth)) return auth

    const { id } = await params

    const deleted = await deleteInboxNotification(id, auth.participantId)
    if (!deleted) {
      return NextResponse.json({ error: "알림을 찾을 수 없습니다." }, { status: 404 })
    }

    await notifyInboxUpdated([auth.participantId], request)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Delete inbox error:", error)
    return NextResponse.json({ error: "알림 삭제에 실패했습니다." }, { status: 500 })
  }
}
