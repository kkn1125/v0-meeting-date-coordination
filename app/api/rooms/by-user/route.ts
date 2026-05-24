import { NextRequest, NextResponse } from "next/server"
import { getRoomsByParticipantName } from "@/lib/db/queries"
import { requireAuth, isAuthError } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (isAuthError(auth)) return auth

    const rooms = await getRoomsByParticipantName(auth.name)
    return NextResponse.json({ rooms })
  } catch (error) {
    console.error("Rooms by user error:", error)
    return NextResponse.json(
      { error: "참여한 모임을 불러오지 못했습니다." },
      { status: 500 }
    )
  }
}
