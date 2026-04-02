"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { ParticipantWithDateRanges } from "@/lib/types";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { CalendarPlus, Check, X, Trash2 } from "lucide-react";
import { format, eachDayOfInterval, parseISO, isSameDay } from "date-fns";
import { ko } from "date-fns/locale";
import type { DateRange as DayPickerDateRange } from "react-day-picker";

interface DateInputFormProps {
  participant: ParticipantWithDateRanges;
  onDateRangeAdded: () => void;
}

export function DateInputForm({
  participant,
  onDateRangeAdded,
}: DateInputFormProps) {
  const [selectedRange, setSelectedRange] = useState<
    DayPickerDateRange | undefined
  >();
  const [isAvailable, setIsAvailable] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!selectedRange?.from) return;

    setIsSubmitting(true);

    try {
      const supabase = createClient();

      const startDate = format(selectedRange.from, "yyyy-MM-dd");
      const endDate = selectedRange.to
        ? format(selectedRange.to, "yyyy-MM-dd")
        : startDate;

      // 방(room) 기준으로 직접 date_ranges 를 생성
      await supabase.from("date_ranges").insert({
        participant_id: participant.id,
        room_id: participant.room_id,
        start_date: startDate,
        end_date: endDate,
        is_available: isAvailable,
      });

      setSelectedRange(undefined);
      onDateRangeAdded();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDateRange = async (dateRangeId: string) => {
    const supabase = createClient();
    await supabase.from("date_ranges").delete().eq("id", dateRangeId);
    onDateRangeAdded();
  };

  const getExistingDates = () => {
    const availableDates: Date[] = [];
    const unavailableDates: Date[] = [];

    participant.date_ranges.forEach((range) => {
      const dates = eachDayOfInterval({
        start: parseISO(range.start_date),
        end: parseISO(range.end_date),
      });

      if (range.is_available) {
        availableDates.push(...dates);
      } else {
        unavailableDates.push(...dates);
      }
    });

    return { availableDates, unavailableDates };
  };

  const { availableDates, unavailableDates } = getExistingDates();

  // Get selected range dates for visual feedback
  const getSelectedRangeDates = () => {
    if (!selectedRange?.from) return [];

    const endDate = selectedRange.to || selectedRange.from;
    return eachDayOfInterval({
      start: selectedRange.from,
      end: endDate,
    });
  };

  const selectedRangeDates = getSelectedRangeDates();

  // Custom day class function for selection preview
  const getModifiersClassNames = () => {
    const baseClasses = {
      available: "bg-muted text-muted-foreground rounded-md",
      unavailable:
        "bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-md",
    };

    return baseClasses;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CalendarPlus className="h-5 w-5" />
          날짜 입력
        </CardTitle>
        <CardDescription>
          <span className="font-medium text-foreground">
            {participant.name}
          </span>
          님, 가능/불가능한 날짜를 선택하세요
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2">
          <Button
            variant={isAvailable ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAvailable(true)}
            className={
              isAvailable
                ? "bg-available hover:bg-available/90 text-available-foreground"
                : ""
            }
          >
            <Check className="h-4 w-4 mr-1" />
            가능
          </Button>
          <Button
            variant={!isAvailable ? "default" : "outline"}
            size="sm"
            onClick={() => setIsAvailable(false)}
            className={
              !isAvailable
                ? "bg-unavailable hover:bg-unavailable/90 text-unavailable-foreground"
                : ""
            }
          >
            <X className="h-4 w-4 mr-1" />
            불가능
          </Button>
        </div>

        <div className="border rounded-lg p-2 w-full">
          <Calendar
            mode="range"
            selected={selectedRange}
            onSelect={setSelectedRange}
            locale={ko}
            modifiers={{
              available: availableDates,
              unavailable: unavailableDates,
              selectionPreview: selectedRangeDates,
            }}
            modifiersClassNames={{
              ...getModifiersClassNames(),
              selectionPreview: isAvailable
                ? "ring-2 ring-inset ring-zinc-400 dark:ring-zinc-500"
                : "ring-2 ring-inset ring-red-300 dark:ring-red-700",
            }}
            classNames={{
              root: "w-full",
              months: "w-full",
              range_start: isAvailable
                ? "rounded-l-md bg-zinc-200 dark:bg-zinc-700"
                : "rounded-l-md bg-red-200 dark:bg-red-900/60",
              range_middle: isAvailable
                ? "rounded-none bg-zinc-100 dark:bg-zinc-800"
                : "rounded-none bg-red-100 dark:bg-red-950/40",
              range_end: isAvailable
                ? "rounded-r-md bg-zinc-200 dark:bg-zinc-700"
                : "rounded-r-md bg-red-200 dark:bg-red-900/60",
            }}
          />
        </div>

        {selectedRange?.from && (
          <div
            className={`text-sm p-3 rounded-lg border ${
              isAvailable
                ? "bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700"
                : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
            }`}
          >
            <span className="font-medium">
              {isAvailable ? "가능" : "불가능"} 기간:
            </span>{" "}
            {format(selectedRange.from, "yyyy년 M월 d일", { locale: ko })}
            {selectedRange.to &&
              !isSameDay(selectedRange.from, selectedRange.to) && (
                <>
                  {" "}
                  ~{" "}
                  {format(selectedRange.to, "yyyy년 M월 d일", {
                    locale: ko,
                  })}
                </>
              )}
          </div>
        )}

        <Button
          onClick={handleSubmit}
          disabled={!selectedRange?.from || isSubmitting}
          className="w-full"
        >
          {isSubmitting ? "저장 중..." : "날짜 저장"}
        </Button>

        {participant.date_ranges.length > 0 && (
          <div className="space-y-2 pt-4 border-t">
            <p className="text-sm font-medium text-muted-foreground">
              내가 입력한 날짜
            </p>
            <div className="space-y-2">
              {participant.date_ranges.map((range) => (
                <div
                  key={range.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={
                        range.is_available
                          ? "bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-200"
                          : "bg-red-100 dark:bg-red-900/60 text-red-700 dark:text-red-200"
                      }
                    >
                      {range.is_available ? "가능" : "불가능"}
                    </Badge>
                    <span className="text-sm">
                      {format(parseISO(range.start_date), "M/d", {
                        locale: ko,
                      })}
                      {range.start_date !== range.end_date && (
                        <>
                          {" "}
                          -{" "}
                          {format(parseISO(range.end_date), "M/d", {
                            locale: ko,
                          })}
                        </>
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
  );
}
