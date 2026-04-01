import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { verifyPassword, createSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { name, password, roomId, participantId } = await request.json()

    const supabase = await createClient()

    let participant

    if (participantId) {
      // Login with participantId (from inline login button)
      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .eq("id", participantId)
        .single()

      if (error || !data) {
        return NextResponse.json(
          { error: "참여자를 찾을 수 없습니다." },
          { status: 404 }
        )
      }
      participant = data
    } else {
      // Login with name
      if (!name?.trim() || !password?.trim()) {
        return NextResponse.json(
          { error: "이름과 비밀번호를 입력해주세요." },
          { status: 400 }
        )
      }

      const { data, error } = await supabase
        .from("participants")
        .select("*")
        .eq("name", name.trim())
        .eq("room_id", roomId)
        .single()

      if (error || !data) {
        return NextResponse.json(
          { error: "참여자를 찾을 수 없습니다." },
          { status: 404 }
        )
      }
      participant = data
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

    const session = createSession(
      participant.id,
      participant.room_id,
      participant.name,
      participant.is_host
    )

    return NextResponse.json({
      success: true,
      session,
      participant,
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "로그인에 실패했습니다." },
      { status: 500 }
    )
  }
}
