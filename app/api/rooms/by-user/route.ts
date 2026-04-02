import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json();

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "이름이 필요합니다." },
        { status: 400 }
      );
    }

    const supabase = await createClient();
    const trimmedName = name.trim();

    // 1) 글로벌 참가자(사용자) 조회
    const { data: participant, error: participantError } = await supabase
      .from("participants")
      .select("id")
      .eq("name", trimmedName)
      .limit(1)
      .single();

    if (participantError) {
      // 이름은 있는데 participants 가 아직 없을 수도 있으니, 단순히 빈 배열로 처리
      if (participantError.code === "PGRST116") {
        return NextResponse.json({ rooms: [] });
      }
      throw participantError;
    }

    if (!participant) {
      return NextResponse.json({ rooms: [] });
    }

    // 2) room_participants 에서 이 사용자가 참여 중인 방 목록 조회
    const { data: rpRows, error: rpError } = await supabase
      .from("room_participants")
      .select("room_id,is_host,is_active")
      .eq("participant_id", participant.id);

    if (rpError) {
      throw rpError;
    }

    if (!rpRows || rpRows.length === 0) {
      return NextResponse.json({ rooms: [] });
    }

    if (rpRows.length === 0) {
      return NextResponse.json({ rooms: [] });
    }

    const roomIds = Array.from(new Set(rpRows.map((rp) => rp.room_id)));

    const { data: rooms, error: roomsError } = await supabase
      .from("rooms")
      .select("id,name,code,created_at")
      .in("id", roomIds)
      .order("created_at", { ascending: false });

    if (roomsError) {
      throw roomsError;
    }

    const result = (rooms || []).map((room) => {
      const participations = rpRows.filter((rp) => rp.room_id === room.id);
      const isHost = participations.some((rp) => rp.is_host);

      return {
        id: room.id,
        name: room.name,
        code: room.code,
        createdAt: room.created_at,
        isHost,
      };
    });

    return NextResponse.json({ rooms: result });
  } catch (error) {
    console.error("Rooms by user error:", error);
    return NextResponse.json(
      { error: "참여한 모임을 불러오지 못했습니다." },
      { status: 500 }
    );
  }
}
