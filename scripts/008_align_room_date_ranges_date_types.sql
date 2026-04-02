-- 008_align_room_date_ranges_date_types.sql
-- room_date_ranges.start_date / end_date 컬럼 타입을
-- TIMESTAMPTZ 로 정렬하기 위한 마이그레이션입니다.
--
-- 기존 애플리케이션은 "yyyy-MM-dd" 형식(일 단위)로만 사용했지만,
-- 향후 시간 정보까지 확장할 수 있도록 TIMESTAMPTZ 로 올립니다.
-- 현재 값이 date 인 경우에도 "::timestamptz" 로 안전하게 승격됩니다.

-- 1. start_date / end_date 컬럼 타입을 TIMESTAMPTZ 로 통일
----------------------------

ALTER TABLE room_date_ranges
  ALTER COLUMN start_date TYPE timestamptz
  USING start_date::timestamptz;

ALTER TABLE room_date_ranges
  ALTER COLUMN end_date TYPE timestamptz
  USING end_date::timestamptz;

