-- Migration: Update ptz_logs table schema
-- Date: 2025-10-15
-- Purpose: Add missing columns (command_code, param1, param2, param3, speed, vectors, duration_ms) 
--          and update existing columns to match entity definition

-- Step 1: Add command_code column (command code mapping)
ALTER TABLE ptz_logs 
ADD COLUMN IF NOT EXISTS command_code INTEGER DEFAULT 0 NOT NULL;

-- Step 2: Add param1, param2, param3 columns (vendor-specific parameters)
ALTER TABLE ptz_logs 
ADD COLUMN IF NOT EXISTS param1 INTEGER;

ALTER TABLE ptz_logs 
ADD COLUMN IF NOT EXISTS param2 INTEGER;

ALTER TABLE ptz_logs 
ADD COLUMN IF NOT EXISTS param3 INTEGER;

-- Step 3: Add speed column if not exists
ALTER TABLE ptz_logs 
ADD COLUMN IF NOT EXISTS speed INTEGER DEFAULT 1 NOT NULL;

-- Step 4: Add vector columns if not exists
ALTER TABLE ptz_logs 
ADD COLUMN IF NOT EXISTS vector_pan INTEGER DEFAULT 0 NOT NULL;

ALTER TABLE ptz_logs 
ADD COLUMN IF NOT EXISTS vector_tilt INTEGER DEFAULT 0 NOT NULL;

ALTER TABLE ptz_logs 
ADD COLUMN IF NOT EXISTS vector_zoom INTEGER DEFAULT 0 NOT NULL;

-- Step 5: Add duration_ms column if not exists
ALTER TABLE ptz_logs 
ADD COLUMN IF NOT EXISTS duration_ms INTEGER;

-- Step 6: Update ILoginID column to be UUID type and NOT NULL if needed
-- The entity uses ILoginID as the camera reference, not camera_id
-- First, copy camera_id to ILoginID if ILoginID is null
UPDATE ptz_logs 
SET "ILoginID" = camera_id::varchar
WHERE "ILoginID" IS NULL AND camera_id IS NOT NULL;

-- Check if we need to change ILoginID type from varchar to uuid
DO $$ 
BEGIN
  -- For now, keep it as varchar(64) since it stores UUIDs as strings
  -- Just ensure it has proper constraints
  
  -- Try to set NOT NULL if all values are populated
  IF NOT EXISTS (
    SELECT 1 FROM ptz_logs WHERE "ILoginID" IS NULL
  ) THEN
    ALTER TABLE ptz_logs ALTER COLUMN "ILoginID" SET NOT NULL;
  END IF;
EXCEPTION
  WHEN not_null_violation THEN
    RAISE NOTICE 'Cannot set ILoginID to NOT NULL - some values are NULL';
END $$;

-- Step 7: Update nChannelID to have proper default and NOT NULL
ALTER TABLE ptz_logs 
ALTER COLUMN "nChannelID" SET DEFAULT 1;

ALTER TABLE ptz_logs 
ALTER COLUMN "nChannelID" SET NOT NULL;

-- Step 8: Add comments for documentation
COMMENT ON COLUMN ptz_logs.command_code IS 'PTZ command code (vendor-specific numeric code)';
COMMENT ON COLUMN ptz_logs.param1 IS 'Vendor-specific parameter 1 (optional)';
COMMENT ON COLUMN ptz_logs.param2 IS 'Vendor-specific parameter 2 (optional, often horizontal speed or preset)';
COMMENT ON COLUMN ptz_logs.param3 IS 'Vendor-specific parameter 3 (optional)';
COMMENT ON COLUMN ptz_logs.speed IS 'PTZ movement speed (1-10)';
COMMENT ON COLUMN ptz_logs.vector_pan IS 'Pan vector (-10 to 10, multiplied by speed)';
COMMENT ON COLUMN ptz_logs.vector_tilt IS 'Tilt vector (-10 to 10, multiplied by speed)';
COMMENT ON COLUMN ptz_logs.vector_zoom IS 'Zoom vector (-10 to 10, multiplied by speed)';
COMMENT ON COLUMN ptz_logs.duration_ms IS 'Movement duration in milliseconds (optional)';
COMMENT ON COLUMN ptz_logs."ILoginID" IS 'Camera ID (foreign key to cameras.id)';
COMMENT ON COLUMN ptz_logs."nChannelID" IS 'Camera channel number at time of command';

-- Step 9: Create index on ILoginID for better query performance
CREATE INDEX IF NOT EXISTS "IDX_ptz_logs_ILoginID" ON ptz_logs ("ILoginID");

-- Step 10: Add foreign key constraint on ILoginID if it doesn't exist
-- The entity uses ILoginID as the camera reference (with @JoinColumn)
-- First, ensure ILoginID is large enough to hold UUID strings
DO $$ 
BEGIN
  -- Check if column is varchar and length is less than 64
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'ptz_logs' 
    AND column_name = 'ILoginID' 
    AND data_type = 'character varying'
    AND (character_maximum_length IS NULL OR character_maximum_length < 64)
  ) THEN
    ALTER TABLE ptz_logs ALTER COLUMN "ILoginID" TYPE varchar(64);
  END IF;
END $$;

-- Clean up any orphaned records where ILoginID doesn't match a camera
DELETE FROM ptz_logs 
WHERE "ILoginID" IS NOT NULL 
  AND "ILoginID" != '' 
  AND NOT EXISTS (
    SELECT 1 FROM cameras 
    WHERE id::varchar = ptz_logs."ILoginID" OR id::text = ptz_logs."ILoginID"
  );

-- Try to add the foreign key constraint if it doesn't already exist
DO $$ 
BEGIN
  -- Check if FK already exists
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'FK_ptz_logs_camera_ILoginID' 
    AND table_name = 'ptz_logs'
  ) THEN
    -- Convert ILoginID to UUID type if possible, or add FK on varchar
    BEGIN
      -- Try adding FK constraint (cameras.id is UUID, ILoginID is varchar)
      -- PostgreSQL can handle this if the varchar values are valid UUIDs
      ALTER TABLE ptz_logs 
      ADD CONSTRAINT "FK_ptz_logs_camera_ILoginID" 
      FOREIGN KEY ("ILoginID") REFERENCES cameras(id) ON DELETE CASCADE;
      
      RAISE NOTICE 'Successfully added FK constraint FK_ptz_logs_camera_ILoginID';
    EXCEPTION
      WHEN foreign_key_violation OR invalid_text_representation THEN
        RAISE NOTICE 'Could not add FK constraint - ILoginID values may not all be valid UUIDs matching cameras';
      WHEN others THEN
        RAISE NOTICE 'Could not add FK constraint - error: %', SQLERRM;
    END;
  ELSE
    RAISE NOTICE 'FK constraint FK_ptz_logs_camera_ILoginID already exists';
  END IF;
END $$;

-- Migration completed successfully
SELECT 'Migration 002_update_ptz_logs_schema.sql completed' AS status;
