"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  buildRangeSpans,
  buildRangesByDateKey,
  type RangeSpanWithKeys,
} from "@/lib/calendar-ranges"
import type { Memo, ParticipantWithDateRanges, RoomLabel } from "@/lib/types"
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns"
import { ko } from "date-fns/locale"
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react"
import { PeriodMemoPanel } from "./period-memo-panel"
import { RangePickerPopover } from "./range-picker-popover"

interface AvailabilityCalendarProps {
  roomId: string
  participants: ParticipantWithDateRanges[]
  labels: RoomLabel[]
  memos: Memo[]
  currentParticipantId?: string
  currentParticipantIsHost?: boolean
  mentionedRangeIds: Set<string>
  initialDateRangeId?: string
  initialMemoId?: string
  onMemosChange: (memos: Memo[]) => void
  onLoginRequired?: () => void
}

interface DateAvailability {
  available: string[]
  unavailable: string[]
}

export function AvailabilityCalendar({
  roomId,
  participants,
  labels,
  memos,
  currentParticipantId,
  currentParticipantIsHost = false,
  mentionedRangeIds,
  initialDateRangeId,
  initialMemoId,
  onMemosChange,
  onLoginRequired,
}: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [onlyPerfectRecommendations, setOnlyPerfectRecommendations] =
    useState(false)
  const [hoveredRangeId, setHoveredRangeId] = useState<string | null>(null)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [pickerRanges, setPickerRanges] = useState<RangeSpanWithKeys[]>([])
  const [memoOpen, setMemoOpen] = useState(false)
  const [selectedRange, setSelectedRange] = useState<RangeSpanWithKeys | null>(
    null
  )
  const [anchorRect, setAnchorRect] = useState<DOMRect | null>(null)
  const [deepLinkHandled, setDeepLinkHandled] = useState(false)
  const cellRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  const rangeSpans = useMemo(
    () => buildRangeSpans(participants, labels),
    [participants, labels]
  )
  const rangesByDateKey = useMemo(
    () => buildRangesByDateKey(rangeSpans),
    [rangeSpans]
  )

  const dateAvailabilityMap = useMemo(() => {
    const map = new Map<string, DateAvailability>()
    const activeParticipants = participants.filter((p) => !p.deleted_at)

    activeParticipants.forEach((participant) => {
      participant.date_ranges.forEach((range) => {
        const dates = eachDayOfInterval({
          start: parseISO(range.start_date),
          end: parseISO(range.end_date),
        })

        dates.forEach((date) => {
          const dateKey = format(date, "yyyy-MM-dd")
          const existing = map.get(dateKey) || {
            available: [],
            unavailable: [],
          }

          if (range.is_available) {
            if (!existing.available.includes(participant.name)) {
              existing.available.push(participant.name)
            }
          } else if (!existing.unavailable.includes(participant.name)) {
            existing.unavailable.push(participant.name)
          }

          map.set(dateKey, existing)
        })
      })
    })

    return map
  }, [participants])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 })
  const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 })
  const calendarDays = eachDayOfInterval({
    start: calendarStart,
    end: calendarEnd,
  })

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"]
  const isCurrentMonthView = isSameMonth(currentMonth, new Date())

  const openMemoForRange = useCallback(
    (range: RangeSpanWithKeys, rect: DOMRect) => {
      setSelectedRange(range)
      setAnchorRect(rect)
      setMemoOpen(true)
      setPickerOpen(false)
    },
    []
  )

  const handleDateClick = useCallback(
    (day: Date, ranges: RangeSpanWithKeys[]) => {
      if (ranges.length === 0) return

      const dateKey = format(day, "yyyy-MM-dd")
      const cell = cellRefs.current.get(dateKey)
      const rect = cell?.getBoundingClientRect() ?? null
      if (!rect) return

      if (ranges.length === 1) {
        openMemoForRange(ranges[0], rect)
        return
      }

      setPickerRanges(ranges)
      setAnchorRect(rect)
      setPickerOpen(true)
    },
    [openMemoForRange]
  )

  useEffect(() => {
    if (deepLinkHandled || !initialDateRangeId || rangeSpans.length === 0) return

    const range = rangeSpans.find((r) => r.rangeId === initialDateRangeId)
    if (!range) return

    setCurrentMonth(parseISO(range.startDate))
    const firstKey = [...range.dateKeys].sort()[0]
    requestAnimationFrame(() => {
      const cell = cellRefs.current.get(firstKey)
      if (cell) {
        openMemoForRange(range, cell.getBoundingClientRect())
        setDeepLinkHandled(true)
      }
    })
  }, [
    deepLinkHandled,
    initialDateRangeId,
    rangeSpans,
    openMemoForRange,
  ])

  const getDateClasses = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd")
    const dayRanges = rangesByDateKey.get(dateKey) ?? []
    const hasInvalidLabelRange = dayRanges.some((r) => r.labelIsValid === false)

    if (hasInvalidLabelRange) {
      return "bg-zinc-200/70 dark:bg-zinc-600/40 text-muted-foreground font-medium"
    }

    const availability = dateAvailabilityMap.get(dateKey)
    const totalParticipants = participants.filter((p) => !p.deleted_at).length

    if (!availability || totalParticipants === 0) {
      return "bg-muted/30"
    }

    const availableCount = availability.available.length
    const unavailableCount = availability.unavailable.length

    if (availableCount === totalParticipants && unavailableCount === 0) {
      return "bg-sky-200 dark:bg-sky-700 text-sky-900 dark:text-sky-50 font-medium"
    }

    if (unavailableCount === totalParticipants) {
      return "bg-red-200 dark:bg-red-700 text-red-900 dark:text-red-50 font-medium"
    }

    if (availableCount > 0 && unavailableCount > 0) {
      return "bg-violet-200 dark:bg-violet-700 text-violet-900 dark:text-violet-50"
    }

    if (availableCount > 0 && unavailableCount === 0) {
      return "bg-emerald-200 dark:bg-emerald-700 text-emerald-900 dark:text-emerald-50"
    }

    return "bg-muted/50"
  }

  const getRangeRingClasses = (dateKey: string) => {
    const dayRanges = rangesByDateKey.get(dateKey) ?? []
    const classes: string[] = []

    for (const range of dayRanges) {
      if (hoveredRangeId === range.rangeId) {
        classes.push("ring-2 ring-primary ring-offset-1")
      }
      if (mentionedRangeIds.has(range.rangeId)) {
        classes.push("ring-2 ring-amber-500 ring-offset-1")
      }
    }

    return classes.join(" ")
  }

  const getBestDates = () => {
    const totalParticipants = participants.filter((p) => !p.deleted_at).length
    if (totalParticipants === 0) return []

    const scores: {
      date: string
      score: number
      available: number
      unavailable: number
    }[] = []

    dateAvailabilityMap.forEach((availability, dateKey) => {
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
      .slice(0, 3)
  }

  const bestDatesAll = getBestDates()
  const totalActive = participants.filter((p) => !p.deleted_at).length
  const bestDatesPerfect = bestDatesAll.filter(
    (d) => d.available === totalActive && d.unavailable === 0
  )
  const bestDates = onlyPerfectRecommendations
    ? bestDatesPerfect
    : bestDatesAll

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-2">
            <div>
              <CardTitle className="flex items-center gap-2">
                <CalendarDays className="h-5 w-5" />
                전체 일정
              </CardTitle>
              <CardDescription>
                참여자들의 가능/불가능한 날짜를 확인하세요. 기간을 클릭하면 메모를
                작성할 수 있습니다.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              {!isCurrentMonthView && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentMonth(new Date())}
                >
                  오늘로 이동
                </Button>
              )}
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="sr-only">이전 달</span>
              </Button>
              <span className="min-w-[100px] text-center text-sm font-medium">
                {format(currentMonth, "yyyy년 M월", { locale: ko })}
              </span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
                <span className="sr-only">다음 달</span>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-sky-200 dark:bg-sky-700" />
              <span className="text-muted-foreground">모두 가능</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-emerald-200 dark:bg-emerald-700" />
              <span className="text-muted-foreground">일부 가능</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-red-200 dark:bg-red-700" />
              <span className="text-muted-foreground">모두 불가능</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded bg-violet-200 dark:bg-violet-700" />
              <span className="text-muted-foreground">가능/불가능 혼합</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 rounded ring-2 ring-amber-500 ring-offset-1" />
              <span className="text-muted-foreground">멘션된 기간</span>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1">
            {weekDays.map((day) => (
              <div
                key={day}
                className="py-2 text-center text-sm font-medium text-muted-foreground"
              >
                {day}
              </div>
            ))}

            <TooltipProvider delayDuration={100}>
              {calendarDays.map((day) => {
                const dateKey = format(day, "yyyy-MM-dd")
                const availability = dateAvailabilityMap.get(dateKey)
                const dayRanges = rangesByDateKey.get(dateKey) ?? []
                const isCurrentMonthDay = isSameMonth(day, currentMonth)
                const hasRanges = dayRanges.length > 0
                const ringClasses = getRangeRingClasses(dateKey)

                return (
                  <Tooltip key={dateKey}>
                    <TooltipTrigger asChild>
                      <div
                        ref={(el) => {
                          if (el) cellRefs.current.set(dateKey, el)
                          else cellRefs.current.delete(dateKey)
                        }}
                        className={`
                          aspect-square flex flex-col items-center justify-center rounded-lg text-sm transition-colors
                          ${!isCurrentMonthDay ? "opacity-30" : ""}
                          ${isToday(day) ? "ring-2 ring-primary ring-offset-2" : ""}
                          ${getDateClasses(day)}
                          ${ringClasses}
                          ${hasRanges ? "cursor-pointer hover:brightness-95" : "cursor-default"}
                        `}
                        onMouseEnter={() => {
                          if (dayRanges.length > 0) {
                            setHoveredRangeId(
                              dayRanges[dayRanges.length - 1].rangeId
                            )
                          }
                        }}
                        onMouseLeave={() => setHoveredRangeId(null)}
                        onClick={() => {
                          if (dayRanges.length === 0) return
                          if (!currentParticipantId) {
                            onLoginRequired?.()
                            return
                          }
                          handleDateClick(day, dayRanges)
                        }}
                      >
                        <span>{format(day, "d")}</span>
                        {availability &&
                          (availability.available.length > 0 ||
                            availability.unavailable.length > 0) && (
                            <div className="mt-0.5 flex gap-0.5">
                              {availability.available.length > 0 && (
                                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                              )}
                              {availability.unavailable.length > 0 && (
                                <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400" />
                              )}
                            </div>
                          )}
                      </div>
                    </TooltipTrigger>
                    {availability &&
                      (availability.available.length > 0 ||
                        availability.unavailable.length > 0) && (
                        <TooltipContent className="max-w-xs">
                          <p className="mb-2 font-medium">
                            {format(day, "M월 d일 (E)", { locale: ko })}
                          </p>
                          {availability.available.length > 0 && (
                            <div className="mb-1 flex items-start gap-2">
                              <Check className="mt-0.5 h-4 w-4 text-emerald-600 dark:text-emerald-300" />
                              <span className="text-sm">
                                {availability.available.join(", ")}
                              </span>
                            </div>
                          )}
                          {availability.unavailable.length > 0 && (
                            <div className="flex items-start gap-2">
                              <X className="mt-0.5 h-4 w-4 text-zinc-500 dark:text-zinc-300" />
                              <span className="text-sm">
                                {availability.unavailable.join(", ")}
                              </span>
                            </div>
                          )}
                        </TooltipContent>
                      )}
                  </Tooltip>
                )
              })}
            </TooltipProvider>
          </div>

          {bestDatesAll.length > 0 && (
            <div className="mt-6 border-t pt-4">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">추천 날짜</h3>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="only-perfect-recommendations"
                    checked={onlyPerfectRecommendations}
                    onCheckedChange={(checked) =>
                      setOnlyPerfectRecommendations(checked === true)
                    }
                    className="h-3.5 w-3.5"
                  />
                  <label
                    htmlFor="only-perfect-recommendations"
                    className="cursor-pointer select-none text-xs text-muted-foreground"
                  >
                    모두 가능한 날짜만 보기
                  </label>
                </div>
              </div>
              {bestDates.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {bestDates.map(({ date, available }) => (
                    <Badge
                      key={date}
                      variant="secondary"
                      className="border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {format(parseISO(date), "M/d (E)", { locale: ko })} -{" "}
                      {available}명 가능
                    </Badge>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  현재 조건에 맞는 추천 날짜가 없습니다.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <RangePickerPopover
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        ranges={pickerRanges}
        anchorRect={anchorRect}
        onSelect={(range) => {
          if (anchorRect) openMemoForRange(range, anchorRect)
        }}
      />

      {selectedRange && (
        <PeriodMemoPanel
          open={memoOpen}
          onClose={() => {
            setMemoOpen(false)
            setSelectedRange(null)
          }}
          anchorRect={anchorRect}
          roomId={roomId}
          range={selectedRange}
          labels={labels}
          memos={memos}
          participants={participants}
          currentParticipantId={currentParticipantId}
          currentParticipantIsHost={currentParticipantIsHost}
          highlightMemoId={initialMemoId}
          onMemosChange={onMemosChange}
        />
      )}
    </>
  )
}
