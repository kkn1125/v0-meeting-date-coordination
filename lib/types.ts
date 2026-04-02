export interface Room {
  id: string
  name: string
  code: string
  creator_participant_id: string | null
  created_at: string
}

export interface Participant {
  id: string
  room_id: string
  name: string
  password_hash: string | null
  is_host: boolean
  deleted_at: string | null
  created_at: string
}

export interface DateRange {
  id: string
  participant_id: string
  room_id: string
  start_date: string
  end_date: string
  is_available: boolean
  created_at: string
}

export interface ParticipantWithDateRanges extends Participant {
  date_ranges: DateRange[]
}

export interface SessionPayload {
  participantId: string
  roomId: string
  name: string
  isHost: boolean
  expiresAt: number
}

export interface GlobalSessionPayload {
  name: string
  expiresAt: number
}
