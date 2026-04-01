import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json(
        { error: "이름이 필요합니다." },
        { status: 400 }
      )
    }

    const supabase = await createClient()
    const trimmedName = name.trim()

    const { data: participantRows, error: participantError } = await supabase
      .from("participants")
      .select("room_id,is_host,deleted_at")
      .eq("name", trimmedName)
      .is("deleted_at", null)

    if (participantError) {
      throw participantError
    }

    if (!participantRows || participantRows.length === 0) {
      return NextResponse.json({ rooms: [] })
    }

    const roomIds = Array.from(new Set(participantRows.map((p) => p.room_id)))

    const { data: rooms, error: roomsError } = await supabase
      .from("rooms")
      .select("id,name,code,created_at")
      .in("id", roomIds)
      .order("created_at", { ascending: false })

    if (roomsError) {
      throw roomsError
    }

    const result = (rooms || []).map((room) => {
      const participations = participantRows.filter((p) => p.room_id === room.id)
      const isHost = participations.some((p) => p.is_host)

      return {
        id: room.id,
        name: room.name,
        code: room.code,
        createdAt: room.created_at,
        isHost,
      }
    })

    return NextResponse.json({ rooms: result })
  } catch (error) {
    console.error("Rooms by user error:", error)
    return NextResponse.json(
      { error: "참여한 모임을 불러오지 못했습니다." },
      { status: 500 }
    )
  }
}

