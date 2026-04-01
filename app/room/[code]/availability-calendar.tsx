"use client"

import { useMemo, useState } from "react"
import type { ParticipantWithDateRanges } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { CalendarDays, ChevronLeft, ChevronRight, Check, X } from "lucide-react"
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
  isToday,
} from "date-fns"
import { ko } from "date-fns/locale"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

interface AvailabilityCalendarProps {
  participants: ParticipantWithDateRanges[]
  currentParticipantId?: string
}

interface DateAvailability {
  available: string[]
  unavailable: string[]
}

export function AvailabilityCalendar({ participants, currentParticipantId }: AvailabilityCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date())
  const [onlyPerfectRecommendations, setOnlyPerfectRecommendations] = useState(false)

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
          const existing = map.get(dateKey) || { available: [], unavailable: [] }

          if (range.is_available) {
            if (!existing.available.includes(participant.name)) {
              existing.available.push(participant.name)
            }
          } else {
            if (!existing.unavailable.includes(participant.name)) {
              existing.unavailable.push(participant.name)
            }
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
  const calendarDays = eachDayOfInterval({ start: calendarStart, end: calendarEnd })

  const weekDays = ["일", "월", "화", "수", "목", "금", "토"]

  const getDateClasses = (date: Date) => {
    const dateKey = format(date, "yyyy-MM-dd")
    const availability = dateAvailabilityMap.get(dateKey)
    const totalParticipants = participants.filter((p) => !p.deleted_at).length

    if (!availability || totalParticipants === 0) {
      return "bg-muted/30"
    }

    const availableCount = availability.available.length
    const unavailableCount = availability.unavailable.length

    // 4. 모두 가능한 구간: 파스텔 파란색
    if (availableCount === totalParticipants && unavailableCount === 0) {
      return "bg-sky-200 dark:bg-sky-700 text-sky-900 dark:text-sky-50 font-medium"
    }

    // 2. 모두 불가능한 기간: 파스텔 붉은색
    if (unavailableCount === totalParticipants) {
      return "bg-red-200 dark:bg-red-700 text-red-900 dark:text-red-50 font-medium"
    }

    // 3. 가능/불가능 겹치는 구간: 파스텔 보라색
    if (availableCount > 0 && unavailableCount > 0) {
      return "bg-violet-200 dark:bg-violet-700 text-violet-900 dark:text-violet-50"
    }

    // 1. 일부 가능한 일정(누군가는 가능, 모두 가능은 아님): 파스텔 연두색
    if (availableCount > 0 && unavailableCount === 0) {
      return "bg-emerald-200 dark:bg-emerald-700 text-emerald-900 dark:text-emerald-50"
    }

    return "bg-muted/50"
  }

  const getBestDates = () => {
    const totalParticipants = participants.filter((p) => !p.deleted_at).length
    if (totalParticipants === 0) return []

    const scores: { date: string; score: number; available: number; unavailable: number }[] = []

    dateAvailabilityMap.forEach((availability, dateKey) => {
      const availableCount = availability.available.length
      const unavailableCount = availability.unavailable.length
      const score = availableCount - unavailableCount

      if (availableCount > 0) {
        scores.push({ date: dateKey, score, available: availableCount, unavailable: unavailableCount })
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
  const bestDates = onlyPerfectRecommendations ? bestDatesPerfect : bestDatesAll

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              전체 일정
            </CardTitle>
            <CardDescription>
              참여자들의 가능/불가능한 날짜를 확인하세요
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              <span className="sr-only">이전 달</span>
            </Button>
            <span className="text-sm font-medium min-w-[100px] text-center">
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
        <div className="flex flex-wrap gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-emerald-200 dark:bg-emerald-700" />
            <span className="text-muted-foreground">일부 가능 (누군가는 가능)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-red-200 dark:bg-red-700" />
            <span className="text-muted-foreground">모두 불가능</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-violet-200 dark:bg-violet-700" />
            <span className="text-muted-foreground">가능/불가능 혼합</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-sky-200 dark:bg-sky-700" />
            <span className="text-muted-foreground">모두 가능</span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1">
          {weekDays.map((day) => (
            <div
              key={day}
              className="text-center text-sm font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}

          <TooltipProvider delayDuration={100}>
            {calendarDays.map((day) => {
              const dateKey = format(day, "yyyy-MM-dd")
              const availability = dateAvailabilityMap.get(dateKey)
              const isCurrentMonth = isSameMonth(day, currentMonth)

              return (
                <Tooltip key={dateKey}>
                  <TooltipTrigger asChild>
                    <div
                      className={`
                        aspect-square flex flex-col items-center justify-center rounded-lg text-sm cursor-default transition-colors
                        ${!isCurrentMonth ? "opacity-30" : ""}
                        ${isToday(day) ? "ring-2 ring-primary ring-offset-2" : ""}
                        ${getDateClasses(day)}
                      `}
                    >
                      <span>{format(day, "d")}</span>
                      {availability && (availability.available.length > 0 || availability.unavailable.length > 0) && (
                        <div className="flex gap-0.5 mt-0.5">
                          {availability.available.length > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" />
                          )}
                          {availability.unavailable.length > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-500 dark:bg-zinc-400" />
                          )}
                        </div>
                      )}
                    </div>
                  </TooltipTrigger>
                  {availability && (availability.available.length > 0 || availability.unavailable.length > 0) && (
                    <TooltipContent className="max-w-xs">
                      <p className="font-medium mb-2">
                        {format(day, "M월 d일 (E)", { locale: ko })}
                      </p>
                      {availability.available.length > 0 && (
                        <div className="flex items-start gap-2 mb-1">
                          <Check className="h-4 w-4 text-emerald-600 dark:text-emerald-300 mt-0.5" />
                          <span className="text-sm">
                            {availability.available.join(", ")}
                          </span>
                        </div>
                      )}
                      {availability.unavailable.length > 0 && (
                        <div className="flex items-start gap-2">
                          <X className="h-4 w-4 text-zinc-500 dark:text-zinc-300 mt-0.5" />
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
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between gap-2 mb-3">
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
                  className="text-xs text-muted-foreground cursor-pointer select-none"
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
                    className="bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700"
                  >
                    {format(parseISO(date), "M/d (E)", { locale: ko })} - {available}명 가능
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
  )
}
