"use client"

import { useEffect, useRef } from "react"
import { io, type Socket } from "socket.io-client"
import { SOCKET_BOOTSTRAP_PATH, SOCKET_IO_PATH } from "@/lib/socket/constants"
import { toISODateString } from "@/lib/dates"
import { SOCKET_EVENTS } from "@/lib/socket/events"
import type { Memo, ParticipantWithDateRanges, RoomLabel } from "@/lib/types"

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
  const res = await fetch(SOCKET_BOOTSTRAP_PATH, { credentials: "include" })
  if (!res.ok) {
    throw new Error("Failed to initialize socket server")
  }
}

export function useRoomSocket(
  roomId: string,
  participantId: string | undefined,
  onParticipantsUpdated: (participants: ParticipantWithDateRanges[]) => void,
  onMemosUpdated?: (memos: Memo[]) => void,
  onInboxRefresh?: () => void,
  onLabelsUpdated?: (labels: RoomLabel[]) => void
) {
  const participantsCallbackRef = useRef(onParticipantsUpdated)
  participantsCallbackRef.current = onParticipantsUpdated

  const memosCallbackRef = useRef(onMemosUpdated)
  memosCallbackRef.current = onMemosUpdated

  const inboxRefreshRef = useRef(onInboxRefresh)
  inboxRefreshRef.current = onInboxRefresh

  const labelsCallbackRef = useRef(onLabelsUpdated)
  labelsCallbackRef.current = onLabelsUpdated

  const participantIdRef = useRef(participantId)
  participantIdRef.current = participantId

  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    let cancelled = false

    const setup = async () => {
      try {
        await ensureSocketServer()
        if (cancelled) return

        const socket = io({
          path: SOCKET_IO_PATH,
          addTrailingSlash: false,
          withCredentials: true,
        })
        socketRef.current = socket

        const joinRoom = () => {
          socket.emit(SOCKET_EVENTS.JOIN_ROOM, roomId)
        }

        const handleParticipantsUpdated = (data: {
          participants: ParticipantWithDateRanges[]
        }) => {
          participantsCallbackRef.current(normalizeParticipants(data.participants))
        }

        const handleMemosUpdated = (data: {
          memos: Memo[]
          inboxRecipientIds?: string[]
        }) => {
          memosCallbackRef.current?.(data.memos)
          const pid = participantIdRef.current
          if (pid && data.inboxRecipientIds?.includes(pid)) {
            inboxRefreshRef.current?.()
          }
        }

        const handleInboxUpdated = (data: {
          unreadCount: number
          participantId: string
        }) => {
          const pid = participantIdRef.current
          if (pid && data.participantId === pid) {
            inboxRefreshRef.current?.()
          }
        }

        const handleLabelsUpdated = (data: { labels: RoomLabel[] }) => {
          labelsCallbackRef.current?.(data.labels)
        }

        socket.on("connect", joinRoom)
        socket.on(SOCKET_EVENTS.PARTICIPANTS_UPDATED, handleParticipantsUpdated)
        socket.on(SOCKET_EVENTS.MEMOS_UPDATED, handleMemosUpdated)
        socket.on(SOCKET_EVENTS.INBOX_UPDATED, handleInboxUpdated)
        socket.on(SOCKET_EVENTS.LABELS_UPDATED, handleLabelsUpdated)

        if (socket.connected) {
          joinRoom()
        }
      } catch (error) {
        console.error("Socket connection error:", error)
      }
    }

    void setup()

    return () => {
      cancelled = true
      const socket = socketRef.current
      if (socket) {
        socket.removeAllListeners()
        socket.disconnect()
        socketRef.current = null
      }
    }
  }, [roomId])
}
