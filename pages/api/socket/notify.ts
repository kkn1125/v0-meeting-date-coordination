import type { NextApiRequest, NextApiResponse } from "next"
import type { Server as HTTPServer } from "http"
import type { Socket } from "net"
import { isValidSocketNotifyRequest } from "@/lib/auth/notify"
import { attachSocketIO } from "@/lib/socket/init"
import {
  broadcastInboxMany,
  broadcastRoomMemos,
  broadcastRoomParticipants,
} from "@/lib/socket/broadcast"

type NotifyBody =
  | { type: "memos"; roomId: string; recipientIds?: string[] }
  | { type: "participants"; roomId: string }
  | { type: "inbox"; recipientIds: string[] }

type NotifyResponse = NextApiResponse & {
  socket: Socket & {
    server: HTTPServer
  }
}

/**
 * Pages API broadcast relay — App Router handlers call this so emits run
 * in the same process as the Socket.IO server (global __socketIO).
 */
export default async function notifyHandler(
  req: NextApiRequest,
  res: NotifyResponse
) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST")
    return res.status(405).json({ error: "Method not allowed" })
  }

  if (!isValidSocketNotifyRequest(req.headers["x-socket-notify-secret"])) {
    return res.status(401).json({ error: "Unauthorized" })
  }

  attachSocketIO(res.socket.server)

  try {
    const body = req.body as NotifyBody

    if (body.type === "memos" && body.roomId) {
      const recipientIds = [...new Set(body.recipientIds ?? [])]
      await broadcastRoomMemos(body.roomId, recipientIds)
      return res.status(200).json({ ok: true })
    }

    if (body.type === "participants" && body.roomId) {
      await broadcastRoomParticipants(body.roomId)
      return res.status(200).json({ ok: true })
    }

    if (body.type === "inbox" && body.recipientIds?.length) {
      await broadcastInboxMany(body.recipientIds)
      return res.status(200).json({ ok: true })
    }

    return res.status(400).json({ error: "Invalid payload" })
  } catch (error) {
    console.error("Socket notify error:", error)
    return res.status(500).json({ error: "Broadcast failed" })
  }
}

export const config = {
  api: {
    bodyParser: true,
  },
}
