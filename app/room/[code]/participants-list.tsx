"use client"

import { useState } from "react"
import type { ParticipantWithDateRanges } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Users, Check, X, Undo2, Ban } from "lucide-react"

interface ParticipantsListProps extends React.HTMLAttributes<HTMLDivElement> {
  participants: ParticipantWithDateRanges[]
  currentParticipantId?: string
  currentParticipantIsHost?: boolean
}

export function ParticipantsList({
  participants,
  currentParticipantId,
  currentParticipantIsHost,
  ...rest
}: ParticipantsListProps) {
  const [isActionLoadingId, setIsActionLoadingId] = useState<string | null>(null)

  const getAvailableDaysCount = (participant: ParticipantWithDateRanges) => {
    return participant.date_ranges.filter((r) => r.is_available).length
  }

  const getUnavailableDaysCount = (participant: ParticipantWithDateRanges) => {
    return participant.date_ranges.filter((r) => !r.is_available).length
  }

  const handleKickOrRestore = async (participant: ParticipantWithDateRanges) => {
    setIsActionLoadingId(participant.id)
    try {
      const res = await fetch("/api/participants/kick", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          participantId: participant.id,
          action: participant.deleted_at ? "restore" : "kick",
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        console.error(data.error || "작업에 실패했습니다.")
      }
    } catch (error) {
      console.error(error)
    } finally {
      setIsActionLoadingId(null)
    }
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
                        강퇴됨
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
                        onClick={() => handleKickOrRestore(participant)}
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
    </Card>
  )
}
