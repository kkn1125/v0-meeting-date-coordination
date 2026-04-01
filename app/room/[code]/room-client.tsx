"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Room, ParticipantWithDateRanges } from "@/lib/types"
import { getSessionFromStorage, getGlobalSessionFromStorage, clearSessionFromStorage } from "@/lib/auth"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LogOut, ShieldCheck, User } from "lucide-react"
import { RoomHeader } from "./room-header"
import { ParticipantsList } from "./participants-list"
import { AvailabilityCalendar } from "./availability-calendar"
import { DateInputForm } from "./date-input-form"

interface RoomClientProps {
  room: Room
  initialParticipants: ParticipantWithDateRanges[]
}

export function RoomClient({ room, initialParticipants }: RoomClientProps) {
  const [participants, setParticipants] = useState<ParticipantWithDateRanges[]>(initialParticipants)
  const [currentParticipant, setCurrentParticipant] = useState<ParticipantWithDateRanges | null>(null)
  const supabase = createClient()

  const fetchParticipants = useCallback(async () => {
    const { data } = await supabase
      .from("participants")
      .select(`
        *,
        date_ranges (*)
      `)
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })

    if (data) {
      setParticipants(data)

      if (currentParticipant) {
        const updated = data.find((p) => p.id === currentParticipant.id)
        if (updated) {
          setCurrentParticipant(updated)
        }
      }
    }
  }, [supabase, room.id, currentParticipant])

  useEffect(() => {
    const roomSession = getSessionFromStorage(room.id)
    if (roomSession) {
      const existingById = initialParticipants.find((p) => p.id === roomSession.participantId)
      if (existingById) {
        setCurrentParticipant(existingById)
        return
      }
    }

    const globalSession = getGlobalSessionFromStorage()
    if (globalSession) {
      const existingByName = initialParticipants.find(
        (p) => p.name === globalSession.name && !p.deleted_at
      )
      if (existingByName) {
        setCurrentParticipant(existingByName)
      }
    }
  }, [room.id, initialParticipants])

  useEffect(() => {
    const participantsChannel = supabase
      .channel("participants-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "participants",
          filter: `room_id=eq.${room.id}`,
        },
        () => {
          fetchParticipants()
        }
      )
      .subscribe()

    const dateRangesChannel = supabase
      .channel("date-ranges-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "date_ranges",
        },
        () => {
          fetchParticipants()
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(participantsChannel)
      supabase.removeChannel(dateRangesChannel)
    }
  }, [supabase, room.id, fetchParticipants])

  const handleLogout = () => {
    clearSessionFromStorage(room.id)
    setCurrentParticipant(null)
  }

  const handleDateRangeAdded = () => {
    fetchParticipants()
  }

  return (
    <main className="min-h-screen bg-background">
      <RoomHeader room={room} participantCount={participants.length} />

      <div className="max-w-7xl mx-auto p-4 lg:p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <AvailabilityCalendar
              participants={participants}
              currentParticipantId={currentParticipant?.id}
            />
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  내 프로필
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {currentParticipant ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">
                          {currentParticipant.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          현재 로그인
                        </Badge>
                        {currentParticipant.is_host && (
                          <Badge variant="outline" className="text-xs flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3" />
                            호스트
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      왼쪽 달력에서 선택한 날짜는 이 계정 기준으로 저장됩니다.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" />
                      로그아웃
                    </Button>
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    아직 로그인된 참여자가 없습니다. 호스트가 아닌 경우 날짜 입력은 제한될 수 있습니다.
                  </p>
                )}
              </CardContent>
            </Card>

            {currentParticipant && (
              <DateInputForm
                participant={currentParticipant}
                onDateRangeAdded={handleDateRangeAdded}
              />
            )}

            <ParticipantsList
              id="participants-section"
              participants={participants}
              currentParticipantId={currentParticipant?.id}
              currentParticipantIsHost={!!currentParticipant?.is_host}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
