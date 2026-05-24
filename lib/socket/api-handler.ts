import type { NextApiRequest, NextApiResponse } from "next"
import type { Server as HTTPServer } from "http"
import type { Socket } from "net"
import { attachSocketIO } from "@/lib/socket/init"

export type SocketApiResponse = NextApiResponse & {
  socket: Socket & {
    server: HTTPServer
  }
}

/**
 * Bootstraps Socket.IO on the same HTTP server as `next dev` / `next start`.
 * Must run from Pages API (`pages/api/socket.ts`): App Router route handlers
 * do not expose `res.socket.server`.
 */
export default function socketApiHandler(
  _req: NextApiRequest,
  res: SocketApiResponse
) {
  attachSocketIO(res.socket.server)
  res.status(200).json({ ok: true })
}
