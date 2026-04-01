"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { ParticipantWithDateRanges } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Badge } from "@/components/ui/badge"
import { CalendarPlus, Check, X, Trash2 } from "lucide-react"
import { format, eachDayOfInterval, parseISO } from "date-fns"
import { ko } from "date-fns/locale"
import type { DateRange as DayPickerDateRange } from "react-day-picker"

interface DateInputFormProps {
  participant: ParticipantWithDateRanges
  onDateRangeAdded: () => void
}

export function DateInputForm({ participant, onDateRangeAdded }: DateInputFormProps) {
  const [selectedRange, setSelectedRange] = useState<DayPickerDateRange | undefined>()
  const [isAvailable, setIsAvailable] = useState(true)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!selectedRange?.from) return

    setIsSubmitting(true)

    try {
      const supabase = createClient()

      const startDate = format(selectedRange.from, "yyyy-MM-dd")
      const endDate = selectedRange.to 
        ? format(selectedRange.to, "yyyy-MM-dd") 
        : startDate

      await supabase
        .from("date_ranges")
        .insert({
          participant_id: participant.id,
          start_date: startDate,
          end_date: endDate,
          is_available: isAvailable,
        })

      setSelectedRange(undefined)
      onDateRangeAdded()
    } catch (err) {
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteDateRange = async (dateRangeId: string) => {
    const supabase = createClient()
    await supabase.from("date_ranges").delete().eq("id", dateRangeId)
    onDateRangeAdded()
  }

  const getExistingDates = () => {
    const availableDates: Date[] = []
    const unavailableDates: Date[] = []

    participant.date_ranges.forEach((range) => {
      const dates = eachDayOfInterval({
        start: parseISO(range.start_date),
        end: parseISO(range.end_date),
      })

      if (range.is_available) {
        availableDates.push(...dates)
      } else {
        unavailableDates.push(...dates)
      }
    })

    return { availableDates, unavailableDates }
  }

  const { availableDates, unavailableDates } = getExistingDates()

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="h-5 w-5" />
          날짜 입력
        </CardTitle>
        <CardDescription>
          <span className="font-medium text-foreground">{participant.name}</span>님, 가능/불가능한 날짜를 선택하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={isAvailable ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAvailable(true)}
            className={isAvailable ? "bg-available hover:bg-available/90 text-available-foreground" : ""}
          >
            <Check className="h-4 w-4 mr-1" />
            가능
          </Button>
          <Button
            variant={!isAvailable ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAvailable(false)}
            className={!isAvailable ? "bg-unavailable hover:bg-unavailable/90 text-unavailable-foreground" : ""}
          >
            <X className="h-4 w-4 mr-1" />
            불가능
          </Button>
        </div>

        <div className="border rounded-lg p-2">
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={setSelectedRange}
            locale={ko}
            modifiers={{
              available: availableDates,
              unavailable: unavailableDates,
            }}
            modifiersClassNames={{
              available: "bg-available/20 text-available rounded-md",
              unavailable: "bg-unavailable/20 text-unavailable rounded-md",
            }}
          />
        </div>

        <Button
          onClick={handleSubmit}
          disabled={!selectedRange?.from || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "저장 중..." : "날짜 저장"}
        </Button>

        {participant.date_ranges.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground">내가 입력한 날짜</p>
            <div className="space-y-2">
              {participant.date_ranges.map((range) => (
                <div
                  key={range.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={range.is_available 
                        ? "bg-available/20 text-available border-available/30" 
                        : "bg-unavailable/20 text-unavailable border-unavailable/30"
                      }
                    >
                      {range.is_available ? "가능" : "불가능"}
                    </Badge>
                    <span className="text-sm">
                      {format(parseISO(range.start_date), "M/d", { locale: ko })}
                      {range.start_date !== range.end_date && (
                        <> - {format(parseISO(range.end_date), "M/d", { locale: ko })}</>
                      )}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteDateRange(range.id)}
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">삭제</span>
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
