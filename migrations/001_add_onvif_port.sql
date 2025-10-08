-- Migration: Add onvif_port column to cameras table
-- Date: 2025-10-08

-- Add onvif_port column (default 80)
ALTER TABLE cameras 
ADD COLUMN IF NOT EXISTS onvif_port INTEGER DEFAULT 80;

-- Update existing cameras to have default onvif_port
UPDATE cameras 
SET onvif_port = 80 
WHERE onvif_port IS NULL;

-- Add comment
COMMENT ON COLUMN cameras.onvif_port IS 'ONVIF protocol port (default 80, Dahua: 80/8000/8899)';
