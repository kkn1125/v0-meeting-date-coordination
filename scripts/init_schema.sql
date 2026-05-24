-- 개인 PostgreSQL 서버용 초기 스키마 (Supabase RLS/Realtime 제외)

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 모임 테이블
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text UNIQUE,
  creator_participant_id uuid,
  created_at timestamptz DEFAULT NOW()
);

-- 참석자 테이블 (글로벌 사용자)
CREATE TABLE IF NOT EXISTS participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  password_hash text,
  deleted_at timestamptz DEFAULT NULL,
  created_at timestamptz DEFAULT NOW()
);

-- 방-참석자 N:M 연결 테이블
CREATE TABLE IF NOT EXISTS room_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  participant_id uuid NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  is_host boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT room_participants_room_participant_unique UNIQUE (room_id, participant_id)
);

CREATE INDEX IF NOT EXISTS idx_room_participants_room_id
  ON room_participants (room_id);

CREATE INDEX IF NOT EXISTS idx_room_participants_participant_id
  ON room_participants (participant_id);

CREATE INDEX IF NOT EXISTS idx_room_participants_room_active
  ON room_participants (room_id, is_active);

-- 방 라벨 테이블
CREATE TABLE IF NOT EXISTS room_labels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  name text NOT NULL,
  is_valid boolean NOT NULL DEFAULT true,
  created_by_participant_id uuid NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_room_labels_room_id ON room_labels (room_id);

-- 날짜 범위 테이블
CREATE TABLE IF NOT EXISTS date_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id uuid NOT NULL REFERENCES participants (id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_available boolean NOT NULL DEFAULT true,
  label_id uuid REFERENCES room_labels (id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_date_ranges_room_id
  ON date_ranges (room_id);

CREATE INDEX IF NOT EXISTS idx_date_ranges_room_participant
  ON date_ranges (room_id, participant_id);

CREATE INDEX IF NOT EXISTS idx_date_ranges_label_id ON date_ranges (label_id);

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
