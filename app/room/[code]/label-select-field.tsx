"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { RoomLabel } from "@/lib/types"

interface LabelSelectFieldProps {
  labels: RoomLabel[]
  value: string | null
  onChange: (labelId: string | null) => void
  disabled?: boolean
  lockedLabel?: RoomLabel | null
  className?: string
}

export function LabelSelectField({
  labels,
  value,
  onChange,
  disabled = false,
  lockedLabel = null,
  className,
}: LabelSelectFieldProps) {
  if (lockedLabel && !lockedLabel.is_valid) {
    return (
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground">라벨</p>
        <p className="text-sm font-medium text-muted-foreground">{lockedLabel.name}</p>
        <p className="text-xs text-muted-foreground">
          유효하지 않은 라벨 (변경 불가)
        </p>
      </div>
    )
  }

  const validLabels = labels.filter((l) => l.is_valid)

  return (
    <div className={className}>
      <p className="text-xs text-muted-foreground mb-1.5">라벨 (선택)</p>
      <Select
        value={value ?? "none"}
        onValueChange={(v) => onChange(v === "none" ? null : v)}
        disabled={disabled}
      >
        <SelectTrigger className="w-full">
          <SelectValue placeholder="라벨 없음" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="none">라벨 없음</SelectItem>
          {validLabels.map((label) => (
            <SelectItem key={label.id} value={label.id}>
              {label.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
