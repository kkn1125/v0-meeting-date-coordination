export interface Room {
  id: string
  name: string
  code: string
  created_at: string
}

export interface Participant {
  id: string
  room_id: string
  name: string
  created_at: string
}

export interface DateRange {
  id: string
  participant_id: string
  start_date: string
  end_date: string
  is_available: boolean
  created_at: string
}

export interface ParticipantWithDateRanges extends Participant {
  date_ranges: DateRange[]
}
