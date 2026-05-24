import { NextRequest, NextResponse } from "next/server"
import { getRoomsByParticipantName } from "@/lib/db/queries"

export async function POST(request: NextRequest) {
  try {
    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "이름이 필요합니다." }, { status: 400 })
    }

    const rooms = await getRoomsByParticipantName(name.trim())
    return NextResponse.json({ rooms })
  } catch (error) {
    console.error("Rooms by user error:", error)
    return NextResponse.json(
      { error: "참여한 모임을 불러오지 못했습니다." },
      { status: 500 }
    )
  }
}
