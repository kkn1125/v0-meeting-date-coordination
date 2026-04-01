"use client"

import { useEffect, useState, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { Room, ParticipantWithDateRanges } from "@/lib/types"
import { RoomHeader } from "./room-header"
import { ParticipantForm } from "./participant-form"
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
        const updated = data.find(p => p.id === currentParticipant.id)
        if (updated) {
          setCurrentParticipant(updated)
        }
      }
    }
  }, [supabase, room.id, currentParticipant])

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

  const handleParticipantCreated = (participant: ParticipantWithDateRanges) => {
    setCurrentParticipant(participant)
    fetchParticipants()
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
            {!currentParticipant ? (
              <ParticipantForm
                roomId={room.id}
                onParticipantCreated={handleParticipantCreated}
              />
            ) : (
              <DateInputForm
                participant={currentParticipant}
                onDateRangeAdded={handleDateRangeAdded}
              />
            )}

            <ParticipantsList
              participants={participants}
              currentParticipantId={currentParticipant?.id}
            />
          </div>
        </div>
      </div>
    </main>
  )
}
