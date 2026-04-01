"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { CalendarDays, Users, Plus, LogIn, UserPlus, Hash } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { setSessionToStorage } from "@/lib/auth"
import type { SessionPayload } from "@/lib/types"

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let code = ""
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return code
}

export default function HomePage() {
  const router = useRouter()
  const [roomName, setRoomName] = useState("")
  const [joinCode, setJoinCode] = useState("")
  const [isCreating, setIsCreating] = useState(false)
  const [isJoining, setIsJoining] = useState(false)
  const [error, setError] = useState("")
  const [roomCount, setRoomCount] = useState<number | null>(null)

  // Auth modal states
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [authMode, setAuthMode] = useState<"signup" | "login">("signup")
  const [authName, setAuthName] = useState("")
  const [authPassword, setAuthPassword] = useState("")
  const [authConfirmPassword, setAuthConfirmPassword] = useState("")
  const [authError, setAuthError] = useState("")
  const [isAuthSubmitting, setIsAuthSubmitting] = useState(false)
  const [pendingRoomData, setPendingRoomData] = useState<{ code: string; id: string } | null>(null)

  useEffect(() => {
    fetch("/api/rooms/count")
      .then((res) => res.json())
      .then((data) => setRoomCount(data.count))
      .catch(console.error)
  }, [])

  const handleCreateRoom = async () => {
    if (!roomName.trim()) {
      setError("모임 이름을 입력해주세요.")
      return
    }

    setIsCreating(true)
    setError("")

    try {
      const supabase = createClient()
      const code = generateRoomCode()

      const { data, error: insertError } = await supabase
        .from("rooms")
        .insert({ name: roomName.trim(), code })
        .select()
        .single()

      if (insertError) throw insertError

      // Save room data and show auth modal
      setPendingRoomData({ code: data.code, id: data.id })
      setShowAuthModal(true)
      setAuthMode("signup")
    } catch (err) {
      console.error(err)
      setError("모임 생성에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsCreating(false)
    }
  }

  const handleJoinRoom = async () => {
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
        // Get password hash from server
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

        if (pendingRoomData) {
          // Create participant as host for new room
          const supabase = createClient()

          const { data: participant, error: participantError } = await supabase
            .from("participants")
            .insert({
              room_id: pendingRoomData.id,
              name: authName.trim(),
              password_hash: signupData.passwordHash,
              is_host: true,
            })
            .select()
            .single()

          if (participantError) throw participantError

          // Update room with creator
          await supabase
            .from("rooms")
            .update({ creator_participant_id: participant.id })
            .eq("id", pendingRoomData.id)

          // Create session
          const session: SessionPayload = {
            participantId: participant.id,
            roomId: pendingRoomData.id,
            name: participant.name,
            isHost: true,
            expiresAt: Date.now() + 30 * 60 * 1000,
          }
          setSessionToStorage(session)

          router.push(`/room/${pendingRoomData.code}`)
        }
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
    setPendingRoomData(null)
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
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
                  disabled={isCreating}
                  className="w-full mt-4"
                >
                  {isCreating ? "생성 중..." : "모임 만들기"}
                </Button>
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
                  disabled={isJoining}
                  className="w-full mt-4"
                >
                  {isJoining ? "참여 중..." : "모임 참여하기"}
                </Button>
              </TabsContent>
            </Tabs>

            {error && (
              <p className="text-destructive text-sm text-center mt-4">{error}</p>
            )}
          </CardContent>
        </Card>

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

      {/* Auth Modal for Room Creation */}
      <Dialog open={showAuthModal} onOpenChange={(open) => !open && resetAuthModal()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              방장 계정 생성
            </DialogTitle>
            <DialogDescription>
              모임 생성을 위해 계정을 만들어주세요. 방장 권한이 부여됩니다.
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
            </FieldGroup>
            {authError && (
              <p className="text-destructive text-sm">{authError}</p>
            )}
            <Button
              onClick={handleAuthSubmit}
              disabled={isAuthSubmitting}
              className="w-full"
            >
              {isAuthSubmitting ? "처리 중..." : "계정 생성 및 모임 입장"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </main>
  )
}
