# ✅ PTZ Logs Migration - Deployment Guide

## Summary
Successfully created and tested migration to fix the `ptz_logs` table schema. All required columns have been added.

## Migration Status

### ✅ Local Database (Tested)
- Migration file: `migrations/002_update_ptz_logs_schema.sql`
- Status: **TESTED AND WORKING**
- All columns added successfully

### ⏳ Production Database (Pending)
- Migration ready to deploy
- Follow instructions below

## What Was Fixed

### Added Columns:
1. ✅ `command_code` (INTEGER, DEFAULT 0, NOT NULL) - PTZ command code
2. ✅ `param1` (INTEGER, nullable) - Vendor parameter 1
3. ✅ `param2` (INTEGER, nullable) - Vendor parameter 2 (speed/preset)
4. ✅ `param3` (INTEGER, nullable) - Vendor parameter 3
5. ✅ `speed` (INTEGER, DEFAULT 1, NOT NULL) - Movement speed
6. ✅ `vector_pan` (INTEGER, DEFAULT 0, NOT NULL) - Pan vector
7. ✅ `vector_tilt` (INTEGER, DEFAULT 0, NOT NULL) - Tilt vector
8. ✅ `vector_zoom` (INTEGER, DEFAULT 0, NOT NULL) - Zoom vector
9. ✅ `duration_ms` (INTEGER, nullable) - Movement duration

### Updated Constraints:
- ✅ `ILoginID` set to NOT NULL
- ✅ `nChannelID` set to DEFAULT 1 and NOT NULL
- ✅ Foreign key constraint on `ILoginID` → `cameras(id)`
- ✅ Index created on `ILoginID`

## Deploy to Production

### Method 1: Using Migration Script (Recommended)

```powershell
# 1. SSH/Connect to your production server (Coolify container)
docker exec -it <container-name> /bin/sh

# 2. Set DATABASE_URL (if not already set in environment)
export DATABASE_URL="postgresql://postgres:password@host:5432/Camera_api"

# 3. Run migration
node scripts/run-ptz-migration.js
```

### Method 2: Direct SQL Execution

If you have direct database access:

```sql
-- Connect to production database
\c Camera_api

-- Run migration
\i /path/to/migrations/002_update_ptz_logs_schema.sql

-- Verify
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ptz_logs'
ORDER BY ordinal_position;
```

### Method 3: Via Coolify/Database UI

1. Access your database management UI (pgAdmin, DBeaver, etc.)
2. Connect to production database
3. Open and execute `migrations/002_update_ptz_logs_schema.sql`
4. Verify all columns are added

## Verification Steps

After running migration, verify with:

```sql
-- Check all columns exist
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'ptz_logs' 
ORDER BY ordinal_position;

-- Should return: id, camera_id, action, status, error_message, created_at, 
--                ILoginID, nChannelID, command_code, param1, param2, param3,
--                speed, vector_pan, vector_tilt, vector_zoom, duration_ms
```

## Test PTZ After Migration

1. **Restart Application**
   ```bash
   # If using Docker/Coolify, restart container
   docker restart <container-name>
   
   # Or restart systemd service
   systemctl restart camera-api
   ```

2. **Test PTZ Command**
   ```bash
   curl -X POST https://your-domain.com/api/ptz/<camera-id>/control \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "action": "PAN_RIGHT",
       "speed": 5,
       "duration": 1500
     }'
   ```

3. **Verify Logging**
   ```sql
   -- Check recent PTZ logs
   SELECT id, "ILoginID", "nChannelID", action, command_code, 
          speed, vector_pan, vector_tilt, vector_zoom, duration_ms,
          param1, param2, param3, created_at
   FROM ptz_logs
   ORDER BY created_at DESC
   LIMIT 5;
   ```

## Expected Result

After successful migration, PTZ commands should:
- ✅ Execute without errors
- ✅ Log to `ptz_logs` table with all fields populated
- ✅ No more "column command_code does not exist" errors

## Rollback (Emergency Only)

If you need to rollback (NOT recommended - will lose data):

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

## Files Created

1. ✅ `migrations/002_update_ptz_logs_schema.sql` - Migration SQL
2. ✅ `scripts/run-ptz-migration.js` - Automated migration runner
3. ✅ `migrations/README_PTZ_MIGRATION.md` - Detailed documentation
4. ✅ `migrations/DEPLOYMENT_GUIDE.md` - This file
5. ✅ `scripts/check-ptz-data.js` - Data inspection tool
6. ✅ `scripts/check-fk.js` - FK constraint checker

## Support

If you encounter issues:
1. Check application logs for detailed error messages
2. Verify DATABASE_URL is correct
3. Ensure you have ALTER TABLE permissions
4. Check that `cameras` table exists and has data
5. Review migration logs for NOTICE messages

## Next Steps After Production Deployment

1. ✅ Monitor application logs for PTZ errors
2. ✅ Test PTZ on multiple cameras
3. ✅ Verify `ptz_logs` table is being populated correctly
4. ✅ Update database backup procedures
5. ✅ Document any production-specific configurations

---

**Migration Author**: GitHub Copilot  
**Migration Date**: 2025-10-15  
**Tested On**: Local PostgreSQL 17.6  
**Production Ready**: ✅ YES
