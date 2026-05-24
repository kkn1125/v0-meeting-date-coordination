import { NextRequest, NextResponse } from "next/server"
import { getMembershipStatus } from "@/lib/db/queries"

export async function POST(request: NextRequest) {
  try {
    const { roomId, name } = await request.json()

    if (!roomId || !name?.trim()) {
      return NextResponse.json(
        { error: "roomId와 이름이 필요합니다." },
        { status: 400 }
      )
    }

    const status = await getMembershipStatus(roomId, name.trim())
    return NextResponse.json({ status })
  } catch (error) {
    console.error("Room membership error:", error)
    return NextResponse.json(
      { error: "멤버십 정보를 확인하지 못했습니다." },
      { status: 500 }
    )
  }
}
