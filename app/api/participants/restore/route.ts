import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { roomId, participantId } = await request.json();

    if (!roomId || !participantId) {
      return NextResponse.json(
        { error: "roomId와 참여자 ID가 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = await createClient();

    const { error } = await supabase
      .from("room_participants")
      .update({ is_active: true })
      .eq("room_id", roomId)
      .eq("participant_id", participantId);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Restore participant error:", error);
    return NextResponse.json(
      { error: "작업에 실패했습니다." },
      { status: 500 }
    );
  }
}
