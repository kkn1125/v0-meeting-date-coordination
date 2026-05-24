import { NextRequest, NextResponse } from "next/server"
import { findParticipantById } from "@/lib/db/queries"
import { verifyPassword, setAuthCookieOnResponse } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { participantId, password } = await request.json()

    if (!participantId || !password?.trim()) {
      return NextResponse.json(
        { error: "participantId와 비밀번호가 필요합니다." },
        { status: 400 }
      )
    }

    const participant = await findParticipantById(participantId)

    if (!participant) {
      return NextResponse.json(
        { error: "참가자를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    if (!participant.password_hash) {
      return NextResponse.json(
        { error: "비밀번호가 설정되지 않은 계정입니다." },
        { status: 400 }
      )
    }

    const isValid = await verifyPassword(password, participant.password_hash)

    if (!isValid) {
      return NextResponse.json(
        { error: "비밀번호가 일치하지 않습니다." },
        { status: 401 }
      )
    }

    const response = NextResponse.json({
      success: true,
      user: { id: participant.id, name: participant.name },
    })

    return setAuthCookieOnResponse(response, participant.id)
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "로그인에 실패했습니다." },
      { status: 500 }
    )
  }
}
