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

      // Check if participant with same name already exists in this room
      const { data: existingParticipant, error: selectError } = await supabase
        .from("participants")
        .select(`
          *,
          date_ranges (*)
        `)
        .eq("room_id", roomId)
        .eq("name", trimmedName)
        .single()

      if (selectError && selectError.code !== "PGRST116") {
        // PGRST116 = no rows returned, which is expected if participant doesn't exist
        throw selectError
      }

      if (existingParticipant) {
        // Use existing participant
        onParticipantCreated(existingParticipant)
        return
      }

      // Create new participant if not found
      const { data, error: insertError } = await supabase
        .from("participants")
        .insert({ room_id: roomId, name: trimmedName })
        .select(`
          *,
          date_ranges (*)
        `)
        .single()

      if (insertError) throw insertError

      onParticipantCreated(data)
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
