-- 010_drop_room_date_ranges.sql
-- room_date_ranges 테이블을 제거하고, room → date_ranges (1:N) 구조만 유지합니다.
--
-- 전제:
--   - 009_restore_date_ranges_columns.sql 이 성공적으로 적용되어
--     필요한 room_id / start_date / end_date / is_available 값이 모두
--     date_ranges 테이블에 채워져 있음.
--   - 애플리케이션 코드가 더 이상 room_date_ranges 를 조회/조작하지 않음.

----------------------------
-- 1. room_date_ranges 테이블 제거
----------------------------

DROP TABLE IF EXISTS room_date_ranges CASCADE;

