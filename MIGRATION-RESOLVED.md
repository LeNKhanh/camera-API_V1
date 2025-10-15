# ✅ Migration Issue - RESOLVED

## 🎯 Problem Summary

**Original Issue:**
```
column "sdk_port" of relation "cameras" already exists
```

**Root Cause:**
- Initial schema (`1700000000000-initial-schema.ts`) creates ALL tables with ALL columns
- 12 auto-generated migrations tried to ALTER tables and ADD columns that already existed
- Conflict: Initial schema creates `sdk_port`, then auto-migration tries to `ADD COLUMN sdk_port` again

---

## 🔧 Solution Applied

### 1. Migration Cleanup
**Deleted 12 redundant migrations:**
```
❌ 1758794190088-auto-migration.ts
❌ 1758799000000-add-refresh-columns-and-ptzlogs.ts
❌ 1758800000000-dahua-only.ts
❌ 1759201702915-auto-migration.ts
❌ 1759291221846-auto-migration.ts
❌ 1759300000000-add-camera-channel.ts
❌ 1759301000000-alter-ptz-logs-loginid-channel.ts
❌ 1759400000000-add-ptz-command-code.ts
❌ 1759401000000-add-ptz-params.ts
❌ 1759402000000-add-ptz-logs-fk.ts
❌ 1759403000000-add-events-nchannel.ts
❌ 1759404000000-create-playbacks-table.ts
```

**Kept 1 comprehensive migration:**
```
✅ 1700000000000-initial-schema.ts
   - Creates ALL 7 tables
   - Includes ALL current columns
   - Uses CREATE TABLE IF NOT EXISTS (idempotent)
   - Creates all indexes
   - Sets up all foreign keys
```

### 2. Build Process Enhancement
**Created `scripts/build-migrations.js`:**
- Automatically compiles TypeScript migrations to JavaScript
- Ensures migrations are always available in `dist/` folder
- Integrated into `npm run build` workflow

**Updated `package.json`:**
```json
{
  "scripts": {
    "build": "nest build && npm run build:migrations",
    "build:migrations": "node scripts/build-migrations.js"
  }
}
```

### 3. Database Reset Tool
**Created `scripts/reset-database.js`:**
- Drops all tables (including migrations table)
- Reruns migrations from clean slate
- Useful for development and troubleshooting

---

## 📊 Final State

### Source Files (src/migrations/)
```
✅ 1700000000000-initial-schema.ts (ONLY)
```

### Compiled Files (dist/migrations/)
```
✅ 1700000000000-initial-schema.js
✅ 1700000000000-initial-schema.d.ts
```

### Database Tables Created
```sql
✅ users (with refresh token columns)
✅ cameras (with sdk_port, onvif_port, channel)
✅ ptz_logs (with ILoginID, nChannelID, camera_id FK)
✅ recordings (with camera_id FK)
✅ snapshots (with camera_id FK)
✅ events (with camera_id FK)
✅ playbacks (with recording_id, user_id FKs)
```

### Indexes Created
```sql
✅ IDX_cameras_ip
✅ IDX_cameras_enabled
✅ IDX_ptz_logs_camera
✅ IDX_ptz_logs_created
✅ IDX_recordings_camera
✅ IDX_recordings_status
✅ IDX_snapshots_camera
✅ IDX_events_camera
✅ IDX_events_type
```

---

## ✅ Verification Results

### Local Testing
```bash
✅ npm run build
   - NestJS build successful
   - Migrations compiled to dist/
   
✅ node scripts/reset-database.js
   - All tables dropped
   - InitialSchema1700000000000 executed successfully
   - All 7 tables created
   - All indexes created
   
✅ npm start
   - Migrations: No pending (already run)
   - Server: Started on 0.0.0.0:3000
   - Routes: All mapped correctly
```

---

## 🚀 Ready for Production

### What Changed
1. **Migrations:** 13 files → 1 file
2. **Schema:** Comprehensive initial schema (all current entities)
3. **Build:** Automatic migration compilation
4. **Startup:** Auto-migration enabled

### What Happens on Coolify Deployment
```bash
# Coolify Build Process
npm install                    # Install dependencies
npm run build                  # Build + compile migrations
npm start                      # Run migrations + start app

# Migration Output (Expected)
🔄 Running database migrations...
📍 Using DATABASE_URL from environment
1 migrations were found in the source code.
1 migrations are new migrations must be executed.
✅ Migration InitialSchema1700000000000 executed successfully

# App Startup
Camera API listening on http://localhost:3000
Server running on 0.0.0.0:3000
```

### Next Steps
1. **Commit changes** to git
2. **Push to repository** → triggers Coolify deployment
3. **Monitor logs** for successful migration
4. **Test /auth/register** endpoint
5. **Verify database** tables exist

---

## 🔮 Future Migrations

When schema changes are needed:

1. **Modify entity** files
2. **Generate migration:** `npm run migration:generate -- src/migrations/descriptive-name`
3. **Review generated SQL** (ensure no conflicts)
4. **Test locally** with `npm run migration:run`
5. **Commit + push** → Coolify auto-deploys

**Timestamp Order:**
```
1700000000000 (initial schema) → runs first
1759500000000 (future migration) → runs second
1759600000000 (another migration) → runs third
```

---

## 📋 Key Files Reference

### Scripts
- `scripts/build-migrations.js` - Compile migrations
- `scripts/run-migrations-prod.js` - Auto-run migrations on startup
- `scripts/reset-database.js` - Reset database (dev only)

### Configuration
- `data-source-prod.js` - TypeORM CLI DataSource (CommonJS)
- `package.json` - Build scripts and dependencies

### Migrations
- `src/migrations/1700000000000-initial-schema.ts` - Complete database schema

### Documentation
- `DEPLOYMENT-CHECKLIST.md` - Deployment guide
- `docs/AUTO-MIGRATION.md` - Migration system docs
- `docs/HOPPSCOTCH-PRODUCTION.md` - API testing guide
- `TEST-STREAM.md` - RTSP streaming guide

---

## 🎉 Issue Status: RESOLVED

**Problem:** Migration conflicts causing deployment failures  
**Solution:** Single comprehensive initial schema  
**Status:** ✅ **READY FOR PRODUCTION DEPLOYMENT**

**Last Updated:** 2025-10-15 14:10 (Vietnam Time)
