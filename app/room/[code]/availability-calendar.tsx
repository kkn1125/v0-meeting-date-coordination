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

  const dateAvailabilityMap = useMemo(() => {
    const map = new Map<string, DateAvailability>()

    participants.forEach((participant) => {
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
    const totalParticipants = participants.length

    if (!availability || totalParticipants === 0) {
      return "bg-muted/30"
    }

    const availableCount = availability.available.length
    const unavailableCount = availability.unavailable.length

    if (availableCount === totalParticipants && unavailableCount === 0) {
      return "bg-available text-available-foreground font-medium"
    }

    if (unavailableCount === totalParticipants) {
      return "bg-unavailable text-unavailable-foreground font-medium"
    }

    if (availableCount > unavailableCount) {
      const opacity = Math.min(0.2 + (availableCount / totalParticipants) * 0.6, 0.8)
      return `bg-available/${Math.round(opacity * 100)} text-available`
    }

    if (unavailableCount > availableCount) {
      const opacity = Math.min(0.2 + (unavailableCount / totalParticipants) * 0.6, 0.8)
      return `bg-unavailable/${Math.round(opacity * 100)} text-unavailable`
    }

    return "bg-muted/50"
  }

  const getBestDates = () => {
    const totalParticipants = participants.length
    if (totalParticipants === 0) return []

    const scores: { date: string; score: number; available: number }[] = []

    dateAvailabilityMap.forEach((availability, dateKey) => {
      const availableCount = availability.available.length
      const unavailableCount = availability.unavailable.length
      const score = availableCount - unavailableCount

      if (availableCount > 0) {
        scores.push({ date: dateKey, score, available: availableCount })
      }
    })

    return scores
      .sort((a, b) => b.score - a.score || b.available - a.available)
      .slice(0, 3)
  }

  const bestDates = getBestDates()

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
        <div className="flex gap-4 mb-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-available" />
            <span className="text-muted-foreground">가능</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 rounded bg-unavailable" />
            <span className="text-muted-foreground">불가능</span>
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
                            <div className="w-1.5 h-1.5 rounded-full bg-available" />
                          )}
                          {availability.unavailable.length > 0 && (
                            <div className="w-1.5 h-1.5 rounded-full bg-unavailable" />
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
                          <Check className="h-4 w-4 text-available mt-0.5" />
                          <span className="text-sm">
                            {availability.available.join(", ")}
                          </span>
                        </div>
                      )}
                      {availability.unavailable.length > 0 && (
                        <div className="flex items-start gap-2">
                          <X className="h-4 w-4 text-unavailable mt-0.5" />
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

        {bestDates.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <h3 className="text-sm font-medium mb-3">추천 날짜</h3>
            <div className="flex flex-wrap gap-2">
              {bestDates.map(({ date, available }) => (
                <Badge
                  key={date}
                  variant="secondary"
                  className="bg-available/10 text-available border-available/20"
                >
                  {format(parseISO(date), "M/d (E)", { locale: ko })} - {available}명 가능
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
