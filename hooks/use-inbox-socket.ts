"use client"

import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { SOCKET_BOOTSTRAP_PATH, SOCKET_IO_PATH } from "@/lib/socket/constants"
import { SOCKET_EVENTS } from "@/lib/socket/events"

async function ensureSocketServer() {
  const res = await fetch(SOCKET_BOOTSTRAP_PATH)
  if (!res.ok) {
    throw new Error("Failed to initialize socket server")
  }
}

export function useInboxSocket(
  participantId: string | null,
  onInboxUpdated: (unreadCount: number) => void
) {
  const callbackRef = useRef(onInboxUpdated)
  callbackRef.current = onInboxUpdated

  useEffect(() => {
    if (!participantId) return

    let socket: Socket | null = null
    let cancelled = false

    const setup = async () => {
      try {
        await ensureSocketServer()
        if (cancelled) return

        socket = io({
          path: SOCKET_IO_PATH,
          addTrailingSlash: false,
        })

        const handleConnect = () => {
          socket?.emit(SOCKET_EVENTS.JOIN_PARTICIPANT, participantId)
        }

        const handleInboxUpdated = (data: { unreadCount: number }) => {
          callbackRef.current(data.unreadCount)
        }

        socket.on("connect", handleConnect)
        socket.on(SOCKET_EVENTS.INBOX_UPDATED, handleInboxUpdated)

        if (socket.connected) {
          handleConnect()
        }
      } catch (error) {
        console.error("Inbox socket connection error:", error)
      }
    }

    void setup()

    return () => {
      cancelled = true
      if (socket) {
        socket.off("connect")
        socket.off(SOCKET_EVENTS.INBOX_UPDATED)
        socket.disconnect()
      }
    }
  }, [participantId])
}
