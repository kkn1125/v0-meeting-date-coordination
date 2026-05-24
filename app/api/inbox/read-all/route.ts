import { NextRequest, NextResponse } from "next/server"
import { markAllInboxRead } from "@/lib/db/queries"
import { requireAuth, isAuthError } from "@/lib/auth"
import { notifyInboxUpdated } from "@/lib/socket/notify-relay"

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (isAuthError(auth)) return auth

    await markAllInboxRead(auth.participantId)
    await notifyInboxUpdated([auth.participantId], request)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Mark all inbox read error:", error)
    return NextResponse.json({ error: "전체 읽음 처리에 실패했습니다." }, { status: 500 })
  }
}
