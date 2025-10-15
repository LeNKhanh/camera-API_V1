-- Thêm các cột thiếu vào bảng ptz_logs trên production
-- Chạy script này nếu bạn muốn giữ data hiện tại

-- Step 1: Remove deprecated camera_id column (replaced by ILoginID)
ALTER TABLE ptz_logs DROP COLUMN IF EXISTS camera_id CASCADE;

-- Step 2: Thêm các cột mới
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS command_code integer NOT NULL DEFAULT 0;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS speed integer NOT NULL DEFAULT 1;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS vector_pan integer NOT NULL DEFAULT 0;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS vector_tilt integer NOT NULL DEFAULT 0;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS vector_zoom integer NOT NULL DEFAULT 0;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS duration_ms integer;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS param1 integer;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS param2 integer;
ALTER TABLE ptz_logs ADD COLUMN IF NOT EXISTS param3 integer;

-- Kiểm tra schema sau khi thêm
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ptz_logs'
ORDER BY ordinal_position;
