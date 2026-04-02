"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import type { Room, ParticipantWithDateRanges } from "@/lib/types"
import { getSessionFromStorage, getGlobalSessionFromStorage, clearSessionFromStorage } from "@/lib/auth"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { LogOut, ShieldCheck, User } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
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
  const [isMembershipInactive, setIsMembershipInactive] = useState(false)
  const [isLoginRequired, setIsLoginRequired] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  const fetchParticipants = useCallback(async () => {
    const { data, error } = await supabase
      .from("room_participants")
      .select(
        `
          is_host,
          is_active,
          participant:participants (
            id,
            name,
            password_hash,
            created_at
          )
        `
      )
      .eq("room_id", room.id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error(error)
      return
    }

    if (data) {
      const base = (data ?? [])
        .filter((rp: any) => rp.participant)
        .map((rp: any) => ({
          id: rp.participant.id as string,
          room_id: room.id as string,
          name: rp.participant.name as string,
          password_hash: (rp.participant.password_hash as string) ?? null,
          is_host: Boolean(rp.is_host),
          deleted_at: rp.is_active ? null : new Date().toISOString(),
          created_at: (rp.participant.created_at as string) ?? new Date().toISOString(),
          date_ranges: [] as any[],
        }))

      const participantIds = base.map((p) => p.id)

      if (participantIds.length === 0) {
        setParticipants(base)
        return
      }

      // 이 방에 속한 date_ranges 를 직접 조회
      const { data: ranges, error: rangesError } = await supabase
        .from("date_ranges")
        .select("*")
        .eq("room_id", room.id)
        .in("participant_id", participantIds)

      if (rangesError) {
        console.error(rangesError)
        setParticipants(base)
        return
      }

      const rangesByParticipant = new Map<string, any[]>()
      ;(ranges ?? []).forEach((r: any) => {
        const arr = rangesByParticipant.get(r.participant_id) ?? []
        arr.push(r)
        rangesByParticipant.set(r.participant_id, arr)
      })

      const mapped = base.map((p) => ({
        ...p,
        date_ranges: rangesByParticipant.get(p.id) ?? [],
      }))

      setParticipants(mapped)

      if (currentParticipant) {
        const updated = mapped.find((p) => p.id === currentParticipant.id)
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

      // 멤버십 상태 확인 및 필요 시 자동 참여자 등록
      ;(async () => {
        try {
          const res = await fetch("/api/rooms/membership", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ roomId: room.id, name: globalSession.name }),
          })
          const data = await res.json()
          if (!res.ok) return

          if (data.status === "inactive") {
            // 이 방에서 비활성화된 사용자는 호스트만 복구 가능
            setIsMembershipInactive(true)
            return
          }

          if (data.status === "none") {
            // 아직 이 방의 참여자로 등록되지 않은 글로벌 사용자면 자동으로 참여자로 등록
            try {
              const trimmedName = globalSession.name.trim()
              if (!trimmedName) return

              // 1) 글로벌 참가자(사용자) 조회 또는 생성
              const { data: existingUser, error: existingUserError } = await supabase
                .from("participants")
                .select("id,name,password_hash,created_at")
                .eq("name", trimmedName)
                .limit(1)
                .single()

              let participantId: string | null = existingUser?.id ?? null

              if (existingUserError && (existingUserError as any).code !== "PGRST116") {
                throw existingUserError
              }

              if (!participantId) {
                const { data: newUser, error: insertUserError } = await supabase
                  .from("participants")
                  .insert({ name: trimmedName })
                  .select("id,name,password_hash,created_at")
                  .single()

                if (insertUserError || !newUser) {
                  throw insertUserError
                }

                participantId = newUser.id
              }

              if (!participantId) return

              // 2) room_participants 링크 생성 (이미 있으면 활성화)
              const { data: existingLink, error: linkError } = await supabase
                .from("room_participants")
                .select("id,is_active")
                .eq("room_id", room.id)
                .eq("participant_id", participantId)
                .limit(1)
                .single()

              if (linkError && (linkError as any).code !== "PGRST116") {
                throw linkError
              }

              if (!existingLink) {
                const { error: insertLinkError } = await supabase
                  .from("room_participants")
                  .insert({
                    room_id: room.id,
                    participant_id: participantId,
                    is_host: false,
                    is_active: true,
                  })

                if (insertLinkError) throw insertLinkError
              } else if (!existingLink.is_active) {
                const { error: restoreError } = await supabase
                  .from("room_participants")
                  .update({ is_active: true })
                  .eq("room_id", room.id)
                  .eq("participant_id", participantId)

                if (restoreError) throw restoreError
              }

              // 3) 최신 참여자 목록으로 갱신하고, 본인을 현재 참여자로 선택
              await fetchParticipants()
            } catch (e) {
              console.error("Auto-join error:", e)
            }
          }
        } catch (e) {
          console.error(e)
        }
      })()
      return
    }

    // 방 세션도, 글로벌 세션도 없으면 로그인 필요 안내
    setIsLoginRequired(true)
  }, [room.id, initialParticipants])

  useEffect(() => {
    const participantsChannel = supabase
      .channel("room-participants-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "room_participants",
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
    <>
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
                roomId={room.id}
                currentParticipantId={currentParticipant?.id}
                currentParticipantIsHost={!!currentParticipant?.is_host}
                onParticipantsChange={fetchParticipants}
              />
            </div>
          </div>
        </div>
      </main>

      {/* 비활성 멤버십 안내 모달 */}
      <AlertDialog open={isMembershipInactive}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>입장할 수 없습니다</AlertDialogTitle>
            <AlertDialogDescription>
              해당 모임에서 비활성화 되었습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setIsMembershipInactive(false)
                router.push("/")
              }}
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 로그인 필요 안내 모달 */}
      <AlertDialog open={isLoginRequired}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>로그인이 필요합니다</AlertDialogTitle>
            <AlertDialogDescription>
              이 모임에 참여하려면 먼저 메인 화면에서 이름을 입력해서 로그인해 주세요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction
              onClick={() => {
                setIsLoginRequired(false)
                router.push("/")
              }}
            >
              확인
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
