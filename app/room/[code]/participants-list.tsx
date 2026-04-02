"use client"

import { useState } from "react"
import type { ParticipantWithDateRanges } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Check, X, Undo2, Ban } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface ParticipantsListProps extends React.HTMLAttributes<HTMLDivElement> {
  participants: ParticipantWithDateRanges[]
  roomId: string
  currentParticipantId?: string
  currentParticipantIsHost?: boolean
  onParticipantsChange?: () => void | Promise<void>
}

export function ParticipantsList({
  participants,
  roomId,
  currentParticipantId,
  currentParticipantIsHost,
  onParticipantsChange,
  ...rest
}: ParticipantsListProps) {
  const [isActionLoadingId, setIsActionLoadingId] = useState<string | null>(null)
  const [confirmTarget, setConfirmTarget] = useState<ParticipantWithDateRanges | null>(null)
  const [confirmMode, setConfirmMode] = useState<"kick" | "restore" | null>(null)

  const getAvailableDaysCount = (participant: ParticipantWithDateRanges) => {
    return participant.date_ranges.filter((r) => r.is_available).length
  }

  const getUnavailableDaysCount = (participant: ParticipantWithDateRanges) => {
    return participant.date_ranges.filter((r) => !r.is_available).length
  }

  const runKickOrRestore = async (participant: ParticipantWithDateRanges) => {
    setIsActionLoadingId(participant.id)
    try {
      const endpoint = participant.deleted_at ? "/api/participants/restore" : "/api/participants/kick"

      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participant.id,
          roomId,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        console.error(data.error || "작업에 실패했습니다.")
        return
      }

      // 성공 시 최신 목록 다시 불러오기
      if (onParticipantsChange) {
        await onParticipantsChange()
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsActionLoadingId(null)
    }
  }

  const handleKickOrRestoreClick = (participant: ParticipantWithDateRanges) => {
    if (participant.deleted_at) {
      setConfirmMode("restore")
    } else {
      setConfirmMode("kick")
    }
    setConfirmTarget(participant)
  }

  const handleConfirm = async () => {
    if (!confirmTarget) return
    await runKickOrRestore(confirmTarget)
    setConfirmTarget(null)
    setConfirmMode(null)
  }

  const visibleParticipants = participants

  if (visibleParticipants.length === 0) {
    return (
      <Card {...rest}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            참여자
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground text-center py-4">
            아직 참여자가 없습니다.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card {...rest}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          참여자 ({visibleParticipants.length}명)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="space-y-3">
          {visibleParticipants.map((participant) => {
            const isCurrentUser = participant.id === currentParticipantId
            const availableCount = getAvailableDaysCount(participant)
            const unavailableCount = getUnavailableDaysCount(participant)
            const isKicked = !!participant.deleted_at

            return (
              <li
                key={participant.id}
                className={`flex flex-col gap-2 p-3 rounded-lg border ${
                  isCurrentUser
                    ? "bg-primary/5 border-primary/40"
                    : isKicked
                      ? "bg-muted/40 border-dashed border-destructive/40 opacity-70"
                      : "bg-muted/40 border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`font-medium truncate ${
                        isKicked ? "line-through text-muted-foreground" : "text-foreground"
                      }`}
                    >
                      {participant.name}
                    </span>
                    {participant.is_host && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        호스트
                      </Badge>
                    )}
                    {isCurrentUser && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        나
                      </Badge>
                    )}
                    {isKicked && (
                      <Badge variant="destructive" className="text-[10px] px-1.5 py-0 flex items-center gap-1">
                        <Ban className="h-3 w-3" />
                        비활성화 됨
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {availableCount > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-emerald-700 dark:text-emerald-300">
                        <Check className="h-3 w-3" />
                        {availableCount}
                      </span>
                    )}
                    {unavailableCount > 0 && (
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                        <X className="h-3 w-3" />
                        {unavailableCount}
                      </span>
                    )}
                    {availableCount === 0 && unavailableCount === 0 && (
                      <span className="text-[11px] text-muted-foreground">
                        입력 대기
                      </span>
                    )}

                    {currentParticipantIsHost && !participant.is_host && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => handleKickOrRestoreClick(participant)}
                        disabled={isActionLoadingId === participant.id}
                      >
                        {participant.deleted_at ? (
                          <Undo2 className="h-3.5 w-3.5" />
                        ) : (
                          <Ban className="h-3.5 w-3.5" />
                        )}
                        <span className="sr-only">
                          {participant.deleted_at ? "복구" : "강퇴"}
                        </span>
                      </Button>
                    )}
                  </div>
                </div>

              </li>
            )
          })}
        </ul>
      </CardContent>

      <AlertDialog
        open={!!confirmTarget}
        onOpenChange={(open) => {
          if (!open) {
            setConfirmTarget(null)
            setConfirmMode(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmMode === "restore" ? "복구하시겠습니까?" : "비활성하시겠습니까?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmMode === "restore"
                ? "선택한 참여자를 다시 활성화합니다."
                : "선택한 참여자를 이 모임에서 비활성화합니다."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setConfirmTarget(null)
                setConfirmMode(null)
              }}
            >
              취소
            </AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm}>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
