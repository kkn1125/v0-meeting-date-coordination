-- 009_restore_date_ranges_columns.sql
-- room_date_ranges 에 옮겨두었던 기간/가용 여부를 다시 date_ranges 로 되돌리고
-- room_id 를 date_ranges 에 직접 두는 구조를 복원합니다.
--
-- 전제:
--   - 006_room_date_range_link_table.sql 이 적용되어 room_date_ranges 가 존재
--   - 007_move_date_fields_to_room_date_ranges.sql 로 date_ranges 의 start_date/end_date/is_available 가 제거됨
--   - 008_align_room_date_ranges_date_types.sql 로 room_date_ranges.start_date/end_date 가 timestamptz 로 정렬됨

----------------------------
-- 1. date_ranges 에 컬럼 복원
----------------------------

ALTER TABLE date_ranges
ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES rooms (id) ON DELETE CASCADE;

ALTER TABLE date_ranges
ADD COLUMN IF NOT EXISTS start_date timestamptz;

ALTER TABLE date_ranges
ADD COLUMN IF NOT EXISTS end_date timestamptz;

ALTER TABLE date_ranges
ADD COLUMN IF NOT EXISTS is_available boolean;

----------------------------
-- 2. room_date_ranges → date_ranges 로 데이터 역마이그레이션
----------------------------
-- room_date_ranges.date_range_id = date_ranges.id 를 기준으로 매핑합니다.
-- 이미 값이 있는 행은 덮어쓰지 않고, NULL 인 컬럼만 채웁니다.

UPDATE date_ranges dr
SET
  room_id = COALESCE(dr.room_id, rdr.room_id),
  start_date = COALESCE(dr.start_date, rdr.start_date),
  end_date = COALESCE(dr.end_date, rdr.end_date),
  is_available = COALESCE(dr.is_available, rdr.is_available)
FROM room_date_ranges rdr
WHERE rdr.date_range_id = dr.id;

----------------------------
-- 3. 제약 및 인덱스 정리 (필요 시)
----------------------------
-- 데이터가 모두 채워졌고, 애플리케이션에서 NOT NULL 을 기대한다면
-- 아래 제약을 활성화할 수 있습니다. 기본 스크립트에서는 주석으로 둡니다.

-- ALTER TABLE date_ranges
--   ALTER COLUMN room_id SET NOT NULL,
--   ALTER COLUMN start_date SET NOT NULL,
--   ALTER COLUMN end_date SET NOT NULL,
--   ALTER COLUMN is_available SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_date_ranges_room_id
  ON date_ranges (room_id);

CREATE INDEX IF NOT EXISTS idx_date_ranges_room_participant
  ON date_ranges (room_id, participant_id);

