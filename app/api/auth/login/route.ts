import { NextRequest, NextResponse } from "next/server"
import { findParticipantById, getRoomParticipantLink } from "@/lib/db/queries"
import { verifyPassword, createSession } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    const { name, password, roomId, participantId } = await request.json()

    let participant

    if (participantId) {
      participant = await findParticipantById(participantId)
      if (!participant) {
        return NextResponse.json(
          { error: "참여자를 찾을 수 없습니다." },
          { status: 404 }
        )
      }
    } else {
      if (!name?.trim() || !password?.trim()) {
        return NextResponse.json(
          { error: "이름과 비밀번호를 입력해주세요." },
          { status: 400 }
        )
      }

      return NextResponse.json(
        { error: "참여자를 찾을 수 없습니다." },
        { status: 404 }
      )
    }

    if (!participant.password_hash) {
      return NextResponse.json(
        { error: "비밀번호가 설정되지 않은 계정입니다." },
        { status: 400 }
      )
    }

    const isValid = await verifyPassword(password, participant.password_hash)

    if (!isValid) {
      return NextResponse.json(
        { error: "비밀번호가 일치하지 않습니다." },
        { status: 401 }
      )
    }

    const link = roomId
      ? await getRoomParticipantLink(roomId, participant.id)
      : null

    const session = createSession(
      participant.id,
      roomId ?? "",
      participant.name,
      link?.is_host ?? false
    )

    return NextResponse.json({
      success: true,
      session,
      participant: {
        ...participant,
        room_id: roomId,
        is_host: link?.is_host ?? false,
        deleted_at: link?.is_active === false ? new Date().toISOString() : null,
      },
    })
  } catch (error) {
    console.error("Login error:", error)
    return NextResponse.json(
      { error: "로그인에 실패했습니다." },
      { status: 500 }
    )
  }
}
