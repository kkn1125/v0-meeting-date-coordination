-- 005_date_ranges_per_room.sql
-- date_ranges 를 참가자 전역 기준에서 "방별" 기준으로 분리하기 위한 마이그레이션입니다.
-- 주요 변경 사항:
--   1) date_ranges 에 room_id 컬럼 추가 (rooms 와 FK)
--   2) 기존 데이터는 room_participants 를 이용해 room_id 를 백필
--   3) 조회 성능을 위한 인덱스 추가
--
-- ⚠️ 운영 환경에서는 트랜잭션/백업 정책에 맞게 조정해서 사용하세요.

----------------------------
-- 1. room_id 컬럼 추가
----------------------------

ALTER TABLE date_ranges
ADD COLUMN IF NOT EXISTS room_id uuid REFERENCES rooms (id) ON DELETE CASCADE;

----------------------------
-- 2. 기존 데이터 room_id 백필
----------------------------
-- 현재 스키마에서는 date_ranges 가 participant_id 만 가지고 있고,
-- room 과의 관계는 room_participants(room_id, participant_id) 를 통해 유추합니다.
-- 한 참가자가 여러 방에 속해 있는 경우 과거 데이터의 방 소속이 애매할 수 있지만,
-- 다음 전략을 사용합니다.
--
--   - participant_id 가 속한 room_participants 중 첫 번째 room_id 를 사용
--   - 이미 room_id 가 채워진 행은 건너뜀 (재실행 안전)

WITH first_room_per_participant AS (
  SELECT
    rp.participant_id,
    MIN(rp.room_id::text)::uuid AS room_id
  FROM room_participants rp
  GROUP BY rp.participant_id
)
UPDATE date_ranges dr
SET room_id = frp.room_id
FROM first_room_per_participant frp
WHERE dr.participant_id = frp.participant_id
  AND dr.room_id IS NULL;

----------------------------
-- 3. 인덱스 추가
----------------------------

CREATE INDEX IF NOT EXISTS idx_date_ranges_room_id
  ON date_ranges (room_id);

CREATE INDEX IF NOT EXISTS idx_date_ranges_room_participant
  ON date_ranges (room_id, participant_id);

