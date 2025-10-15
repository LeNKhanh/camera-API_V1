# 🚀 Quick Start - PTZ Migration

## Problem Fixed
❌ **Error**: `column "command_code" of relation "ptz_logs" does not exist`  
✅ **Solution**: Migration adds 9 missing columns to `ptz_logs` table

## Run Migration - Choose One:

### Option A: Local Database (Windows PowerShell)
```powershell
$env:DATABASE_URL = "postgresql://postgres:admin@localhost:5432/Camera_api"
node scripts/run-ptz-migration.js
```

### Option B: Production Database (via SSH/Docker)
```bash
# SSH to server, then:
docker exec -it camera-api-container /bin/sh
export DATABASE_URL="your-production-url"
node scripts/run-ptz-migration.js
```

### Option C: Direct SQL
```sql
-- Connect to database, then run:
\i migrations/002_update_ptz_logs_schema.sql
```

## Verify Success
```sql
-- Should show 17 columns including command_code, param1-3, speed, vector_*, duration_ms
SELECT column_name FROM information_schema.columns 
WHERE table_name = 'ptz_logs';
```

## Test PTZ
```bash
# Restart app, then test:
curl -X POST http://localhost:3000/api/ptz/CAMERA_ID/control \
  -H "Authorization: Bearer TOKEN" \
  -d '{"action":"PAN_RIGHT","speed":5,"duration":1500}'
```

## Files
- 📄 `migrations/002_update_ptz_logs_schema.sql` - Migration
- 🤖 `scripts/run-ptz-migration.js` - Auto runner
- 📖 `migrations/DEPLOYMENT_GUIDE.md` - Full docs

---
**Status**: ✅ Tested on local DB, ready for production
