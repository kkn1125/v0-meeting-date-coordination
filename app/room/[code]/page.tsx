import { notFound } from "next/navigation";
import { RoomClient } from "./room-client";
import type { Metadata } from "next";
import { getRoomByCode, getRoomParticipantsWithDateRanges, getMemosByRoom, getRoomLabels } from "@/lib/db/queries";

import { Suspense } from "react";

interface Props {
  params: Promise<{ code: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { code } = await params;
  const room = await getRoomByCode(code);

  return {
    title: room ? `${room.name} - 모임 날짜 조율` : "모임을 찾을 수 없습니다",
  };
}

export default async function RoomPage({ params }: Props) {
  const { code } = await params;
  const room = await getRoomByCode(code);

  if (!room) {
    notFound();
  }

  const initialParticipants = await getRoomParticipantsWithDateRanges(room.id);
  const initialMemos = await getMemosByRoom(room.id);
  const initialLabels = await getRoomLabels(room.id);

  return (
    <Suspense fallback={null}>
      <RoomClient
        room={room}
        initialParticipants={initialParticipants}
        initialMemos={initialMemos}
        initialLabels={initialLabels}
      />
    </Suspense>
  );
}
