import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { RoomClient } from "./room-client"
import type { Metadata } from "next"

interface Props {
  params: Promise<{ code: string }>
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params
  const supabase = await createClient()

  const { data: room } = await supabase
    .from("rooms")
    .select()
    .eq("code", code.toUpperCase())
    .single()

  return {
    title: room ? `${room.name} - 모임 날짜 조율` : "모임을 찾을 수 없습니다",
  }
}

export default async function RoomPage({ params }: Props) {
  const { code } = await params
  const supabase = await createClient()

  const { data: room, error } = await supabase
    .from("rooms")
    .select()
    .eq("code", code.toUpperCase())
    .single()

  if (error || !room) {
    notFound()
  }

  const { data: participants } = await supabase
    .from("participants")
    .select(`
      *,
      date_ranges (*)
    `)
    .eq("room_id", room.id)
    .order("created_at", { ascending: true })

  return (
    <RoomClient
      room={room}
      initialParticipants={participants || []}
    />
  )
}
