"use client"

import { useEffect, useState, useCallback, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import type { Room, ParticipantWithDateRanges, Memo } from "@/lib/types"
import { getSessionFromStorage, getGlobalSessionFromStorage, clearSessionFromStorage } from "@/lib/auth"
import { useRoomSocket } from "@/hooks/use-room-socket"
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
  initialMemos?: Memo[]
}

export function RoomClient({
  room,
  initialParticipants,
  initialMemos = [],
}: RoomClientProps) {
  const [participants, setParticipants] = useState<ParticipantWithDateRanges[]>(initialParticipants)
  const [memos, setMemos] = useState<Memo[]>(initialMemos)
  const [currentParticipant, setCurrentParticipant] = useState<ParticipantWithDateRanges | null>(null)
  const [isMembershipInactive, setIsMembershipInactive] = useState(false)
  const [isLoginRequired, setIsLoginRequired] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()

  const initialDateRangeId = searchParams?.get("dateRangeId") ?? undefined
  const initialMemoId = searchParams?.get("memoId") ?? undefined

  const applyParticipantsUpdate = useCallback(
    (mapped: ParticipantWithDateRanges[]) => {
      setParticipants(mapped)
      setCurrentParticipant((prev) => {
        if (!prev) return prev
        return mapped.find((p) => p.id === prev.id) ?? prev
      })
    },
    []
  )

  const applyMemosUpdate = useCallback((updatedMemos: Memo[], dateRangeId?: string) => {
    if (dateRangeId) {
      setMemos((prev) => {
        const others = prev.filter((m) => m.date_range_id !== dateRangeId)
        const filtered = updatedMemos.filter((m) => m.date_range_id === dateRangeId)
        return [...others, ...filtered]
      })
    } else {
      setMemos(updatedMemos)
    }
  }, [])

  useRoomSocket(room.id, applyParticipantsUpdate, applyMemosUpdate)

  useEffect(() => {
    const loadMemos = async () => {
      try {
        const res = await fetch(`/api/rooms/${room.id}/memos`)
        const data = await res.json()
        if (res.ok) setMemos(data.memos ?? [])
      } catch (error) {
        console.error(error)
      }
    }
    void loadMemos()
  }, [room.id])

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
            setIsMembershipInactive(true)
            return
          }

          if (data.status === "none") {
            try {
              const joinRes = await fetch(`/api/rooms/${room.id}/join`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: globalSession.name.trim() }),
              })
              if (!joinRes.ok) throw new Error("Auto-join failed")
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

    setIsLoginRequired(true)
  }, [room.id, initialParticipants])

  const handleLogout = () => {
    clearSessionFromStorage(room.id)
    setCurrentParticipant(null)
  }

  const mentionedRangeIds = useMemo(() => {
    if (!currentParticipant) return new Set<string>()
    const ids = new Set<string>()
    memos.forEach((memo) => {
      const mentioned = (memo.mentions ?? []).some(
        (m) => m.mentioned_participant_id === currentParticipant.id
      )
      if (mentioned) ids.add(memo.date_range_id)
    })
    return ids
  }, [memos, currentParticipant])

  return (
    <>
      <main className="min-h-screen bg-background">
        <RoomHeader room={room} participantCount={participants.length} />

        <div className="max-w-7xl mx-auto p-4 lg:p-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <AvailabilityCalendar
                roomId={room.id}
                participants={participants}
                memos={memos}
                currentParticipantId={currentParticipant?.id}
                currentParticipantIsHost={!!currentParticipant?.is_host}
                mentionedRangeIds={mentionedRangeIds}
                initialDateRangeId={initialDateRangeId}
                initialMemoId={initialMemoId}
                onMemosChange={setMemos}
                onLoginRequired={() => setIsLoginRequired(true)}
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
                <DateInputForm participant={currentParticipant} />
              )}

              <ParticipantsList
                id="participants-section"
                participants={participants}
                roomId={room.id}
                currentParticipantId={currentParticipant?.id}
                currentParticipantIsHost={!!currentParticipant?.is_host}
              />
            </div>
          </div>
        </div>
      </main>

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
