import { NextRequest, NextResponse } from "next/server"
import {
  findParticipantByNameWithPassword,
  createParticipant,
  findParticipantByName,
} from "@/lib/db/queries"
import { hashPassword, setAuthCookieOnResponse } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json()

    if (!name?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "이름과 비밀번호를 입력해주세요." },
        { status: 400 }
      )
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "비밀번호는 4자 이상이어야 합니다." },
        { status: 400 }
      )
    }

    const trimmedName = name.trim()
    const existingUser = await findParticipantByNameWithPassword(trimmedName)

    if (existingUser) {
      return NextResponse.json(
        { error: "이미 사용 중인 이름입니다." },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)
    await createParticipant(trimmedName, passwordHash)

    const participant = await findParticipantByName(trimmedName)
    if (!participant) {
      return NextResponse.json(
        { error: "회원가입에 실패했습니다." },
        { status: 500 }
      )
    }

    const response = NextResponse.json({
      success: true,
      user: { id: participant.id, name: participant.name },
    })

    return setAuthCookieOnResponse(response, participant.id)
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "회원가입에 실패했습니다." },
      { status: 500 }
    )
  }
}
