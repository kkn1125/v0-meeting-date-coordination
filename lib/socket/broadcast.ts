import {
  getActiveRoomIdsForParticipant,
  getInboxUnreadCount,
  getMemosByRoom,
  getRoomLabels,
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

export async function broadcastRoomLabels(roomId: string) {
  const io = getIO()
  if (!io) return

  const labels = await getRoomLabels(roomId)
  io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.LABELS_UPDATED, { labels })
}

export async function broadcastRoomMemos(
  roomId: string,
  inboxRecipientIds: string[] = []
) {
  const io = getIO()
  if (!io) return

  const memos = await getMemosByRoom(roomId)
  const recipientIds = [...new Set(inboxRecipientIds)]

  io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.MEMOS_UPDATED, {
    memos,
    inboxRecipientIds: recipientIds,
  })

  if (recipientIds.length > 0) {
    await broadcastInboxMany(recipientIds)
  }
}

export async function broadcastInbox(participantId: string) {
  const io = getIO()
  if (!io) return

  const unreadCount = await getInboxUnreadCount(participantId)
  const payload = { unreadCount, participantId }

  io.to(participantChannel(participantId)).emit(
    SOCKET_EVENTS.INBOX_UPDATED,
    payload
  )

  const roomIds = await getActiveRoomIdsForParticipant(participantId)
  for (const roomId of roomIds) {
    io.to(roomChannel(roomId)).emit(SOCKET_EVENTS.INBOX_UPDATED, payload)
  }
}

export async function broadcastInboxMany(participantIds: string[]) {
  const unique = [...new Set(participantIds)]
  await Promise.all(unique.map((id) => broadcastInbox(id)))
}
