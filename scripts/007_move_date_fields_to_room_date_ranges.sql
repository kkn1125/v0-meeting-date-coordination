-- 007_move_date_fields_to_room_date_ranges.sql
-- date_ranges 에 남아 있는 기간/가용 여부 컬럼을 room_date_ranges 로 이전하고
-- date_ranges 에서는 해당 컬럼들을 제거하는 마이그레이션입니다.
--
-- 현재 상태 (006까지 적용 후):
--   - date_ranges(id, participant_id, start_date, end_date, is_available, created_at)
--   - room_date_ranges(id, room_id, date_range_id, created_at, updated_at)
--
-- 목표:
--   - room_date_ranges 에 start_date, end_date, is_available 컬럼 추가
--   - 기존 date_ranges.* 값을 room_date_ranges.* 로 백필
--   - 애플리케이션이 room_date_ranges 를 사용하도록 변경된 뒤
--     date_ranges 에서 start_date, end_date, is_available 컬럼 제거
--
-- ⚠ 운영 환경에서는 트랜잭션/백업/롤백 전략에 맞게 조정해서 사용하세요.

----------------------------
-- 1. room_date_ranges 에 기간/가용 여부 컬럼 추가
----------------------------

ALTER TABLE room_date_ranges
ADD COLUMN IF NOT EXISTS start_date date;

ALTER TABLE room_date_ranges
ADD COLUMN IF NOT EXISTS end_date date;

ALTER TABLE room_date_ranges
ADD COLUMN IF NOT EXISTS is_available boolean;

----------------------------
-- 2. 기존 date_ranges 의 값을 room_date_ranges 로 백필
----------------------------
-- room_date_ranges.date_range_id = date_ranges.id 를 이용해 매핑합니다.
-- 이미 값이 채워진 행은 건너뜁니다 (재실행 안전).

UPDATE room_date_ranges rdr
SET
  start_date = dr.start_date,
  end_date = dr.end_date,
  is_available = dr.is_available
FROM date_ranges dr
WHERE rdr.date_range_id = dr.id
  AND (rdr.start_date IS NULL OR rdr.end_date IS NULL OR rdr.is_available IS NULL);

----------------------------
-- 3. 필요시 NOT NULL 제약 추가 (선택)
----------------------------
-- 앱에서 room_date_ranges.* 컬럼을 모두 사용한다고 확신할 때 아래를 활성화하세요.
-- 기본 마이그레이션에서는 데이터 이전까지만 수행합니다.

-- ALTER TABLE room_date_ranges
--   ALTER COLUMN start_date SET NOT NULL,
--   ALTER COLUMN end_date SET NOT NULL,
--   ALTER COLUMN is_available SET NOT NULL;

----------------------------
-- 4. date_ranges 에서 기간/가용 여부 컬럼 제거
----------------------------
-- ⚠ 중요:
--   - 애플리케이션 코드가 date_ranges.start_date / end_date / is_available 를
--     더 이상 직접 사용하지 않고, room_date_ranges 쪽을 사용하도록
--     수정된 후에만 아래 블록을 실행해야 합니다.
--   - 이 스크립트는 그 시점을 가정하고 있으므로, 배포 순서를 반드시 지켜주세요.
----------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'date_ranges'
      AND column_name = 'start_date'
  ) THEN
    ALTER TABLE date_ranges
      DROP COLUMN start_date,
      DROP COLUMN end_date,
      DROP COLUMN is_available;
  END IF;
END $$;

