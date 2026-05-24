import { NextResponse, type NextRequest } from "next/server"
import { findParticipantById, verifyRoomMembership } from "@/lib/db/queries"
import { verifyAuthFromRequest } from "./verify"

export interface AuthenticatedUser {
  participantId: string
  name: string
}

export interface RoomAuthenticatedUser extends AuthenticatedUser {
  isHost: boolean
}

function unauthorized(message = "로그인이 필요합니다.") {
  return NextResponse.json({ error: message }, { status: 401 })
}

function forbidden(message = "권한이 없습니다.") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export async function requireAuth(
  request: NextRequest
): Promise<AuthenticatedUser | NextResponse> {
  const payload = await verifyAuthFromRequest(request)
  if (!payload) return unauthorized()

  const participant = await findParticipantById(payload.sub)
  if (!participant) return unauthorized("유효하지 않은 계정입니다.")

  return { participantId: participant.id, name: participant.name }
}

export async function requireRoomMember(
  request: NextRequest,
  roomId: string
): Promise<RoomAuthenticatedUser | NextResponse> {
  const auth = await requireAuth(request)
  if (auth instanceof NextResponse) return auth

  const membership = await verifyRoomMembership(roomId, auth.participantId)
  if (!membership) return forbidden("방 참여 권한이 없습니다.")

  return {
    participantId: auth.participantId,
    name: auth.name,
    isHost: membership.isHost,
  }
}

export function isAuthError(
  result: AuthenticatedUser | RoomAuthenticatedUser | NextResponse
): result is NextResponse {
  return result instanceof NextResponse
}
