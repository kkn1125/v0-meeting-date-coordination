import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyPassword, createGlobalSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { name, password } = await request.json()

    if (!name?.trim() || !password?.trim()) {
      return NextResponse.json(
        { error: "이름과 비밀번호를 입력해주세요." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const trimmedName = name.trim()

    const { data: participant, error } = await supabase
      .from("participants")
      .select("*")
      .eq("name", trimmedName)
      .not("password_hash", "is", null)
      .limit(1)
      .single()

    if (error || !participant) {
      return NextResponse.json(
        { error: "해당 이름으로 등록된 계정을 찾을 수 없습니다." },
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

    const session = createGlobalSession(participant.name)

    return NextResponse.json({
      success: true,
      session,
    })
  } catch (error) {
    console.error("Global login error:", error)
    return NextResponse.json(
      { error: "로그인에 실패했습니다." },
      { status: 500 }
    )
  }
}

