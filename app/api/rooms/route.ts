import { NextRequest, NextResponse } from "next/server"
import {
  createRoom,
  createRoomParticipantLink,
  getRoomByCode,
  updateRoomCreator,
} from "@/lib/db/queries"
import { requireAuth, isAuthError } from "@/lib/auth"

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get("code")
    if (!code) {
      return NextResponse.json({ error: "code가 필요합니다." }, { status: 400 })
    }

    const room = await getRoomByCode(code)
    if (!room) {
      return NextResponse.json({ error: "존재하지 않는 모임입니다." }, { status: 404 })
    }

    return NextResponse.json({ room })
  } catch (error) {
    console.error("Get room error:", error)
    return NextResponse.json({ error: "모임 조회에 실패했습니다." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request)
    if (isAuthError(auth)) return auth

    const { name } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "모임 이름이 필요합니다." }, { status: 400 })
    }

    const code = generateRoomCode()
    const room = await createRoom(name.trim(), code)

    await createRoomParticipantLink(room.id, auth.participantId, true)
    await updateRoomCreator(room.id, auth.participantId)

    return NextResponse.json({ room })
  } catch (error) {
    console.error("Create room error:", error)
    return NextResponse.json({ error: "모임 생성에 실패했습니다." }, { status: 500 })
  }
}
