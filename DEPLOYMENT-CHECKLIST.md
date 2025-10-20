# 🚀 Deployment Checklist - Coolify

## ✅ Pre-Deployment Cleanup (COMPLETED)

### Migration Cleanup
- ✅ **Deleted** 12 redundant auto-generated migrations
- ✅ **Kept** only `1700000000000-initial-schema.ts` (comprehensive initial schema)
- ✅ **Cleaned** `dist/migrations/` folder (removed old compiled files)
- ✅ **Added** `scripts/build-migrations.js` for automatic migration compilation
- ✅ **Updated** `package.json` build script to compile migrations

### Database Reset
- ✅ **Created** `scripts/reset-database.js` for clean database resets
- ✅ **Tested** database reset successfully (drops all tables, reruns migrations)
- ✅ **Verified** only 1 migration runs: `InitialSchema1700000000000`

### Build Process
- ✅ **Verified** `npm run build` compiles migrations correctly
- ✅ **Tested** `npm start` runs migrations and starts app successfully
- ✅ **Confirmed** all routes mapped correctly

---

## 📦 Ready to Deploy

### Current State
```bash
✅ Build successful: npm run build
✅ Migrations: 1 file (initial schema only)
✅ App starts: npm start (auto-migration + server)
✅ Server: Listening on 0.0.0.0:3000
✅ All routes: Mapped correctly
✅ R2 Storage: Integrated and tested
```

### Files to Commit
```bash
# New/Modified Files
✅ src/migrations/1700000000000-initial-schema.ts (ONLY migration)
✅ scripts/build-migrations.js (NEW - compiles migrations)
✅ scripts/reset-database.js (NEW - for local DB reset)
✅ scripts/run-migrations-prod.js (auto-migration on startup)
✅ data-source-prod.js (CommonJS DataSource for TypeORM CLI)
✅ package.json (updated build script)
✅ src/modules/storage/ (NEW - R2 storage module)
✅ src/modules/snapshot/snapshot.service.ts (updated for R2)
✅ src/modules/recording/recording.service.ts (updated for R2)
✅ docs/COOLIFY-R2-SETUP.md (NEW - production setup guide)

# Deleted Files (confirm deleted)
❌ All 1758*.ts migrations (source files)
❌ All 1759*.ts migrations (source files)
```

---

## 🔑 Coolify Environment Variables Setup

### Required R2 Variables
```bash
# === R2 Storage Configuration ===
R2_ENDPOINT=https://a1000a80a775f57fe92ea14196486a3a.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=0c10ee4c19fe892894a9c5311798a69c
R2_SECRET_ACCESS_KEY=20db186ea3ebb14ba05254a9b82b1f033fef297335ab8d4e7874e90634ca36bb
R2_BUCKET_NAME=iotek
R2_PUBLIC_URL=https://iotek.tn-cdn.net
STORAGE_MODE=r2

# === Database (Coolify format) ===
DATABASE_URL=postgres://postgres:admin@nco8w4ccgskss8ccgwg0ggk4:5432/Camera_api

# === Server ===
PORT=3000
HOST=0.0.0.0
JWT_SECRET=production_secret_key_change_this

# === Stream ===
STREAM_BASE_URL=https://your-production-domain.com/live

# === Directories (Linux paths!) ===
RECORD_DIR=/tmp
SNAPSHOT_DIR=/tmp

# === Production Settings (disable debug) ===
DEBUG_SNAPSHOT=0
PTZ_THROTTLE_DEBUG=0
REFRESH_DEBUG=0
SNAPSHOT_FALLBACK_UDP=1

# === PTZ ===
PTZ_THROTTLE_MS=300
PTZ_USE_ONVIF=0

# === Recording ===
FAKE_RECORD_SIZE=1280x720
FAKE_RECORD_FPS=15
FAKE_RECORD_CODEC=libx264
FAKE_RECORD_QUALITY=23
FAKE_RECORD_REALTIME=0
```

### ⚠️ Critical Differences: Local vs Production

| Variable | Local (Windows) | Production (Coolify/Linux) |
|----------|----------------|---------------------------|
| `RECORD_DIR` | `C:\\tmp` | `/tmp` |
| `SNAPSHOT_DIR` | `C:\\tmp` | `/tmp` |
| `DATABASE_URL` | Commented out | **REQUIRED** |
| `DB_HOST`, `DB_PORT`, etc. | Used | **NOT NEEDED** (use DATABASE_URL) |
| `DEBUG_SNAPSHOT` | `1` (enabled) | `0` (disabled) |
| `JWT_SECRET` | `dev_secret` | Strong production secret |
| `STREAM_BASE_URL` | `localhost:8080` | Production domain |

---

## 🎯 Deployment Steps

### Step 1: Commit Changes
```bash
git add .
git commit -m "fix: Clean migration state - single initial schema for production

- Deleted 12 redundant auto-generated migrations
- Kept only initial schema (1700000000000-initial-schema.ts)
- Added automatic migration compilation (scripts/build-migrations.js)
- Created database reset script for development
- Resolves all 'column already exists' errors
- Tested: build + migrations + app startup all working"

git push origin main
```

### Step 2: Coolify Auto-Deployment
Coolify will automatically:
1. Detect git push
2. Run `npm install`
3. Run `npm run build` (includes migration compilation)
4. Run `npm start`:
   - Execute `scripts/run-migrations-prod.js`
   - Run `InitialSchema1700000000000` migration (creates all tables)
   - Start NestJS app on 0.0.0.0:3000

### Step 3: Monitor Deployment Logs
Watch for these key messages in Coolify logs:

```
✅ Expected Success Messages:
   🔄 Running database migrations...
   📍 Using DATABASE_URL from environment
   1 migrations were found in the source code.
   1 migrations are new migrations must be executed.
   ✅ Migrations completed successfully
   [Nest] Starting Nest application...
   Camera API listening on http://localhost:3000
   Server running on 0.0.0.0:3000
```

```
❌ Error to Watch For:
   column "xxx" already exists
   → Solution: Database not clean, run reset script on Coolify
```

---

## 🧪 Post-Deployment Testing

### Test 1: Health Check
```bash
curl https://camera-api.teknix.services/health
# Expected: 200 OK {"status":"ok"}
```

### Test 2: Register User (Creates DB Entry)
```bash
curl -X POST https://camera-api.teknix.services/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123",
    "role": "ADMIN"
  }'

# Expected: 201 Created
{
  "id": "uuid",
  "username": "admin",
  "role": "ADMIN",
  "created_at": "timestamp"
}
```

### Test 3: Login
```bash
curl -X POST https://camera-api.teknix.services/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "username": "admin",
    "password": "admin123"
  }'

# Expected: 200 OK
{
  "access_token": "jwt...",
  "refresh_token": "jwt..."
}
```

### Test 4: API Documentation
```bash
Open: https://camera-api.teknix.services/docs
# Expected: Swagger UI loads successfully
```

### Test 5: Create Camera
```bash
# Use access_token from login
curl -X POST https://camera-api.teknix.services/cameras \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Camera Channel 2",
    "ip_address": "192.168.1.66",
    "channel": 2,
    "username": "aidev",
    "password": "aidev123",
    "vendor": "dahua"
  }'

# Expected: 201 Created
{
  "id": "uuid",
  "name": "Camera Channel 2",
  "ip_address": "192.168.1.66",
  "channel": 2,
  ...
}
```

---

## 🔧 Troubleshooting

### Issue 1: Migration Error "column already exists"
**Cause:** Old migrations still in database

**Solution A (Recommended - Clean Slate):**
```bash
# On Coolify terminal (if available)
node scripts/reset-database.js
```

**Solution B (Manual):**
```bash
# Connect to database
psql $DATABASE_URL

# Drop all tables
DROP TABLE IF EXISTS migrations, users, cameras, ptz_logs, recordings, snapshots, events, playbacks CASCADE;

# Exit and redeploy
\q
```

### Issue 2: Migration Not Found
**Cause:** Migrations not compiled during build

**Solution:**
```bash
# Check dist/migrations/ folder exists
ls dist/migrations/

# Should contain:
- 1700000000000-initial-schema.js
- 1700000000000-initial-schema.d.ts

# If missing, manually compile:
npm run build:migrations
```

### Issue 3: Database Connection Timeout
**Cause:** DATABASE_URL incorrect or database not accessible

**Solution:**
```bash
# Check environment variables on Coolify
DATABASE_URL=postgres://postgres:admin@HOSTNAME:5432/Camera_api

# Verify hostname is correct internal network hostname
# For Coolify: nco8w4ccgskss8ccgwg0ggk4
```

---

## 📊 Database Schema Verification

After successful deployment, verify tables were created:

```sql
-- Connect to database
psql $DATABASE_URL

-- List all tables
\dt

-- Expected tables:
  users
  cameras
  ptz_logs
  recordings
  snapshots
  events
  playbacks
  migrations

-- Check migrations table
SELECT * FROM migrations;

-- Expected: 1 row
id | timestamp      | name
1  | 1700000000000 | InitialSchema1700000000000

-- Check users table structure
\d users

-- Expected columns:
id, username, password_hash, role, 
refresh_token_hash, refresh_token_exp, 
created_at, updated_at
```

---

## 🎉 Success Criteria

Deployment is successful when:

1. ✅ Coolify build completes without errors
2. ✅ Migration runs successfully (1 migration executed)
3. ✅ App starts and listens on 0.0.0.0:3000
4. ✅ Health endpoint returns 200 OK
5. ✅ Register endpoint creates user successfully
6. ✅ Login endpoint returns JWT tokens
7. ✅ Swagger docs accessible
8. ✅ All 7 database tables exist
9. ✅ Camera creation works with JWT auth

---

## 📋 Environment Variables (Coolify Dashboard)

Required variables already configured:

```env
# Database (CRITICAL - Internal Coolify network)
DATABASE_URL=postgres://postgres:admin@nco8w4ccgskss8ccgwg0ggk4:5432/Camera_api

# Server
PORT=3000
HOST=0.0.0.0

# Security
JWT_SECRET=your-production-secret-here
JWT_EXPIRES_IN=1h
REFRESH_TOKEN_EXPIRES_IN=7d

# Optional
DISABLE_SWAGGER=0  # Keep enabled for testing
NODE_ENV=production
```

---

## 🔄 Future Migration Workflow

When you need to add new fields or tables:

1. **Modify Entity** in `src/typeorm/entities/`
2. **Generate Migration:**
   ```bash
   npm run migration:generate -- src/migrations/descriptive-name
   ```
3. **Review Generated Migration** (ensure no conflicts)
4. **Test Locally:**
   ```bash
   npm run migration:run
   npm start
   ```
5. **Commit & Push** → Coolify auto-deploys
6. **Verify** migration runs on production

**Important:** New migrations will run after `InitialSchema1700000000000` due to timestamp ordering.

---

## 📞 Support Resources

- **Hoppscotch Testing Guide:** `docs/HOPPSCOTCH-PRODUCTION.md`
- **RTSP Streaming Guide:** `TEST-STREAM.md`
- **Auto-Migration Docs:** `docs/AUTO-MIGRATION.md`
- **Camera ID (Working):** `7e53c1d5-1c65-482a-af06-463e0d334517`
- **Production Domain:** `https://camera-api.teknix.services/`

---

**Last Updated:** 2025-10-15  
**Status:** ✅ Ready for Production Deployment
