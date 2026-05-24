import sql from "@/lib/db"
import { toISODateString, toISOStringValue } from "@/lib/dates"
import type {
  DateRange,
  InboxNotification,
  Memo,
  MemoMention,
  ParticipantWithDateRanges,
  Room,
  RoomLabel,
} from "@/lib/types"

export async function getRoomByCode(code: string): Promise<Room | null> {
  const rows = await sql<Room[]>`
    SELECT id, name, code, creator_participant_id, created_at
    FROM rooms
    WHERE code = ${code.toUpperCase()}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function getRoomCount(): Promise<number> {
  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count FROM rooms
  `
  return Number(rows[0]?.count ?? 0)
}

export async function createRoom(name: string, code: string): Promise<Room> {
  const rows = await sql<Room[]>`
    INSERT INTO rooms (name, code)
    VALUES (${name}, ${code})
    RETURNING id, name, code, creator_participant_id, created_at
  `
  return rows[0]
}

export async function updateRoomCreator(
  roomId: string,
  participantId: string
): Promise<void> {
  await sql`
    UPDATE rooms
    SET creator_participant_id = ${participantId}
    WHERE id = ${roomId}
  `
}

export async function findParticipantByName(name: string) {
  const rows = await sql<
    {
      id: string
      name: string
      password_hash: string | null
      created_at: string
    }[]
  >`
    SELECT id, name, password_hash, created_at
    FROM participants
    WHERE name = ${name}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function findParticipantByNameWithPassword(name: string) {
  const rows = await sql<
    {
      id: string
      name: string
      password_hash: string | null
      created_at: string
    }[]
  >`
    SELECT id, name, password_hash, created_at
    FROM participants
    WHERE name = ${name}
      AND password_hash IS NOT NULL
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function findParticipantById(id: string) {
  const rows = await sql<
    {
      id: string
      name: string
      password_hash: string | null
      created_at: string
    }[]
  >`
    SELECT id, name, password_hash, created_at
    FROM participants
    WHERE id = ${id}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function createParticipant(name: string, passwordHash?: string) {
  const rows = await sql<
    {
      id: string
      name: string
      password_hash: string | null
      created_at: string
    }[]
  >`
    INSERT INTO participants (name, password_hash)
    VALUES (${name}, ${passwordHash ?? null})
    RETURNING id, name, password_hash, created_at
  `
  return rows[0]
}

export async function getRoomParticipantLink(
  roomId: string,
  participantId: string
) {
  const rows = await sql<
    { id: string; is_host: boolean; is_active: boolean }[]
  >`
    SELECT id, is_host, is_active
    FROM room_participants
    WHERE room_id = ${roomId}
      AND participant_id = ${participantId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function createRoomParticipantLink(
  roomId: string,
  participantId: string,
  isHost: boolean
) {
  await sql`
    INSERT INTO room_participants (room_id, participant_id, is_host, is_active)
    VALUES (${roomId}, ${participantId}, ${isHost}, true)
  `
}

export async function activateRoomParticipant(
  roomId: string,
  participantId: string
) {
  await sql`
    UPDATE room_participants
    SET is_active = true, updated_at = NOW()
    WHERE room_id = ${roomId}
      AND participant_id = ${participantId}
  `
}

export async function setRoomParticipantActive(
  roomId: string,
  participantId: string,
  isActive: boolean
) {
  await sql`
    UPDATE room_participants
    SET is_active = ${isActive}, updated_at = NOW()
    WHERE room_id = ${roomId}
      AND participant_id = ${participantId}
  `
}

export async function getRoomParticipantsWithDateRanges(
  roomId: string
): Promise<ParticipantWithDateRanges[]> {
  const roomParticipants = await sql<
    {
      is_host: boolean
      is_active: boolean
      participant_id: string
      name: string
      password_hash: string | null
      created_at: string
    }[]
  >`
    SELECT
      rp.is_host,
      rp.is_active,
      p.id AS participant_id,
      p.name,
      p.password_hash,
      p.created_at
    FROM room_participants rp
    JOIN participants p ON p.id = rp.participant_id
    WHERE rp.room_id = ${roomId}
    ORDER BY rp.created_at ASC
  `

  if (roomParticipants.length === 0) {
    return []
  }

  const participantIds = roomParticipants.map((rp) => rp.participant_id)

  const dateRanges = await sql<DateRange[]>`
    SELECT
      id,
      participant_id,
      room_id,
      start_date::text AS start_date,
      end_date::text AS end_date,
      is_available,
      label_id,
      created_at
    FROM date_ranges
    WHERE room_id = ${roomId}
      AND participant_id = ANY(${participantIds})
  `

  const rangesByParticipant = new Map<string, DateRange[]>()
  for (const range of dateRanges) {
    const arr = rangesByParticipant.get(range.participant_id) ?? []
    arr.push({
      ...range,
      start_date: toISODateString(range.start_date),
      end_date: toISODateString(range.end_date),
    })
    rangesByParticipant.set(range.participant_id, arr)
  }

  return roomParticipants.map((rp) => ({
    id: rp.participant_id,
    room_id: roomId,
    name: rp.name,
    password_hash: rp.password_hash,
    is_host: rp.is_host,
    deleted_at: rp.is_active ? null : new Date().toISOString(),
    created_at: rp.created_at,
    date_ranges: rangesByParticipant.get(rp.participant_id) ?? [],
  }))
}

export async function getMembershipStatus(roomId: string, name: string) {
  const participant = await findParticipantByName(name)
  if (!participant) {
    return "none" as const
  }

  const link = await getRoomParticipantLink(roomId, participant.id)
  if (!link) {
    return "none" as const
  }

  if (!link.is_active) {
    return "inactive" as const
  }

  return "active" as const
}

export async function getRoomsByParticipantName(name: string) {
  const participant = await findParticipantByName(name)
  if (!participant) {
    return []
  }

  const rpRows = await sql<
    { room_id: string; is_host: boolean; is_active: boolean }[]
  >`
    SELECT room_id, is_host, is_active
    FROM room_participants
    WHERE participant_id = ${participant.id}
  `

  if (rpRows.length === 0) {
    return []
  }

  const roomIds = [...new Set(rpRows.map((rp) => rp.room_id))]

  const rooms = await sql<
    { id: string; name: string; code: string; created_at: string }[]
  >`
    SELECT id, name, code, created_at
    FROM rooms
    WHERE id = ANY(${roomIds})
    ORDER BY created_at DESC
  `

  return rooms.map((room) => ({
    id: room.id,
    name: room.name,
    code: room.code,
    createdAt: room.created_at,
    isHost: rpRows.some((rp) => rp.room_id === room.id && rp.is_host),
  }))
}

export async function insertDateRange(data: {
  participantId: string
  roomId: string
  startDate: string
  endDate: string
  isAvailable: boolean
  labelId?: string | null
}) {
  await sql`
    INSERT INTO date_ranges (
      participant_id,
      room_id,
      start_date,
      end_date,
      is_available,
      label_id
    )
    VALUES (
      ${data.participantId},
      ${data.roomId},
      ${data.startDate}::date,
      ${data.endDate}::date,
      ${data.isAvailable},
      ${data.labelId ?? null}
    )
  `
}

export async function deleteDateRange(id: string): Promise<string | null> {
  const rows = await sql<{ room_id: string }[]>`
    DELETE FROM date_ranges
    WHERE id = ${id}
    RETURNING room_id
  `
  return rows[0]?.room_id ?? null
}

export async function joinRoom(
  roomId: string,
  name: string
): Promise<ParticipantWithDateRanges> {
  let participant = await findParticipantByName(name)

  if (!participant) {
    participant = await createParticipant(name)
  }

  const link = await getRoomParticipantLink(roomId, participant.id)

  if (!link) {
    await createRoomParticipantLink(roomId, participant.id, false)
  } else if (!link.is_active) {
    await activateRoomParticipant(roomId, participant.id)
  }

  return {
    id: participant.id,
    room_id: roomId,
    name: participant.name,
    password_hash: participant.password_hash,
    is_host: link?.is_host ?? false,
    deleted_at: null,
    created_at: participant.created_at,
    date_ranges: [],
  }
}

export async function verifyRoomMembership(
  roomId: string,
  participantId: string
): Promise<{ isHost: boolean } | null> {
  const link = await getRoomParticipantLink(roomId, participantId)
  if (!link || !link.is_active) return null
  return { isHost: link.is_host }
}

export async function getActiveRoomParticipantIds(
  roomId: string
): Promise<string[]> {
  const rows = await sql<{ participant_id: string }[]>`
    SELECT participant_id
    FROM room_participants
    WHERE room_id = ${roomId}
      AND is_active = true
  `
  return rows.map((r) => r.participant_id)
}

export async function getActiveRoomIdsForParticipant(
  participantId: string
): Promise<string[]> {
  const rows = await sql<{ room_id: string }[]>`
    SELECT room_id
    FROM room_participants
    WHERE participant_id = ${participantId}
      AND is_active = true
  `
  return rows.map((r) => r.room_id)
}

export async function verifyDateRangeInRoom(
  roomId: string,
  dateRangeId: string
): Promise<DateRange | null> {
  const rows = await sql<DateRange[]>`
    SELECT
      id,
      participant_id,
      room_id,
      start_date::text AS start_date,
      end_date::text AS end_date,
      is_available,
      label_id,
      created_at
    FROM date_ranges
    WHERE id = ${dateRangeId}
      AND room_id = ${roomId}
    LIMIT 1
  `
  const range = rows[0]
  if (!range) return null
  return {
    ...range,
    start_date: toISODateString(range.start_date),
    end_date: toISODateString(range.end_date),
  }
}

export async function getRoomLabels(roomId: string): Promise<RoomLabel[]> {
  const rows = await sql<
    (RoomLabel & { date_range_count: string })[]
  >`
    SELECT
      rl.id,
      rl.room_id,
      rl.name,
      rl.is_valid,
      rl.created_by_participant_id,
      rl.created_at,
      rl.updated_at,
      p.name AS created_by_name,
      COUNT(dr.id)::text AS date_range_count
    FROM room_labels rl
    JOIN participants p ON p.id = rl.created_by_participant_id
    LEFT JOIN date_ranges dr ON dr.label_id = rl.id
    WHERE rl.room_id = ${roomId}
    GROUP BY rl.id, p.name
    ORDER BY rl.created_at ASC
  `
  return rows.map((row) => ({
    id: row.id,
    room_id: row.room_id,
    name: row.name,
    is_valid: row.is_valid,
    created_by_participant_id: row.created_by_participant_id,
    created_at: toISOStringValue(row.created_at),
    updated_at: toISOStringValue(row.updated_at),
    created_by_name: row.created_by_name,
    date_range_count: Number(row.date_range_count),
  }))
}

export async function verifyValidLabelInRoom(
  roomId: string,
  labelId: string
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    SELECT id
    FROM room_labels
    WHERE id = ${labelId}
      AND room_id = ${roomId}
      AND is_valid = true
    LIMIT 1
  `
  return rows.length > 0
}

export async function getRoomLabelById(
  roomId: string,
  labelId: string
): Promise<RoomLabel | null> {
  const rows = await sql<RoomLabel[]>`
    SELECT
      id,
      room_id,
      name,
      is_valid,
      created_by_participant_id,
      created_at,
      updated_at
    FROM room_labels
    WHERE id = ${labelId}
      AND room_id = ${roomId}
    LIMIT 1
  `
  return rows[0] ?? null
}

export async function createRoomLabel(data: {
  roomId: string
  participantId: string
  name: string
}): Promise<RoomLabel> {
  const rows = await sql<RoomLabel[]>`
    INSERT INTO room_labels (room_id, name, created_by_participant_id)
    VALUES (${data.roomId}, ${data.name.trim()}, ${data.participantId})
    RETURNING
      id,
      room_id,
      name,
      is_valid,
      created_by_participant_id,
      created_at,
      updated_at
  `
  const row = rows[0]
  return {
    ...row,
    created_at: toISOStringValue(row.created_at),
    updated_at: toISOStringValue(row.updated_at),
    date_range_count: 0,
  }
}

export async function updateRoomLabel(data: {
  roomId: string
  labelId: string
  name?: string
  isValid?: boolean
}): Promise<RoomLabel | null> {
  const existing = await getRoomLabelById(data.roomId, data.labelId)
  if (!existing) return null

  const name = data.name !== undefined ? data.name.trim() : existing.name
  const isValid = data.isValid !== undefined ? data.isValid : existing.is_valid

  const rows = await sql<RoomLabel[]>`
    UPDATE room_labels
    SET name = ${name}, is_valid = ${isValid}, updated_at = NOW()
    WHERE id = ${data.labelId}
      AND room_id = ${data.roomId}
    RETURNING
      id,
      room_id,
      name,
      is_valid,
      created_by_participant_id,
      created_at,
      updated_at
  `
  const row = rows[0]
  if (!row) return null
  return {
    ...row,
    created_at: toISOStringValue(row.created_at),
    updated_at: toISOStringValue(row.updated_at),
  }
}

export async function deleteRoomLabel(data: {
  roomId: string
  labelId: string
  participantId: string
}): Promise<boolean> {
  const membership = await verifyRoomMembership(data.roomId, data.participantId)
  if (!membership) throw new Error("FORBIDDEN")

  const existing = await getRoomLabelById(data.roomId, data.labelId)
  if (!existing) return false

  const isAuthor = existing.created_by_participant_id === data.participantId
  if (!isAuthor && !membership.isHost) throw new Error("FORBIDDEN")

  const rows = await sql<{ id: string }[]>`
    DELETE FROM room_labels
    WHERE id = ${data.labelId}
      AND room_id = ${data.roomId}
    RETURNING id
  `
  return rows.length > 0
}

export async function updateDateRangeLabel(data: {
  roomId: string
  dateRangeId: string
  participantId: string
  labelId: string | null
}): Promise<DateRange | null> {
  const membership = await verifyRoomMembership(data.roomId, data.participantId)
  if (!membership) throw new Error("FORBIDDEN")

  const existing = await verifyDateRangeInRoom(data.roomId, data.dateRangeId)
  if (!existing) return null

  if (existing.label_id) {
    const currentLabel = await getRoomLabelById(data.roomId, existing.label_id)
    if (currentLabel && !currentLabel.is_valid) {
      throw new Error("LABEL_LOCKED")
    }
  }

  if (data.labelId !== null) {
    const valid = await verifyValidLabelInRoom(data.roomId, data.labelId)
    if (!valid) throw new Error("INVALID_LABEL")
  }

  const rows = await sql<DateRange[]>`
    UPDATE date_ranges
    SET label_id = ${data.labelId}
    WHERE id = ${data.dateRangeId}
      AND room_id = ${data.roomId}
    RETURNING
      id,
      participant_id,
      room_id,
      start_date::text AS start_date,
      end_date::text AS end_date,
      is_available,
      label_id,
      created_at
  `
  const range = rows[0]
  if (!range) return null
  return {
    ...range,
    start_date: toISODateString(range.start_date),
    end_date: toISODateString(range.end_date),
  }
}

async function fetchMemoMentions(memoIds: string[]): Promise<Map<string, MemoMention[]>> {
  if (memoIds.length === 0) return new Map()

  const rows = await sql<
    {
      id: string
      memo_id: string
      mentioned_participant_id: string
      mentioned_name: string
      created_at: string
    }[]
  >`
    SELECT
      mm.id,
      mm.memo_id,
      mm.mentioned_participant_id,
      p.name AS mentioned_name,
      mm.created_at
    FROM memo_mentions mm
    JOIN participants p ON p.id = mm.mentioned_participant_id
    WHERE mm.memo_id = ANY(${memoIds})
    ORDER BY mm.created_at ASC
  `

  const map = new Map<string, MemoMention[]>()
  for (const row of rows) {
    const arr = map.get(row.memo_id) ?? []
    arr.push({
      id: row.id,
      memo_id: row.memo_id,
      mentioned_participant_id: row.mentioned_participant_id,
      mentioned_name: row.mentioned_name,
      created_at: row.created_at,
    })
    map.set(row.memo_id, arr)
  }
  return map
}

export async function getMemosByRoom(
  roomId: string,
  dateRangeId?: string
): Promise<Memo[]> {
  const rows = dateRangeId
    ? await sql<
        {
          id: string
          room_id: string
          date_range_id: string
          author_participant_id: string
          content: string
          created_at: string
          updated_at: string
          author_name: string
        }[]
      >`
        SELECT
          m.id,
          m.room_id,
          m.date_range_id,
          m.author_participant_id AS author_participant_id,
          m.content,
          m.created_at,
          m.updated_at,
          p.name AS author_name
        FROM memos m
        JOIN participants p ON p.id = m.author_participant_id
        WHERE m.room_id = ${roomId}
          AND m.date_range_id = ${dateRangeId}
        ORDER BY m.created_at ASC
      `
    : await sql<
        {
          id: string
          room_id: string
          date_range_id: string
          author_participant_id: string
          content: string
          created_at: string
          updated_at: string
          author_name: string
        }[]
      >`
        SELECT
          m.id,
          m.room_id,
          m.date_range_id,
          m.author_participant_id,
          m.content,
          m.created_at,
          m.updated_at,
          p.name AS author_name
        FROM memos m
        JOIN participants p ON p.id = m.author_participant_id
        WHERE m.room_id = ${roomId}
        ORDER BY m.created_at ASC
      `

  const memoIds = rows.map((r) => r.id)
  const mentionsMap = await fetchMemoMentions(memoIds)

  return rows.map((row) => ({
    id: row.id,
    room_id: row.room_id,
    date_range_id: row.date_range_id,
    author_participant_id: row.author_participant_id,
    content: row.content,
    created_at: row.created_at,
    updated_at: row.updated_at,
    author_name: row.author_name,
    mentions: mentionsMap.get(row.id) ?? [],
  }))
}

export async function getMemoById(
  roomId: string,
  memoId: string
): Promise<Memo | null> {
  const memos = await getMemosByRoom(roomId)
  return memos.find((m) => m.id === memoId) ?? null
}

async function getInboxRecipientIdsForMemo(memoId: string): Promise<string[]> {
  const rows = await sql<{ recipient_participant_id: string }[]>`
    SELECT DISTINCT recipient_participant_id
    FROM inbox_notifications
    WHERE memo_id = ${memoId}
  `
  return rows.map((r) => r.recipient_participant_id)
}

async function insertMemoMentionsAndInbox(
  memoId: string,
  roomId: string,
  dateRangeId: string,
  mentionParticipantIds: string[]
): Promise<string[]> {
  const affectedRecipients: string[] = []

  for (const participantId of mentionParticipantIds) {
    let mentionRows = await sql<{ id: string }[]>`
      INSERT INTO memo_mentions (memo_id, mentioned_participant_id)
      VALUES (${memoId}, ${participantId})
      ON CONFLICT (memo_id, mentioned_participant_id) DO NOTHING
      RETURNING id
    `

    let mentionId = mentionRows[0]?.id

    if (!mentionId) {
      const existing = await sql<{ id: string }[]>`
        SELECT id FROM memo_mentions
        WHERE memo_id = ${memoId}
          AND mentioned_participant_id = ${participantId}
        LIMIT 1
      `
      mentionId = existing[0]?.id
    }

    if (!mentionId) continue

    const existingInbox = await sql<{ id: string }[]>`
      SELECT id FROM inbox_notifications
      WHERE mention_id = ${mentionId}
      LIMIT 1
    `

    if (existingInbox.length === 0) {
      await sql`
        INSERT INTO inbox_notifications (
          recipient_participant_id,
          room_id,
          date_range_id,
          memo_id,
          mention_id
        )
        VALUES (
          ${participantId},
          ${roomId},
          ${dateRangeId},
          ${memoId},
          ${mentionId}
        )
      `
    }

    affectedRecipients.push(participantId)
  }

  return affectedRecipients
}

export async function createMemo(data: {
  roomId: string
  dateRangeId: string
  authorParticipantId: string
  content: string
  mentionParticipantIds: string[]
}): Promise<{ memo: Memo; affectedRecipientIds: string[] }> {
  const rows = await sql<
    {
      id: string
      room_id: string
      date_range_id: string
      author_participant_id: string
      content: string
      created_at: string
      updated_at: string
    }[]
  >`
    INSERT INTO memos (room_id, date_range_id, author_participant_id, content)
    VALUES (
      ${data.roomId},
      ${data.dateRangeId},
      ${data.authorParticipantId},
      ${data.content}
    )
    RETURNING id, room_id, date_range_id, author_participant_id, content, created_at, updated_at
  `

  const memoRow = rows[0]
  const uniqueMentions = [...new Set(data.mentionParticipantIds)]
  const affectedRecipientIds = await insertMemoMentionsAndInbox(
    memoRow.id,
    data.roomId,
    data.dateRangeId,
    uniqueMentions
  )

  const author = await findParticipantById(data.authorParticipantId)
  const memo: Memo = {
    ...memoRow,
    author_name: author?.name,
    mentions: [],
  }

  const fullMemo = (await getMemosByRoom(data.roomId, data.dateRangeId)).find(
    (m) => m.id === memoRow.id
  )

  return {
    memo: fullMemo ?? memo,
    affectedRecipientIds,
  }
}

export async function updateMemo(data: {
  roomId: string
  memoId: string
  authorParticipantId: string
  content: string
  mentionParticipantIds: string[]
}): Promise<{ memo: Memo | null; affectedRecipientIds: string[] }> {
  const existing = await getMemoById(data.roomId, data.memoId)
  if (!existing) return { memo: null, affectedRecipientIds: [] }
  if (existing.author_participant_id !== data.authorParticipantId) {
    throw new Error("FORBIDDEN")
  }

  await sql`
    UPDATE memos
    SET content = ${data.content}, updated_at = NOW()
    WHERE id = ${data.memoId}
      AND room_id = ${data.roomId}
  `

  const oldMentionIds = new Set(
    (existing.mentions ?? []).map((m) => m.mentioned_participant_id)
  )
  const newMentionIds = new Set(data.mentionParticipantIds)
  const affectedRecipientIds = new Set<string>()

  for (const mention of existing.mentions ?? []) {
    if (!newMentionIds.has(mention.mentioned_participant_id)) {
      await sql`
        DELETE FROM inbox_notifications
        WHERE mention_id = ${mention.id}
      `
      await sql`
        DELETE FROM memo_mentions WHERE id = ${mention.id}
      `
      affectedRecipientIds.add(mention.mentioned_participant_id)
    }
  }

  for (const participantId of newMentionIds) {
    if (!oldMentionIds.has(participantId)) {
      const inserted = await insertMemoMentionsAndInbox(
        data.memoId,
        data.roomId,
        existing.date_range_id,
        [participantId]
      )
      inserted.forEach((id) => affectedRecipientIds.add(id))
    }
  }

  const memo = (await getMemosByRoom(data.roomId, existing.date_range_id)).find(
    (m) => m.id === data.memoId
  )

  return {
    memo: memo ?? null,
    affectedRecipientIds: [...affectedRecipientIds],
  }
}

export async function deleteMemo(data: {
  roomId: string
  memoId: string
  participantId: string
}): Promise<{ deleted: boolean; affectedRecipientIds: string[] }> {
  const existing = await getMemoById(data.roomId, data.memoId)
  if (!existing) return { deleted: false, affectedRecipientIds: [] }

  const membership = await verifyRoomMembership(data.roomId, data.participantId)
  if (!membership) throw new Error("FORBIDDEN")

  const isAuthor = existing.author_participant_id === data.participantId
  if (!isAuthor && !membership.isHost) throw new Error("FORBIDDEN")

  const inboxRecipientIds = await getInboxRecipientIdsForMemo(data.memoId)
  const mentionRecipientIds = (existing.mentions ?? []).map(
    (m) => m.mentioned_participant_id
  )
  const affectedRecipientIds = [
    ...new Set([...inboxRecipientIds, ...mentionRecipientIds]),
  ]

  await sql`
    DELETE FROM inbox_notifications
    WHERE memo_id = ${data.memoId}
  `

  await sql`
    DELETE FROM memos
    WHERE id = ${data.memoId}
      AND room_id = ${data.roomId}
  `

  return { deleted: true, affectedRecipientIds }
}

export async function getMentionedDateRangeIdsForParticipant(
  roomId: string,
  participantId: string
): Promise<string[]> {
  const rows = await sql<{ date_range_id: string }[]>`
    SELECT DISTINCT m.date_range_id
    FROM memo_mentions mm
    JOIN memos m ON m.id = mm.memo_id
    WHERE m.room_id = ${roomId}
      AND mm.mentioned_participant_id = ${participantId}
  `
  return rows.map((r) => r.date_range_id)
}

export function mergeInboxRecipientIds(...lists: (string | undefined)[][]): string[] {
  return [...new Set(lists.flat().filter((id): id is string => Boolean(id)))]
}

export async function pruneOrphanInboxNotifications(): Promise<void> {
  await sql`
    DELETE FROM inbox_notifications i
    WHERE NOT EXISTS (
      SELECT 1 FROM memos m WHERE m.id = i.memo_id
    )
  `
}

export async function getInboxByParticipantId(
  participantId: string
): Promise<InboxNotification[]> {
  await pruneOrphanInboxNotifications()

  const rows = await sql<
    {
      id: string
      recipient_participant_id: string
      room_id: string
      date_range_id: string
      memo_id: string
      mention_id: string
      is_read: boolean
      created_at: string
      room_name: string
      room_code: string
      start_date: string
      end_date: string
      memo_preview: string
      mentioner_name: string
    }[]
  >`
    SELECT
      i.id,
      i.recipient_participant_id,
      i.room_id,
      i.date_range_id,
      i.memo_id,
      i.mention_id,
      i.is_read,
      i.created_at,
      r.name AS room_name,
      r.code AS room_code,
      dr.start_date::text AS start_date,
      dr.end_date::text AS end_date,
      LEFT(m.content, 120) AS memo_preview,
      p.name AS mentioner_name
    FROM inbox_notifications i
    JOIN rooms r ON r.id = i.room_id
    JOIN date_ranges dr ON dr.id = i.date_range_id
    JOIN memos m ON m.id = i.memo_id
    JOIN participants p ON p.id = m.author_participant_id
    WHERE i.recipient_participant_id = ${participantId}
    ORDER BY i.created_at DESC
  `

  return rows.map((row) => ({
    id: row.id,
    recipient_participant_id: row.recipient_participant_id,
    room_id: row.room_id,
    date_range_id: row.date_range_id,
    memo_id: row.memo_id,
    mention_id: row.mention_id,
    is_read: row.is_read,
    created_at: row.created_at,
    room_name: row.room_name,
    room_code: row.room_code,
    start_date: toISODateString(row.start_date),
    end_date: toISODateString(row.end_date),
    memo_preview: row.memo_preview,
    mentioner_name: row.mentioner_name,
  }))
}

export async function getInboxUnreadCount(participantId: string): Promise<number> {
  await pruneOrphanInboxNotifications()

  const rows = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM inbox_notifications i
    JOIN memos m ON m.id = i.memo_id
    WHERE i.recipient_participant_id = ${participantId}
      AND i.is_read = false
  `
  return Number(rows[0]?.count ?? 0)
}

export async function toggleInboxRead(
  id: string,
  participantId: string,
  isRead: boolean
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    UPDATE inbox_notifications
    SET is_read = ${isRead}
    WHERE id = ${id}
      AND recipient_participant_id = ${participantId}
    RETURNING id
  `
  return rows.length > 0
}

export async function markAllInboxRead(participantId: string): Promise<void> {
  await sql`
    UPDATE inbox_notifications
    SET is_read = true
    WHERE recipient_participant_id = ${participantId}
      AND is_read = false
  `
}

export async function deleteInboxNotification(
  id: string,
  participantId: string
): Promise<boolean> {
  const rows = await sql<{ id: string }[]>`
    DELETE FROM inbox_notifications
    WHERE id = ${id}
      AND recipient_participant_id = ${participantId}
    RETURNING id
  `
  return rows.length > 0
}
