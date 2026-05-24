export const SOCKET_EVENTS = {
  JOIN_ROOM: "room:join",
  JOIN_PARTICIPANT: "participant:join",
  PARTICIPANTS_UPDATED: "room:participants-updated",
  MEMOS_UPDATED: "room:memos-updated",
  INBOX_UPDATED: "participant:inbox-updated",
} as const

export function roomChannel(roomId: string) {
  return `room:${roomId}`
}

export function participantChannel(participantId: string) {
  return `participant:${participantId}`
}
