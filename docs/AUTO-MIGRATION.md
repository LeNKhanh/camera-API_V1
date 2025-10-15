# 🚀 AUTO-MIGRATION SETUP

## ✅ Đã Setup Tự Động Chạy Migrations

### Cách hoạt động:

Khi deploy trên Coolify, app sẽ tự động:

1. **Build** code
2. **Chạy migrations** (tạo/cập nhật database tables)
3. **Start** app

---

## 📋 Files đã tạo/cập nhật:

### 1. `scripts/run-migrations-prod.js`
Script tự động chạy TypeORM migrations trong production.

### 2. `package.json`
Updated `start` script:
```json
{
  "scripts": {
    "start": "node scripts/run-migrations-prod.js && node dist/main.js"
  }
}
```

---

## 🔧 Coolify Configuration

### Build Command:
```bash
npm install && npm run build
```

### Start Command:
```bash
npm start
```

**HOẶC** (nếu muốn tường minh):
```bash
node scripts/run-migrations-prod.js && node dist/main.js
```

---

## 📊 Migration Flow

```
┌─────────────────────┐
│   Coolify Deploy    │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   npm run build     │ (Compile TypeScript)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   npm start         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────────────────────┐
│ scripts/run-migrations-prod.js      │
│                                     │
│ 1. Read DATABASE_URL from env      │
│ 2. Run TypeORM migrations          │
│ 3. Create/Update tables            │
│    - users                          │
│    - cameras                        │
│    - ptz_logs                       │
│    - recordings                     │
│    - snapshots                      │
│    - events                         │
│    - playbacks                      │
│ 4. Exit if error                   │
└──────────┬──────────────────────────┘
           │
           ▼
┌─────────────────────┐
│  node dist/main.js  │ (Start NestJS app)
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   App Running ✅    │
│   Port: 3000        │
└─────────────────────┘
```

---

## 🧪 Test Locally

### Test migration script:
```powershell
# Build first
npm run build

# Run migrations
npm run migration:run:prod

# Should see:
# 🔄 Running database migrations...
# 📍 Using DATABASE_URL from environment
# ✅ Migrations completed successfully
```

### Test full start:
```powershell
npm start

# Should see:
# 🔄 Running database migrations...
# ✅ Migrations completed successfully
# ✅ Camera API listening on http://localhost:3000
```

---

## 🔍 Troubleshooting

### Error: "relation 'users' does not exist"
**Cause:** Migrations haven't run yet.

**Solution:** Migrations will auto-run on next deploy.

---

### Error: "Migration failed"
**Check:**
1. DATABASE_URL is correct in Coolify environment variables
2. Database is accessible from app
3. `dist/data-source.js` exists (build completed)

**Logs to check:**
```
🔄 Running database migrations...
📍 Using DATABASE_URL from environment
```

---

### Error: "Cannot find module 'dist/data-source.js'"
**Cause:** Build didn't complete or dist folder missing.

**Solution:** 
```bash
npm run build
npm start
```

---

## ⚙️ Environment Variables Required

```
DATABASE_URL=postgres://postgres:admin@nco8w4ccgskss8ccgwg0ggk4:5432/Camera_api
```

**Note:** All other DB_* variables (DB_HOST, DB_PORT, etc.) are now optional if DATABASE_URL is set.

---

## 📝 Migration Files Location

All migrations are in: `src/migrations/`

Example:
- `1759301000000-alter-ptz-logs-loginid-channel.ts`
- Future migrations will be auto-generated here

---

## 🎯 Next Deploy Steps

1. ✅ Commit changes:
   ```bash
   git add .
   git commit -m "feat: Add auto-migration on startup"
   git push
   ```

2. ✅ Coolify will:
   - Pull new code
   - Run `npm install && npm run build`
   - Run `npm start`
   - Migrations auto-run
   - App starts

3. ✅ Check logs:
   - Should see "✅ Migrations completed successfully"
   - Then "✅ Camera API listening..."

4. ✅ Test register endpoint:
   ```
   POST https://camera-api.teknix.services/auth/register
   
   Body:
   {
     "username": "operator12",
     "password": "operator123",
     "role": "OPERATOR"
   }
   ```

   **Expected:** 201 Created ✅

---

## 🔐 Security Note

Migrations run automatically on **every restart**. This is safe because:

- ✅ TypeORM tracks which migrations have run
- ✅ Already-run migrations are skipped
- ✅ Only new migrations execute
- ✅ Idempotent - safe to run multiple times

---

## 🚀 Ready to Deploy!

Bây giờ chỉ cần:

```bash
git add .
git commit -m "feat: Auto-run migrations on startup"
git push
```

Coolify sẽ tự động:
1. Build
2. Run migrations
3. Start app

**Database tables sẽ được tạo tự động!** 🎉
