import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { RoomClient } from "./room-client";
import type { Metadata } from "next";
import type { ParticipantWithDateRanges } from "@/lib/types";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const supabase = await createClient();

  const { data: room } = await supabase
    .from("rooms")
    .select()
    .eq("code", code.toUpperCase())
    .single();

  return {
    title: room ? `${room.name} - 모임 날짜 조율` : "모임을 찾을 수 없습니다",
  };
}

export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  const supabase = await createClient();

  const { data: room, error } = await supabase
    .from("rooms")
    .select()
    .eq("code", code.toUpperCase())
    .single();

  if (error || !room) {
    notFound();
  }

  // room_participants 를 기준으로 활성 참여자 + (해당 방의) date_ranges 를 가져온다
  const { data: roomParticipants, error: rpError } = await supabase
    .from("room_participants")
    .select(
      `
        id,
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
    .order("created_at", { ascending: true });

  if (rpError) {
    console.error(rpError);
  }

  let initialParticipants: ParticipantWithDateRanges[] = []

  if (roomParticipants && roomParticipants.length > 0) {
    const baseParticipants: ParticipantWithDateRanges[] =
      roomParticipants
        .filter((rp: any) => rp.participant)
        .map((rp: any) => ({
          id: rp.participant.id as string,
          room_id: room.id as string,
          name: rp.participant.name as string,
          password_hash: (rp.participant.password_hash as string) ?? null,
          is_host: Boolean(rp.is_host),
          deleted_at: rp.is_active ? null : new Date().toISOString(),
          created_at: (rp.participant.created_at as string) ?? new Date().toISOString(),
          date_ranges: [],
        })) ?? []

    const participantIds = baseParticipants.map((p) => p.id)

    if (participantIds.length > 0) {
      // 이 방에 속한 date_ranges 를 직접 조회
      const { data: ranges, error: rangesError } = await supabase
        .from("date_ranges")
        .select("*")
        .eq("room_id", room.id)
        .in("participant_id", participantIds)

      if (rangesError) {
        console.error(rangesError)
        initialParticipants = baseParticipants
      } else {
        const rangesByParticipant = new Map<string, any[]>()
        ;(ranges ?? []).forEach((r: any) => {
          const arr = rangesByParticipant.get(r.participant_id) ?? []
          arr.push(r)
          rangesByParticipant.set(r.participant_id, arr)
        })

        initialParticipants = baseParticipants.map((p) => ({
          ...p,
          date_ranges: rangesByParticipant.get(p.id) ?? [],
        }))
      }
    } else {
      initialParticipants = baseParticipants
    }
  }

  return <RoomClient room={room} initialParticipants={initialParticipants} />;
}
