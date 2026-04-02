import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { roomId, name } = await request.json()

    if (!roomId || !name?.trim()) {
      return NextResponse.json(
        { error: "roomId와 이름이 필요합니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const trimmedName = name.trim()

    // 1) 글로벌 참가자 조회
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id")
      .eq("name", trimmedName)
      .limit(1)
      .single()

    if (participantError) {
      if (participantError.code === "PGRST116") {
        return NextResponse.json({ status: "none" })
      }
      throw participantError
    }

    if (!participant) {
      return NextResponse.json({ status: "none" })
    }

    // 2) room_participants 에서 이 방에 대한 관계 조회
    const { data: rp, error: rpError } = await supabase
      .from("room_participants")
      .select("is_active")
      .eq("room_id", roomId)
      .eq("participant_id", participant.id)
      .limit(1)
      .single()

    if (rpError) {
      if (rpError.code === "PGRST116") {
        return NextResponse.json({ status: "none" })
      }
      throw rpError
    }

    if (!rp) {
      return NextResponse.json({ status: "none" })
    }

    if (!rp.is_active) {
      return NextResponse.json({ status: "inactive" })
    }

    return NextResponse.json({ status: "active" })
  } catch (error) {
    console.error("Room membership error:", error)
    return NextResponse.json(
      { error: "멤버십 정보를 확인하지 못했습니다." },
      { status: 500 }
    )
  }
}

