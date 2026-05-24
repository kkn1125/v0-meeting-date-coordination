"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarDayButton } from "@/components/ui/calendar";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { apiFetch } from "@/lib/api-client";
import type { ParticipantWithDateRanges, RoomLabel } from "@/lib/types";
import { LabelSelectField } from "./label-select-field";
import { cn } from "@/lib/utils";
import { eachDayOfInterval, format, isSameDay, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { CalendarPlus, Check, Trash2, X } from "lucide-react";
import { useMemo, useState } from "react";
import type { DateRange as DayPickerDateRange } from "react-day-picker";

interface DateInputFormProps {
  participant: ParticipantWithDateRanges;
  labels: RoomLabel[];
  roomId: string;
  onDateRangeAdded?: () => void;
}

export function DateInputForm({
  participant,
  labels,
  roomId,
  onDateRangeAdded,
}: DateInputFormProps) {
  const [selectedRange, setSelectedRange] = useState<
    DayPickerDateRange | undefined
  >();
  const [isAvailable, setIsAvailable] = useState(true);
  const [selectedLabelId, setSelectedLabelId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const labelsById = useMemo(
    () => new Map(labels.map((l) => [l.id, l])),
    [labels]
  );

  const handleSubmit = async () => {
    if (!selectedRange?.from) return;

    setIsSubmitting(true);

    try {
      const startDate = format(selectedRange.from, "yyyy-MM-dd");
      const endDate = selectedRange.to
        ? format(selectedRange.to, "yyyy-MM-dd")
        : startDate;

      const res = await apiFetch("/api/date-ranges", {
        method: "POST",
        body: JSON.stringify({
          roomId,
          startDate,
          endDate,
          isAvailable,
          labelId: selectedLabelId,
        }),
      });

      if (!res.ok) throw new Error("Failed to save date range");

      setSelectedRange(undefined);
      setSelectedLabelId(null);
      onDateRangeAdded?.();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDateRange = async (dateRangeId: string) => {
    try {
      const res = await apiFetch(`/api/date-ranges/${dateRangeId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete date range");
      onDateRangeAdded?.();
    } catch (err) {
      console.error(err);
    }
  };

  const getExistingDates = () => {
    const availableDates: Date[] = [];
    const unavailableDates: Date[] = [];

    const invalidLabelDates: Date[] = [];

    participant.date_ranges.forEach((range) => {
      const dates = eachDayOfInterval({
        start: parseISO(range.start_date),
        end: parseISO(range.end_date),
      });

      const label = range.label_id ? labelsById.get(range.label_id) : null;
      const hasInvalidLabel =
        range.label_id && (!label || !label.is_valid);

      if (hasInvalidLabel) {
        invalidLabelDates.push(...dates);
      } else if (range.is_available) {
        availableDates.push(...dates);
      } else {
        unavailableDates.push(...dates);
      }
    });

    return { availableDates, unavailableDates, invalidLabelDates };
  };

  const { availableDates, unavailableDates, invalidLabelDates } =
    getExistingDates();

  const getSelectedRangeDates = () => {
    if (!selectedRange?.from) return [];

    const endDate = selectedRange.to || selectedRange.from;
    return eachDayOfInterval({
      start: selectedRange.from,
      end: endDate,
    });
  };

  const selectedRangeDates = getSelectedRangeDates();

  const rangeSelectionClasses = isAvailable
    ? "data-[range-start=true]:bg-available data-[range-start=true]:text-available-foreground data-[range-end=true]:bg-available data-[range-end=true]:text-available-foreground data-[range-middle=true]:bg-available/50 data-[range-middle=true]:text-foreground dark:data-[range-middle=true]:bg-available/40"
    : "data-[range-start=true]:bg-unavailable data-[range-start=true]:text-unavailable-foreground data-[range-end=true]:bg-unavailable data-[range-end=true]:text-unavailable-foreground data-[range-middle=true]:bg-unavailable/50 data-[range-middle=true]:text-unavailable-foreground dark:data-[range-middle=true]:bg-unavailable/40";

  const rangeCellClasses = isAvailable
    ? {
        range_start: "rounded-l-md bg-available/50",
        range_middle: "rounded-none bg-available/35",
        range_end: "rounded-r-md bg-available/50",
      }
    : {
        range_start: "rounded-l-md bg-unavailable/50",
        range_middle: "rounded-none bg-unavailable/35",
        range_end: "rounded-r-md bg-unavailable/50",
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
              invalidLabel: invalidLabelDates,
              selectionPreview: selectedRangeDates,
            }}
            modifiersClassNames={{
              available:
                "bg-available/30 text-foreground font-medium rounded-md",
              unavailable:
                "bg-unavailable/30 text-unavailable-foreground font-medium rounded-md",
              invalidLabel:
                "bg-zinc-200/70 dark:bg-zinc-600/40 text-muted-foreground font-medium rounded-md",
              selectionPreview: isAvailable
                ? "ring-2 ring-inset ring-available/70"
                : "ring-2 ring-inset ring-unavailable/70",
            }}
            components={{
              DayButton: ({ className, ...props }) => (
                <CalendarDayButton
                  className={cn(rangeSelectionClasses, className)}
                  {...props}
                />
              ),
            }}
            classNames={{
              root: "w-full",
              months: "w-full",
              ...rangeCellClasses,
            }}
          />
        </div>

        {selectedRange?.from && (
          <div
            className={cn(
              "text-sm p-3 rounded-lg border",
              isAvailable
                ? "bg-available/10 border-available/40"
                : "bg-unavailable/10 border-unavailable/40"
            )}
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

        <LabelSelectField
          labels={labels}
          value={selectedLabelId}
          onChange={setSelectedLabelId}
        />

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
              {participant.date_ranges.map((range) => {
                const label = range.label_id
                  ? labelsById.get(range.label_id)
                  : null;
                const hasInvalidLabel =
                  range.label_id && (!label || !label.is_valid);

                return (
                <div
                  key={range.id}
                  className={`flex items-center justify-between p-2 rounded-lg ${
                    hasInvalidLabel ? "bg-zinc-100/80 dark:bg-zinc-800/50" : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      variant="secondary"
                      className={
                        hasInvalidLabel
                          ? "bg-zinc-200/80 text-muted-foreground border border-zinc-300"
                          : range.is_available
                          ? "bg-available/20 text-foreground border border-available/40"
                          : "bg-unavailable/20 text-unavailable-foreground border border-unavailable/40"
                      }
                    >
                      {range.is_available ? "가능" : "불가능"}
                    </Badge>
                    {label && (
                      <Badge
                        variant="outline"
                        className={
                          hasInvalidLabel
                            ? "text-muted-foreground border-zinc-300"
                            : ""
                        }
                      >
                        {label.name}
                      </Badge>
                    )}
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
              );
              })}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
