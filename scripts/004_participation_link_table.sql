-- 004_participation_link_table.sql
-- 방(room) 과 참여자(participants)를 N:M 관계로 연결하는 room_participants 테이블 생성 및
-- 기존 데이터 마이그레이션, is_host 컬럼 제거까지 포함한 스크립트입니다.
-- 운영 환경에서는 트랜잭션/백업 정책에 맞게 분리 실행을 고려하세요.

----------------------------
-- 1. room_participants 테이블 생성
----------------------------

-- gen_random_uuid() 사용을 위해 pgcrypto 확장 필요할 수 있음
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
  ) THEN
    CREATE EXTENSION pgcrypto;
  END IF;
END $$;

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

----------------------------
-- 2. 기존 participants 데이터 N:M 테이블로 백필
----------------------------

INSERT INTO room_participants (room_id, participant_id, is_host, is_active, created_at, updated_at)
SELECT
  p.room_id,
  p.id AS participant_id,
  COALESCE(p.is_host, false) AS is_host,
  CASE WHEN p.deleted_at IS NULL THEN true ELSE false END AS is_active,
  COALESCE(p.created_at, NOW()) AS created_at,
  COALESCE(p.created_at, NOW()) AS updated_at
FROM participants p
WHERE p.room_id IS NOT NULL
  -- 재실행 시 중복 방지
  AND NOT EXISTS (
    SELECT 1
    FROM room_participants rp
    WHERE rp.room_id = p.room_id
      AND rp.participant_id = p.id
  );

----------------------------
-- 3. 인덱스/성능 보조 (선택)
----------------------------

CREATE INDEX IF NOT EXISTS idx_room_participants_room_id
  ON room_participants (room_id);

CREATE INDEX IF NOT EXISTS idx_room_participants_participant_id
  ON room_participants (participant_id);

CREATE INDEX IF NOT EXISTS idx_room_participants_room_active
  ON room_participants (room_id, is_active);

----------------------------
-- 4. participants.is_host 컬럼 제거
----------------------------
-- ⚠️ 주의:
--   애플리케이션 코드가 room_participants.is_host 를 사용하도록
--   모두 수정된 후에 아래 ALTER TABLE 을 실행하세요.
----------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'participants'
      AND column_name = 'is_host'
  ) THEN
    ALTER TABLE participants
      DROP COLUMN is_host;
  END IF;
END $$;

