"use client"

import type { ParticipantWithDateRanges } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Users, Check, X } from "lucide-react"

interface ParticipantsListProps {
  participants: ParticipantWithDateRanges[]
  currentParticipantId?: string
}

export function ParticipantsList({ participants, currentParticipantId }: ParticipantsListProps) {
  const getAvailableDaysCount = (participant: ParticipantWithDateRanges) => {
    return participant.date_ranges.filter(r => r.is_available).length
  }

  const getUnavailableDaysCount = (participant: ParticipantWithDateRanges) => {
    return participant.date_ranges.filter(r => !r.is_available).length
  }

  if (participants.length === 0) {
    return (
      <Card>
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          참여자 ({participants.length}명)
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="space-y-3">
          {participants.map((participant) => {
            const isCurrentUser = participant.id === currentParticipantId
            const availableCount = getAvailableDaysCount(participant)
            const unavailableCount = getUnavailableDaysCount(participant)

            return (
              <li
                key={participant.id}
                className={`flex items-center justify-between p-3 rounded-lg ${
                  isCurrentUser ? "bg-primary/5 border border-primary/20" : "bg-muted/50"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium text-foreground">
                    {participant.name}
                  </span>
                  {isCurrentUser && (
                    <Badge variant="secondary" className="text-xs">
                      나
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {availableCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-available">
                      <Check className="h-3 w-3" />
                      {availableCount}
                    </span>
                  )}
                  {unavailableCount > 0 && (
                    <span className="flex items-center gap-1 text-xs text-unavailable">
                      <X className="h-3 w-3" />
                      {unavailableCount}
                    </span>
                  )}
                  {availableCount === 0 && unavailableCount === 0 && (
                    <span className="text-xs text-muted-foreground">
                      입력 대기
                    </span>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      </CardContent>
    </Card>
  )
}
