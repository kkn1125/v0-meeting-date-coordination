import { eachDayOfInterval, format, parseISO } from "date-fns"
import type {
  DateRange,
  ParticipantWithDateRanges,
  RangeSpan,
  RoomLabel,
} from "@/lib/types"

export interface RangeSpanWithKeys extends RangeSpan {
  dateKeys: Set<string>
}

function resolveLabelValidity(
  range: DateRange,
  labelsById: Map<string, RoomLabel>
): boolean | null {
  if (!range.label_id) return null
  const label = labelsById.get(range.label_id)
  return label ? label.is_valid : false
}

export function buildRangeSpans(
  participants: ParticipantWithDateRanges[],
  labels: RoomLabel[] = []
): RangeSpanWithKeys[] {
  const labelsById = new Map(labels.map((l) => [l.id, l]))
  const spans: RangeSpanWithKeys[] = []

  participants
    .filter((p) => !p.deleted_at)
    .forEach((participant) => {
      participant.date_ranges.forEach((range) => {
        const dates = eachDayOfInterval({
          start: parseISO(range.start_date),
          end: parseISO(range.end_date),
        })
        const dateKeys = new Set(dates.map((d) => format(d, "yyyy-MM-dd")))

        spans.push({
          rangeId: range.id,
          participantId: participant.id,
          participantName: participant.name,
          startDate: range.start_date,
          endDate: range.end_date,
          isAvailable: range.is_available,
          labelId: range.label_id,
          labelIsValid: resolveLabelValidity(range, labelsById),
          dateRange: range,
          dateKeys,
        })
      })
    })

  return spans
}

export function buildRangesByDateKey(
  spans: RangeSpanWithKeys[]
): Map<string, RangeSpanWithKeys[]> {
  const map = new Map<string, RangeSpanWithKeys[]>()

  spans.forEach((span) => {
    span.dateKeys.forEach((dateKey) => {
      const arr = map.get(dateKey) ?? []
      arr.push(span)
      map.set(dateKey, arr)
    })
  })

  return map
}

export function findRangeSpanById(
  spans: RangeSpanWithKeys[],
  rangeId: string
): RangeSpanWithKeys | undefined {
  return spans.find((s) => s.rangeId === rangeId)
}

export function formatRangeLabel(span: RangeSpan): string {
  return `${span.participantName} - ${span.startDate}~${span.endDate}`
}
