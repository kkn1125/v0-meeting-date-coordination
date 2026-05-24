import {
  getInboxUnreadCount,
  getMemosByRoom,
  getRoomParticipantsWithDateRanges,
} from "@/lib/db/queries"
import {
  SOCKET_EVENTS,
  participantChannel,
  roomChannel,
} from "@/lib/socket/events"
import { getIO } from "@/lib/socket/io"

export async function broadcastRoomParticipants(roomId: string) {
  const io = getIO()
  if (!io) return

  const participants = await getRoomParticipantsWithDateRanges(roomId)
  io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.PARTICIPANTS_UPDATED, {
    participants,
  })
}

export async function broadcastRoomMemos(
  roomId: string,
  dateRangeId?: string
) {
  const io = getIO()
  if (!io) return

  const memos = await getMemosByRoom(roomId, dateRangeId)
  io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.MEMOS_UPDATED, {
    memos,
    dateRangeId,
  })
}

export async function broadcastInbox(participantId: string) {
  const io = getIO()
  if (!io) return

  const unreadCount = await getInboxUnreadCount(participantId)
  io.to(participantChannel(participantId)).emit(SOCKET_EVENTS.INBOX_UPDATED, {
    unreadCount,
  })
}

export async function broadcastInboxMany(participantIds: string[]) {
  const unique = [...new Set(participantIds)]
  await Promise.all(unique.map((id) => broadcastInbox(id)))
}
