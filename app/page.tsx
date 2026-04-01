"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { CalendarDays, Users, Plus, LogIn, UserPlus, Hash, LogOut, DoorOpen } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import {
  getGlobalSessionFromStorage,
  setGlobalSessionToStorage,
  clearGlobalSessionFromStorage,
} from "@/lib/auth"
import type { GlobalSessionPayload } from "@/lib/types"

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

interface JoinedRoom {
  id: string
  name: string
  code: string
  createdAt: string
  isHost: boolean
}

export default function HomePage() {
  const router = useRouter()
  const [roomName, setRoomName] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState("")
  const [roomCount, setRoomCount] = useState<number | null>(null)

  const [globalSession, setGlobalSession] = useState<GlobalSessionPayload | null>(null)
  const [joinedRooms, setJoinedRooms] = useState<JoinedRoom[]>([])
  const [isLoadingJoinedRooms, setIsLoadingJoinedRooms] = useState(false)

  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup")
  const [authName, setAuthName] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authConfirmPassword, setAuthConfirmPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)

  useEffect(() => {
    fetch("/api/rooms/count")
      .then((res) => res.json())
      .then((data) => setRoomCount(data.count))
      .catch(console.error)
  }, [])

  useEffect(() => {
    const session = getGlobalSessionFromStorage()
    if (session) {
      setGlobalSession(session)
      void loadJoinedRooms(session.name)
    }
  }, [])

  const loadJoinedRooms = async (name: string) => {
    setIsLoadingJoinedRooms(true)
    try {
      const res = await fetch("/api/rooms/by-user", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error(data.error || "참여한 모임을 불러오지 못했습니다.")
        setJoinedRooms([])
        return
      }
      setJoinedRooms(data.rooms || [])
    } catch (e) {
      console.error(e)
      setJoinedRooms([])
    } finally {
      setIsLoadingJoinedRooms(false)
    }
  }

  const requireLogin = () => {
    if (!globalSession) {
      setError("로그인 후 이용하실 수 있습니다.")
      setAuthMode("login")
      setShowAuthModal(true)
      return false
    }
    return true
  }

  const handleCreateRoom = async () => {
    if (!requireLogin()) return

    if (!roomName.trim()) {
      setError("모임 이름을 입력해주세요.")
      return
    }

    setIsCreating(true)
    setError("")

    try {
      const supabase = createClient()
      const code = generateRoomCode()

      const { data: room, error: insertError } = await supabase
        .from("rooms")
        .insert({ name: roomName.trim(), code })
        .select()
        .single()

      if (insertError || !room) throw insertError

      if (globalSession) {
        const { data: host, error: participantError } = await supabase
          .from("participants")
          .insert({
            room_id: room.id,
            name: globalSession.name,
            is_host: true,
          })
          .select("id")
          .single()

        if (participantError) {
          console.error(participantError)
        } else if (host) {
          await supabase
            .from("rooms")
            .update({ creator_participant_id: host.id })
            .eq("id", room.id)
        }
      }

      router.push(`/room/${room.code}`)
    } catch (err) {
      console.error(err)
      setError("모임 생성에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinRoom = async () => {
    if (!requireLogin()) return

    if (!joinCode.trim()) {
      setError("참여 코드를 입력해주세요.")
      return
    }

    setIsJoining(true)
    setError("")

    try {
      const supabase = createClient()
      const { data, error: fetchError } = await supabase
        .from("rooms")
        .select()
        .eq("code", joinCode.trim().toUpperCase())
        .single()

      if (fetchError || !data) {
        setError("존재하지 않는 모임입니다. 코드를 확인해주세요.")
        return
      }

      router.push(`/room/${data.code}`)
    } catch (err) {
      console.error(err)
      setError("모임 참여에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsJoining(false)
    }
  }

  const handleAuthSubmit = async () => {
    if (!authName.trim() || !authPassword.trim()) {
      setAuthError("이름과 비밀번호를 입력해주세요.")
      return
    }

    if (authPassword.length < 4) {
      setAuthError("비밀번호는 4자 이상이어야 합니다.")
      return
    }

    if (authMode === "signup" && authPassword !== authConfirmPassword) {
      setAuthError("비밀번호가 일치하지 않습니다.")
      return
    }

    setIsAuthSubmitting(true)
    setAuthError("")

    try {
      if (authMode === "signup") {
        const signupRes = await fetch("/api/auth/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: authName.trim(), password: authPassword }),
        })

        const signupData = await signupRes.json()

        if (!signupRes.ok) {
          setAuthError(signupData.error || "회원가입에 실패했습니다.")
          return
        }

        const session: GlobalSessionPayload = {
          name: signupData.name ?? authName.trim(),
          expiresAt: Date.now() + 30 * 60 * 1000,
        }
        setGlobalSession(session)
        setGlobalSessionToStorage(session)
        void loadJoinedRooms(session.name)
        resetAuthModal()
      } else {
        const loginRes = await fetch("/api/auth/global-login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: authName.trim(), password: authPassword }),
        })

        const loginData = await loginRes.json()

        if (!loginRes.ok) {
          setAuthError(loginData.error || "로그인에 실패했습니다.")
          return
        }

        const session = loginData.session as GlobalSessionPayload
        setGlobalSession(session)
        setGlobalSessionToStorage(session)
        void loadJoinedRooms(session.name)
        resetAuthModal()
      }
    } catch (err) {
      console.error(err)
      setAuthError("처리에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsAuthSubmitting(false)
    }
  }

  const resetAuthModal = () => {
    setShowAuthModal(false)
    setAuthName("")
    setAuthPassword("")
    setAuthConfirmPassword("")
    setAuthError("")
  }

  const handleLogout = () => {
    clearGlobalSessionFromStorage()
    setGlobalSession(null)
    setJoinedRooms([])
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="mb-4 flex items-center justify-between">
          {globalSession ? (
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">안녕하세요,</span>
              <span className="font-medium">{globalSession.name}</span>
              <Badge variant="outline" className="text-[10px]">
                로그인됨
              </Badge>
            </div>
          ) : (
            <div className="text-xs text-muted-foreground">
              모임 생성·참여를 위해 먼저 로그인해주세요.
            </div>
          )}
          <div className="flex items-center gap-2">
            {globalSession ? (
              <Button
                size="sm"
                variant="outline"
                className="h-8 px-3 gap-1"
                onClick={handleLogout}
              >
                <LogOut className="h-3 w-3" />
                로그아웃
              </Button>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 gap-1"
                  onClick={() => {
                    setAuthMode("login")
                    setShowAuthModal(true)
                  }}
                >
                  <LogIn className="h-3 w-3" />
                  로그인
                </Button>
                <Button
                  size="sm"
                  className="h-8 px-3 gap-1"
                  onClick={() => {
                    setAuthMode("signup")
                    setShowAuthModal(true)
                  }}
                >
                  <UserPlus className="h-3 w-3" />
                  회원가입
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="text-center mb-6">
          <div className="flex justify-center mb-4">
            <div className="p-3 rounded-full bg-primary/10">
              <CalendarDays className="h-10 w-10 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-foreground text-balance">모임 날짜 조율</h1>
          <p className="text-muted-foreground mt-2 text-balance">
            참석자들의 가능한 날짜를 한눈에 확인하세요
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="sr-only">모임 생성 또는 참여</CardTitle>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create" className="gap-2">
                  <Plus className="h-4 w-4" />
                  새 모임 만들기
                </TabsTrigger>
                <TabsTrigger value="join" className="gap-2">
                  <LogIn className="h-4 w-4" />
                  참여하기
                </TabsTrigger>
              </TabsList>

              <TabsContent value="create" className="mt-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="roomName">모임 이름</FieldLabel>
                    <Input
                      id="roomName"
                      placeholder="예: 동창회 모임"
                      value={roomName}
                      onChange={(e) => setRoomName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateRoom()}
                    />
                  </Field>
                </FieldGroup>
                <Button
                  onClick={handleCreateRoom}
                  disabled={isCreating || !globalSession}
                  className="w-full mt-4"
                >
                  {isCreating ? "생성 중..." : "모임 만들기"}
                </Button>
                {!globalSession && (
                  <p className="mt-2 text-xs text-muted-foreground text-center">
                    로그인 후 모임을 만들 수 있습니다.
                  </p>
                )}
              </TabsContent>

              <TabsContent value="join" className="mt-6">
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="joinCode">참여 코드</FieldLabel>
                    <Input
                      id="joinCode"
                      placeholder="예: ABC123"
                      value={joinCode}
                      onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                      onKeyDown={(e) => e.key === "Enter" && handleJoinRoom()}
                      maxLength={6}
                      className="uppercase tracking-widest text-center font-mono"
                    />
                  </Field>
                </FieldGroup>
                <Button
                  onClick={handleJoinRoom}
                  disabled={isJoining || !globalSession}
                  className="w-full mt-4"
                >
                  {isJoining ? "참여 중..." : "모임 참여하기"}
                </Button>
                {!globalSession && (
                  <p className="mt-2 text-xs text-muted-foreground text-center">
                    로그인 후 모임에 참여할 수 있습니다.
                  </p>
                )}
              </TabsContent>
            </Tabs>

            {error && (
              <p className="text-destructive text-sm text-center mt-4">{error}</p>
            )}
          </CardContent>
        </Card>

        {globalSession && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm">
                <DoorOpen className="h-4 w-4" />
                내 모임
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingJoinedRooms ? (
                <p className="text-xs text-muted-foreground">불러오는 중...</p>
              ) : joinedRooms.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  아직 참여한 모임이 없습니다.
                </p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {joinedRooms.map((room) => (
                    <li
                      key={room.id}
                      className="flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium truncate">
                            {room.name}
                          </span>
                          {room.isHost && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              방장
                            </Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground">
                          코드: {room.code}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-8 px-3 text-xs gap-1"
                        onClick={() => router.push(`/room/${room.code}`)}
                      >
                        <DoorOpen className="h-3 w-3" />
                        입장
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        )}

        <div className="mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
          {roomCount !== null && (
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4" />
              <span>총 {roomCount}개 모임</span>
            </div>
          )}
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>간편 회원가입</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>실시간 업데이트</span>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <Dialog open={showAuthModal} onOpenChange={(open) => !open && resetAuthModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {authMode === "signup" ? (
                <>
                  <UserPlus className="h-5 w-5" />
                  회원가입
                </>
              ) : (
                <>
                  <LogIn className="h-5 w-5" />
                  로그인
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              이름과 비밀번호로 간단히 계정을 만들어 여러 모임에 참여할 수 있습니다.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="authName">이름</FieldLabel>
                <Input
                  id="authName"
                  placeholder="예: 홍길동"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="authPassword">비밀번호</FieldLabel>
                <Input
                  id="authPassword"
                  type="password"
                  placeholder="4자 이상"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                />
              </Field>
              {authMode === "signup" && (
                <Field>
                  <FieldLabel htmlFor="authConfirmPassword">비밀번호 확인</FieldLabel>
                  <Input
                    id="authConfirmPassword"
                    type="password"
                    placeholder="비밀번호 재입력"
                    value={authConfirmPassword}
                    onChange={(e) => setAuthConfirmPassword(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleAuthSubmit()}
                  />
                </Field>
              )}
            </FieldGroup>
            {authError && (
              <p className="text-destructive text-sm">{authError}</p>
            )}
            <Button
              onClick={handleAuthSubmit}
              disabled={isAuthSubmitting}
              className="w-full"
            >
              {isAuthSubmitting
                ? "처리 중..."
                : authMode === "signup"
                  ? "회원가입"
                  : "로그인"}
            </Button>
            <p className="text-[11px] text-muted-foreground">
              이미 계정이 있으신가요?{" "}
              <button
                type="button"
                className="underline underline-offset-2"
                onClick={() =>
                  setAuthMode((prev) => (prev === "signup" ? "login" : "signup"))
                }
              >
                {authMode === "signup" ? "로그인하기" : "회원가입하기"}
              </button>
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
