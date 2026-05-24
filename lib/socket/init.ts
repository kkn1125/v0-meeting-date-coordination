import type { Server as HTTPServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import {
  getInboxUnreadCount,
  getMemosByRoom,
  getRoomLabels,
  getRoomParticipantsWithDateRanges,
  verifyRoomMembership,
} from "@/lib/db/queries"
import { verifyAuthFromCookieHeader } from "@/lib/auth/verify"
import { SOCKET_IO_PATH } from "@/lib/socket/constants"
import {
  SOCKET_EVENTS,
  participantChannel,
  roomChannel,
} from "@/lib/socket/events"
import { getIO, setIO } from "@/lib/socket/io"

export interface AuthenticatedSocketData {
  participantId: string
}

async function joinParticipantInbox(
  io: SocketIOServer,
  socket: import("socket.io").Socket,
  participantId: string
) {
  socket.join(participantChannel(participantId))

  try {
    const unreadCount = await getInboxUnreadCount(participantId)
    socket.emit(SOCKET_EVENTS.INBOX_UPDATED, {
      unreadCount,
      participantId,
    })
  } catch (error) {
    console.error("Failed to send inbox snapshot:", error)
  }
}

export function attachSocketIO(httpServer: HTTPServer): SocketIOServer {
  const existing = getIO()
  if (existing) return existing

  const io = new SocketIOServer(httpServer, {
    path: SOCKET_IO_PATH,
    addTrailingSlash: false,
  })

  io.use(async (socket, next) => {
    const payload = await verifyAuthFromCookieHeader(
      socket.handshake.headers.cookie
    )
    if (!payload) {
      return next(new Error("Unauthorized"))
    }
    ;(socket.data as AuthenticatedSocketData).participantId = payload.sub
    next()
  })

  io.on("connection", (socket) => {
    const participantId = (socket.data as AuthenticatedSocketData).participantId
    void joinParticipantInbox(io, socket, participantId)

    socket.on(SOCKET_EVENTS.JOIN_ROOM, async (roomId: unknown) => {
      if (typeof roomId !== "string" || !roomId) return

      const membership = await verifyRoomMembership(roomId, participantId)
      if (!membership) return

      socket.join(roomChannel(roomId))

      try {
        const participants = await getRoomParticipantsWithDateRanges(roomId)
        socket.emit(SOCKET_EVENTS.PARTICIPANTS_UPDATED, { participants })

        const memos = await getMemosByRoom(roomId)
        socket.emit(SOCKET_EVENTS.MEMOS_UPDATED, { memos })

        const labels = await getRoomLabels(roomId)
        socket.emit(SOCKET_EVENTS.LABELS_UPDATED, { labels })
      } catch (error) {
        console.error("Failed to send room snapshot:", error)
      }
    })
  })

  setIO(io)
  return io
}
