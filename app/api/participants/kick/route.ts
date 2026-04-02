import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { roomId, participantId, action } = await request.json()

    if (!roomId || !participantId) {
      return NextResponse.json(
        { error: "roomId와 참여자 ID가 필요합니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    // room_participants 기준으로 활성/비활성 토글
    const isActive = action === "restore"

    const { error } = await supabase
      .from("room_participants")
      .update({ is_active: isActive })
      .eq("room_id", roomId)
      .eq("participant_id", participantId)

    if (error) throw error

    return NextResponse.json({ success: true, action: isActive ? "restored" : "kicked" })
  } catch (error) {
    console.error("Kick/Restore error:", error)
    return NextResponse.json(
      { error: "작업에 실패했습니다." },
      { status: 500 }
    )
  }
}

