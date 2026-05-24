import type { Server as HTTPServer } from "http"
import { Server as SocketIOServer } from "socket.io"
import {
  getInboxUnreadCount,
  getMemosByRoom,
  getRoomParticipantsWithDateRanges,
} from "@/lib/db/queries"
import { SOCKET_IO_PATH } from "@/lib/socket/constants"
import {
  SOCKET_EVENTS,
  participantChannel,
  roomChannel,
} from "@/lib/socket/events"
import { getIO, setIO } from "@/lib/socket/io"

export function attachSocketIO(httpServer: HTTPServer): SocketIOServer {
  const existing = getIO()
  if (existing) return existing

  const io = new SocketIOServer(httpServer, {
    path: SOCKET_IO_PATH,
    addTrailingSlash: false,
  })

  io.on("connection", (socket) => {
    socket.on(SOCKET_EVENTS.JOIN_ROOM, async (roomId: unknown) => {
      if (typeof roomId !== "string" || !roomId) return

      socket.join(roomChannel(roomId))

      try {
        const participants = await getRoomParticipantsWithDateRanges(roomId)
        socket.emit(SOCKET_EVENTS.PARTICIPANTS_UPDATED, { participants })

        const memos = await getMemosByRoom(roomId)
        socket.emit(SOCKET_EVENTS.MEMOS_UPDATED, { memos })
      } catch (error) {
        console.error("Failed to send room snapshot:", error)
      }
    })

    socket.on(SOCKET_EVENTS.JOIN_PARTICIPANT, async (participantId: unknown) => {
      if (typeof participantId !== "string" || !participantId) return

      socket.join(participantChannel(participantId))

      try {
        const unreadCount = await getInboxUnreadCount(participantId)
        socket.emit(SOCKET_EVENTS.INBOX_UPDATED, { unreadCount })
      } catch (error) {
        console.error("Failed to send inbox snapshot:", error)
      }
    })
  })

  setIO(io)
  return io
}
