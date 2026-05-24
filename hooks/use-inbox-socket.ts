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
  onInboxUpdated: () => void
) {
  const callbackRef = useRef(onInboxUpdated)
  callbackRef.current = onInboxUpdated

  const participantIdRef = useRef(participantId)
  participantIdRef.current = participantId

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

        const joinParticipant = () => {
          const pid = participantIdRef.current
          if (pid) socket?.emit(SOCKET_EVENTS.JOIN_PARTICIPANT, pid)
        }

        const handleInboxUpdated = (data: {
          unreadCount: number
          participantId: string
        }) => {
          if (data.participantId !== participantIdRef.current) return
          callbackRef.current()
        }

        socket.on("connect", joinParticipant)
        socket.on(SOCKET_EVENTS.INBOX_UPDATED, handleInboxUpdated)

        if (socket.connected) {
          joinParticipant()
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
