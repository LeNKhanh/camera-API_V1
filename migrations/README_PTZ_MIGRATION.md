# PTZ Logs Table Schema Migration

## Problem
The production database `ptz_logs` table is missing several columns that exist in the source code entity definition, causing PTZ commands to fail with error:
```
QueryFailedError: column "command_code" of relation "ptz_logs" does not exist
```

## Missing Columns
The following columns are missing from the production `ptz_logs` table:
- `command_code` (INTEGER, DEFAULT 0, NOT NULL)
- `param1` (INTEGER, nullable)
- `param2` (INTEGER, nullable)  
- `param3` (INTEGER, nullable)
- `speed` (INTEGER, DEFAULT 1, NOT NULL)
- `vector_pan` (INTEGER, DEFAULT 0, NOT NULL)
- `vector_tilt` (INTEGER, DEFAULT 0, NOT NULL)
- `vector_zoom` (INTEGER, DEFAULT 0, NOT NULL)
- `duration_ms` (INTEGER, nullable)

## Solution
Migration file `002_update_ptz_logs_schema.sql` has been created to add all missing columns and update the schema to match the entity definition.

## How to Run Migration

### Option 1: Automatic Script (Recommended)

#### For Local Database:
```powershell
# Set your local DATABASE_URL
$env:DATABASE_URL = "postgresql://postgres:your_password@localhost:5432/camera_db"

# Run migration script
node scripts/run-ptz-migration.js
```

#### For Production Database:
```powershell
# Set production DATABASE_URL
$env:DATABASE_URL = "postgresql://user:password@production-host:5432/camera_db"

# Run migration script
node scripts/run-ptz-migration.js
```

### Option 2: Manual SQL Execution

If you prefer to run the SQL directly:

1. Connect to your database using psql or any PostgreSQL client
2. Run the migration file:
```sql
\i migrations/002_update_ptz_logs_schema.sql
```

Or copy and paste the SQL content from `migrations/002_update_ptz_logs_schema.sql`

## Verification

After running the migration, verify the schema:

```sql
-- Check all columns in ptz_logs table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ptz_logs'
ORDER BY ordinal_position;
```

Expected columns:
- id (uuid)
- action (varchar)
- speed (integer)
- vector_pan (integer)
- vector_tilt (integer)
- vector_zoom (integer)
- duration_ms (integer)
- created_at (timestamp with time zone)
- ILoginID (varchar/uuid)
- nChannelID (integer)
- command_code (integer)
- param1 (integer, nullable)
- param2 (integer, nullable)
- param3 (integer, nullable)
- camera_id (uuid, if exists)

## Testing

After migration, test PTZ commands:

```powershell
# Test PTZ command
curl -X POST http://localhost:3000/api/ptz/:cameraId/control `
  -H "Authorization: Bearer YOUR_TOKEN" `
  -H "Content-Type: application/json" `
  -d '{"action":"PAN_RIGHT","speed":5,"duration":1500}'
```

Check that the command is logged successfully:
```sql
SELECT * FROM ptz_logs ORDER BY created_at DESC LIMIT 5;
```

## Rollback (If Needed)

To rollback the migration (not recommended, will lose data in new columns):

```sql
-- Remove added columns
ALTER TABLE ptz_logs DROP COLUMN IF EXISTS command_code;
ALTER TABLE ptz_logs DROP COLUMN IF EXISTS param1;
ALTER TABLE ptz_logs DROP COLUMN IF EXISTS param2;
ALTER TABLE ptz_logs DROP COLUMN IF EXISTS param3;
ALTER TABLE ptz_logs DROP COLUMN IF EXISTS speed;
ALTER TABLE ptz_logs DROP COLUMN IF EXISTS vector_pan;
ALTER TABLE ptz_logs DROP COLUMN IF EXISTS vector_tilt;
ALTER TABLE ptz_logs DROP COLUMN IF EXISTS vector_zoom;
ALTER TABLE ptz_logs DROP COLUMN IF EXISTS duration_ms;
```

## Notes

1. This migration is **idempotent** - it can be run multiple times safely
2. Uses `ADD COLUMN IF NOT EXISTS` to avoid errors if columns already exist
3. Sets proper defaults for NOT NULL columns
4. Adds foreign key constraint on ILoginID → cameras(id)
5. Creates index on ILoginID for better query performance
6. Existing data is preserved

## Related Files

- **Migration SQL**: `migrations/002_update_ptz_logs_schema.sql`
- **Migration Script**: `scripts/run-ptz-migration.js`
- **Entity Definition**: `src/typeorm/entities/ptz-log.entity.ts`
- **Documentation**: `migrations/README_PTZ_MIGRATION.md` (this file)
