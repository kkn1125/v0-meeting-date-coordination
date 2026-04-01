import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { participantId, action } = await request.json()

    if (!participantId) {
      return NextResponse.json(
        { error: "참여자 ID가 필요합니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()

    if (action === "restore") {
      // Restore participant
      const { error } = await supabase
        .from("participants")
        .update({ deleted_at: null })
        .eq("id", participantId)

      if (error) throw error

      return NextResponse.json({ success: true, action: "restored" })
    } else {
      // Kick participant (soft delete)
      const { error } = await supabase
        .from("participants")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", participantId)

      if (error) throw error

      return NextResponse.json({ success: true, action: "kicked" })
    }
  } catch (error) {
    console.error("Kick/Restore error:", error)
    return NextResponse.json(
      { error: "작업에 실패했습니다." },
      { status: 500 }
    )
  }
}
