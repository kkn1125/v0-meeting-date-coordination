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

export interface RoomLabel {
  id: string
  room_id: string
  name: string
  is_valid: boolean
  created_by_participant_id: string
  created_at: string
  updated_at: string
  created_by_name?: string
  date_range_count?: number
}

export interface DateRange {
  id: string
  participant_id: string
  room_id: string
  start_date: string
  end_date: string
  is_available: boolean
  label_id: string | null
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

export interface MemoMention {
  id: string
  memo_id: string
  mentioned_participant_id: string
  mentioned_name?: string
  created_at: string
}

export interface Memo {
  id: string
  room_id: string
  date_range_id: string
  author_participant_id: string
  content: string
  created_at: string
  updated_at: string
  author_name?: string
  mentions?: MemoMention[]
}

export interface InboxNotification {
  id: string
  recipient_participant_id: string
  room_id: string
  date_range_id: string
  memo_id: string
  mention_id: string
  is_read: boolean
  created_at: string
  room_name?: string
  room_code?: string
  start_date?: string
  end_date?: string
  memo_preview?: string
  mentioner_name?: string
}

export interface RangeSpan {
  rangeId: string
  participantId: string
  participantName: string
  startDate: string
  endDate: string
  isAvailable: boolean
  labelId: string | null
  labelIsValid: boolean | null
  dateRange: DateRange
}
