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

# Deleted Files (confirm deleted)
❌ All 1758*.ts migrations (source files)
❌ All 1759*.ts migrations (source files)
```

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
