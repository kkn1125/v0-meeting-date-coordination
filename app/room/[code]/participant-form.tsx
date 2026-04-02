"use client"

import { useState } from "react"
import { createClient } from "@/lib/supabase/client"
import type { ParticipantWithDateRanges } from "@/lib/types"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { FieldGroup, Field, FieldLabel } from "@/components/ui/field"
import { UserPlus } from "lucide-react"

interface ParticipantFormProps {
  roomId: string
  onParticipantCreated: (participant: ParticipantWithDateRanges) => void
}

export function ParticipantForm({ roomId, onParticipantCreated }: ParticipantFormProps) {
  const [name, setName] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async () => {
    if (!name.trim()) {
      setError("이름을 입력해주세요.")
      return
    }

    setIsSubmitting(true)
    setError("")

    try {
      const supabase = createClient()
      const trimmedName = name.trim()

      // 1) 글로벌 참가자(사용자) 조회 또는 생성
      const { data: existingUser, error: existingUserError } = await supabase
        .from("participants")
        .select("id,name,password_hash,created_at")
        .eq("name", trimmedName)
        .limit(1)
        .single()

      let participantId: string | null = existingUser?.id ?? null

      if (existingUserError && existingUserError.code !== "PGRST116") {
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

      // 2) room_participants 링크 생성 또는 조회
      const { data: existingLink, error: linkError } = await supabase
        .from("room_participants")
        .select("id,is_host,is_active")
        .eq("room_id", roomId)
        .eq("participant_id", participantId)
        .limit(1)
        .single()

      if (linkError && linkError.code !== "PGRST116") {
        throw linkError
      }

      if (!existingLink) {
        const { error: insertLinkError } = await supabase
          .from("room_participants")
          .insert({
            room_id: roomId,
            participant_id: participantId,
            is_host: false,
            is_active: true,
          })

        if (insertLinkError) throw insertLinkError
      } else if (!existingLink.is_active) {
        // 비활성 상태였다면 다시 활성화
        const { error: restoreError } = await supabase
          .from("room_participants")
          .update({ is_active: true })
          .eq("room_id", roomId)
          .eq("participant_id", participantId)

        if (restoreError) throw restoreError
      }

      // 3) 이 방에서 사용할 ParticipantWithDateRanges 형태 구성 (date_ranges 는 빈 배열로 시작)
      if (!participantId) {
        throw new Error("participantId is missing after upsert")
      }

      const participant: ParticipantWithDateRanges = {
        id: participantId,
        room_id: roomId,
        name: trimmedName,
        password_hash: existingUser?.password_hash ?? null,
        is_host: false,
        deleted_at: null,
        created_at: existingUser?.created_at ?? new Date().toISOString(),
        date_ranges: [],
      }

      onParticipantCreated(participant)
    } catch (err) {
      console.error(err)
      setError("참여에 실패했습니다. 다시 시도해주세요.")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          참여하기
        </CardTitle>
        <CardDescription>
          이름을 입력하고 가능한 날짜를 선택하세요
        </CardDescription>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="participantName">이름</FieldLabel>
            <Input
              id="participantName"
              placeholder="예: 홍길동"
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            />
          </Field>
        </FieldGroup>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
          className="w-full mt-4"
        >
          {isSubmitting ? "참여 중..." : "참여하기"}
        </Button>
        {error && (
          <p className="text-destructive text-sm text-center mt-2">{error}</p>
        )}
      </CardContent>
    </Card>
  )
}
