-- memos: 방 격리, date_range 단위, 기간당 여러 메모(스레드)
CREATE TABLE IF NOT EXISTS memos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  date_range_id uuid NOT NULL REFERENCES date_ranges (id) ON DELETE CASCADE,
  author_participant_id uuid NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamptz DEFAULT NOW(),
  updated_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memos_room_id ON memos (room_id);

CREATE INDEX IF NOT EXISTS idx_memos_room_date_range
  ON memos (room_id, date_range_id);

CREATE TABLE IF NOT EXISTS memo_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  memo_id uuid NOT NULL REFERENCES memos (id) ON DELETE CASCADE,
  mentioned_participant_id uuid NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memo_mentions_memo_id ON memo_mentions (memo_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_memo_mentions_memo_participant
  ON memo_mentions (memo_id, mentioned_participant_id);

CREATE TABLE IF NOT EXISTS inbox_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_participant_id uuid NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  date_range_id uuid NOT NULL REFERENCES date_ranges (id) ON DELETE CASCADE,
  memo_id uuid NOT NULL REFERENCES memos (id) ON DELETE CASCADE,
  mention_id uuid NOT NULL REFERENCES memo_mentions (id) ON DELETE CASCADE,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inbox_recipient_read_created
  ON inbox_notifications (recipient_participant_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_inbox_mention_id
  ON inbox_notifications (mention_id);
