import { NextRequest, NextResponse } from "next/server"
import { getRoomParticipantsWithDateRanges } from "@/lib/db/queries"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const { roomId } = await params
    const participants = await getRoomParticipantsWithDateRanges(roomId)
    return NextResponse.json({ participants })
  } catch (error) {
    console.error("Get participants error:", error)
    return NextResponse.json(
      { error: "참여자 목록을 불러오지 못했습니다." },
      { status: 500 }
    )
  }
}
