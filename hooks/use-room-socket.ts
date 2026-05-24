"use client"

import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { SOCKET_BOOTSTRAP_PATH, SOCKET_IO_PATH } from "@/lib/socket/constants"
import { toISODateString } from "@/lib/dates"
import { SOCKET_EVENTS } from "@/lib/socket/events"
import type { Memo, ParticipantWithDateRanges } from "@/lib/types"

function normalizeParticipants(
  participants: ParticipantWithDateRanges[]
): ParticipantWithDateRanges[] {
  return participants.map((participant) => ({
    ...participant,
    date_ranges: participant.date_ranges.map((range) => ({
      ...range,
      start_date: toISODateString(range.start_date),
      end_date: toISODateString(range.end_date),
    })),
  }))
}

async function ensureSocketServer() {
  const res = await fetch(SOCKET_BOOTSTRAP_PATH)
  if (!res.ok) {
    throw new Error("Failed to initialize socket server")
  }
}

export function useRoomSocket(
  roomId: string,
  onParticipantsUpdated: (participants: ParticipantWithDateRanges[]) => void,
  onMemosUpdated?: (memos: Memo[], dateRangeId?: string) => void
) {
  const participantsCallbackRef = useRef(onParticipantsUpdated)
  participantsCallbackRef.current = onParticipantsUpdated

  const memosCallbackRef = useRef(onMemosUpdated)
  memosCallbackRef.current = onMemosUpdated

  useEffect(() => {
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
          socket?.emit(SOCKET_EVENTS.JOIN_ROOM, roomId)
        }

        const handleParticipantsUpdated = (data: {
          participants: ParticipantWithDateRanges[]
        }) => {
          participantsCallbackRef.current(normalizeParticipants(data.participants))
        }

        const handleMemosUpdated = (data: {
          memos: Memo[]
          dateRangeId?: string
        }) => {
          memosCallbackRef.current?.(data.memos, data.dateRangeId)
        }

        socket.on("connect", handleConnect)
        socket.on(SOCKET_EVENTS.PARTICIPANTS_UPDATED, handleParticipantsUpdated)
        socket.on(SOCKET_EVENTS.MEMOS_UPDATED, handleMemosUpdated)

        if (socket.connected) {
          handleConnect()
        }
      } catch (error) {
        console.error("Socket connection error:", error)
      }
    }

    void setup()

    return () => {
      cancelled = true
      if (socket) {
        socket.off("connect")
        socket.off(SOCKET_EVENTS.PARTICIPANTS_UPDATED)
        socket.off(SOCKET_EVENTS.MEMOS_UPDATED)
        socket.disconnect()
      }
    }
  }, [roomId])
}
