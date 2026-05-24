-- 방 단위 라벨 및 date_ranges 연동

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

ALTER TABLE date_ranges
  ADD COLUMN IF NOT EXISTS label_id uuid REFERENCES room_labels (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_date_ranges_label_id ON date_ranges (label_id);
