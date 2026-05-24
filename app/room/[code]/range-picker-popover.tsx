"use client"

import { format, parseISO } from "date-fns"
import { ko } from "date-fns/locale"
import { Button } from "@/components/ui/button"
import type { RangeSpanWithKeys } from "@/lib/calendar-ranges"

interface RangePickerPopoverProps {
  open: boolean
  onClose: () => void
  ranges: RangeSpanWithKeys[]
  anchorRect: DOMRect | null
  onSelect: (range: RangeSpanWithKeys) => void
}

export function RangePickerPopover({
  open,
  onClose,
  ranges,
  anchorRect,
  onSelect,
}: RangePickerPopoverProps) {
  if (!open || !anchorRect) return null

  const placeAbove = anchorRect.top > window.innerHeight / 2
  const top = placeAbove ? anchorRect.top - 8 : anchorRect.bottom + 8
  const left = Math.min(anchorRect.left, window.innerWidth - 300)

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div
        className="fixed z-50 w-72 rounded-md border bg-popover p-3 shadow-md"
        style={{
          left,
          top,
          transform: placeAbove ? "translateY(-100%)" : undefined,
        }}
      >
        <p className="mb-2 text-sm font-medium">기간 선택</p>
        <div className="flex flex-col gap-1">
          {ranges.map((range) => (
            <Button
              key={range.rangeId}
              variant="ghost"
              size="sm"
              className="h-auto justify-start whitespace-normal px-2 py-2 text-left"
              onClick={() => onSelect(range)}
            >
              <span className="text-sm">
                {range.participantName} -{" "}
                {format(parseISO(range.startDate), "M/d", { locale: ko })}~
                {format(parseISO(range.endDate), "M/d", { locale: ko })}
              </span>
            </Button>
          ))}
        </div>
      </div>
    </>
  )
}
