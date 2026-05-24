import {
  eachDayOfInterval,
  endOfMonth,
  format,
  max as maxDate,
  parseISO,
  startOfMonth,
} from "date-fns"
import type {
  DateRange,
  ParticipantWithDateRanges,
  RangeSpan,
  RoomLabel,
} from "@/lib/types"

export interface RangeSpanWithKeys extends RangeSpan {
  dateKeys: Set<string>
  labelName: string | null
}

export interface DateScore {
  date: string
  score: number
  available: number
  unavailable: number
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

        const label = range.label_id
          ? labelsById.get(range.label_id)
          : undefined

        spans.push({
          rangeId: range.id,
          participantId: participant.id,
          participantName: participant.name,
          startDate: range.start_date,
          endDate: range.end_date,
          isAvailable: range.is_available,
          labelId: range.label_id,
          labelIsValid: resolveLabelValidity(range, labelsById),
          labelName: label?.name ?? null,
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

/** 기간 라벨을 표시할 달력 셀 (해당 월에서 보이는 구간의 첫 날) */
export function getLabelAnchorDateKey(
  span: RangeSpanWithKeys,
  month: Date
): string | null {
  if (!span.labelId) return null

  const monthStart = startOfMonth(month)
  const monthEnd = endOfMonth(month)
  const rangeStart = parseISO(span.startDate)
  const rangeEnd = parseISO(span.endDate)

  if (rangeEnd < monthStart || rangeStart > monthEnd) return null

  const visibleStart = maxDate([rangeStart, monthStart])
  return format(visibleStart, "yyyy-MM-dd")
}

export function buildLabelAnchorsByDateKey(
  spans: RangeSpanWithKeys[],
  month: Date
): Map<string, { rangeId: string; labelName: string }[]> {
  const map = new Map<string, { rangeId: string; labelName: string }[]>()

  for (const span of spans) {
    if (!span.labelId || !span.labelName) continue
    const anchorKey = getLabelAnchorDateKey(span, month)
    if (!anchorKey) continue

    const arr = map.get(anchorKey) ?? []
    if (!arr.some((a) => a.rangeId === span.rangeId)) {
      arr.push({ rangeId: span.rangeId, labelName: span.labelName })
    }
    map.set(anchorKey, arr)
  }

  return map
}

export function scoreDatesInAllowedKeys(
  allowedDateKeys: Set<string>,
  dateAvailabilityMap: Map<
    string,
    { available: string[]; unavailable: string[] }
  >,
  limit = 3
): DateScore[] {
  const scores: DateScore[] = []

  dateAvailabilityMap.forEach((availability, dateKey) => {
    if (!allowedDateKeys.has(dateKey)) return

    const availableCount = availability.available.length
    const unavailableCount = availability.unavailable.length
    const score = availableCount - unavailableCount

    if (availableCount > 0) {
      scores.push({
        date: dateKey,
        score,
        available: availableCount,
        unavailable: unavailableCount,
      })
    }
  })

  return scores
    .sort((a, b) => b.score - a.score || b.available - a.available)
    .slice(0, limit)
}
