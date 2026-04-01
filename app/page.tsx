"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { CalendarDays, Users, Plus, LogIn } from "lucide-react"
import { createClient } from "@/lib/supabase/client"

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

      router.push(`/room/${data.code}`)
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
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span>로그인 불필요</span>
          </div>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>실시간 업데이트</span>
          </div>
        </div>
      </div>
    </main>
  )
}
