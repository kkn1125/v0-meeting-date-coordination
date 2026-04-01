-- Add code column to rooms table (if not exists)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='code') THEN
    ALTER TABLE rooms ADD COLUMN code text unique;
  END IF;
END $$;

-- Add creator_participant_id to rooms table (for tracking room owner)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='rooms' AND column_name='creator_participant_id') THEN
    ALTER TABLE rooms ADD COLUMN creator_participant_id uuid;
  END IF;
END $$;

-- Add password column to participants table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='participants' AND column_name='password_hash') THEN
    ALTER TABLE participants ADD COLUMN password_hash text;
  END IF;
END $$;

-- Add deleted_at column to participants table for soft delete (kick feature)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='participants' AND column_name='deleted_at') THEN
    ALTER TABLE participants ADD COLUMN deleted_at timestamptz default null;
  END IF;
END $$;

-- Add is_host column to participants table
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='participants' AND column_name='is_host') THEN
    ALTER TABLE participants ADD COLUMN is_host boolean default false;
  END IF;
END $$;

-- Add unique constraint on room_id + name for participants (prevent duplicate names in same room)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participants_room_name_unique') THEN
    ALTER TABLE participants ADD CONSTRAINT participants_room_name_unique UNIQUE (room_id, name);
  END IF;
END $$;

-- Update RLS policies for participants to allow updates
DROP POLICY IF EXISTS "Allow public update participants" ON participants;
CREATE POLICY "Allow public update participants" ON participants FOR UPDATE USING (true) WITH CHECK (true);

-- Update RLS policies for rooms to allow updates
DROP POLICY IF EXISTS "Allow public update rooms" ON rooms;
CREATE POLICY "Allow public update rooms" ON rooms FOR UPDATE USING (true) WITH CHECK (true);
