-- 006_room_date_range_link_table.sql
-- room 과 date_ranges 사이에 중간 테이블(room_date_ranges)을 두어
-- room <-> date_ranges 를 N:M 구조로 만들기 위한 마이그레이션입니다.
--
-- 현재 상태 (005까지 적용 후):
--   - date_ranges(room_id, participant_id, ...) 구조
--   - 한 date_range 는 사실상 1개의 room 에만 속해 있습니다.
--
-- 목표:
--   1) room_date_ranges(room_id, date_range_id) 링크 테이블 생성
--   2) 기존 date_ranges.room_id 값을 이용해 room_date_ranges 로 백필
--   3) 향후 코드가 room_date_ranges 를 사용하도록 모두 수정된 후
--      date_ranges.room_id 컬럼을 제거할 수 있도록 준비
--
-- ⚠ 운영 환경에서는 트랜잭션/백업 정책에 맞게 조정해서 사용하세요.

----------------------------
-- 0. pgcrypto 확장 보장 (gen_random_uuid용)
----------------------------

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pgcrypto'
  ) THEN
    CREATE EXTENSION pgcrypto;
  END IF;
END $$;

----------------------------
-- 1. room_date_ranges 테이블 생성
----------------------------

CREATE TABLE IF NOT EXISTS room_date_ranges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  room_id uuid NOT NULL REFERENCES rooms (id) ON DELETE CASCADE,
  date_range_id uuid NOT NULL REFERENCES date_ranges (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW(),
  CONSTRAINT room_date_ranges_room_range_unique UNIQUE (room_id, date_range_id)
);

CREATE INDEX IF NOT EXISTS idx_room_date_ranges_room_id
  ON room_date_ranges (room_id);

CREATE INDEX IF NOT EXISTS idx_room_date_ranges_date_range_id
  ON room_date_ranges (date_range_id);

----------------------------
-- 2. 기존 date_ranges.room_id 기반으로 링크 백필
----------------------------
-- 005 마이그레이션에서 date_ranges.room_id 가 이미 채워져 있다고 가정합니다.
-- room_id 가 NULL 인 행은 건너뜁니다.

INSERT INTO room_date_ranges (room_id, date_range_id, created_at, updated_at)
SELECT
  dr.room_id,
  dr.id AS date_range_id,
  COALESCE(dr.created_at, NOW()) AS created_at,
  NOW() AS updated_at
FROM date_ranges dr
WHERE dr.room_id IS NOT NULL
  -- 재실행 시 중복 방지
  AND NOT EXISTS (
    SELECT 1
    FROM room_date_ranges rdr
    WHERE rdr.room_id = dr.room_id
      AND rdr.date_range_id = dr.id
  );

----------------------------
-- 3. date_ranges.room_id 컬럼 제거 검토
----------------------------
-- ⚠ 중요:
--   - 애플리케이션 코드가 room_date_ranges 를 사용하도록 모두 수정된 후에만
--     아래 ALTER TABLE 을 실제로 실행해야 합니다.
--   - 지금은 안전을 위해 DROP COLUMN 은 주석으로만 남겨둡니다.
----------------------------

-- DO $$
-- BEGIN
--   IF EXISTS (
--     SELECT 1
--     FROM information_schema.columns
--     WHERE table_name = 'date_ranges'
--       AND column_name = 'room_id'
--   ) THEN
--     ALTER TABLE date_ranges
--       DROP COLUMN room_id;
--   END IF;
-- END $$;

