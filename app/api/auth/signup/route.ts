import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { hashPassword, createSession } from "@/lib/auth"

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

    const supabase = await createClient()
    const trimmedName = name.trim()

    // Check if name already exists globally
    const { data: existingUser, error: checkError } = await supabase
      .from("participants")
      .select("id")
      .eq("name", trimmedName)
      .not("password_hash", "is", null)
      .limit(1)
      .single()

    if (checkError && checkError.code !== "PGRST116") {
      throw checkError
    }

    if (existingUser) {
      return NextResponse.json(
        { error: "이미 사용 중인 이름입니다." },
        { status: 409 }
      )
    }

    const passwordHash = await hashPassword(password)

    return NextResponse.json({
      success: true,
      passwordHash,
      name: trimmedName,
    })
  } catch (error) {
    console.error("Signup error:", error)
    return NextResponse.json(
      { error: "회원가입에 실패했습니다." },
      { status: 500 }
    )
  }
}
