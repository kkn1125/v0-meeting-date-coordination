import { NextRequest, NextResponse } from "next/server"
import { getMembershipStatus } from "@/lib/db/queries"
import { requireAuth, isAuthError } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (isAuthError(auth)) return auth

    const { roomId } = await request.json()

    if (!roomId) {
      return NextResponse.json({ error: "roomId가 필요합니다." }, { status: 400 })
    }

    const status = await getMembershipStatus(roomId, auth.name)
    return NextResponse.json({ status })
  } catch (error) {
    console.error("Room membership error:", error)
    return NextResponse.json(
      { error: "멤버십 정보를 확인하지 못했습니다." },
      { status: 500 }
    )
  }
}
