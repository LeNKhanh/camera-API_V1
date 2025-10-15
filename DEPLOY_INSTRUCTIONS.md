# 🚀 HƯỚNG DẪN DEPLOY MIGRATION LÊN PRODUCTION

## ✅ ĐÃ HOÀN THÀNH
- ✅ Tạo migration SQL: `002_update_ptz_logs_schema.sql`
- ✅ Update script tự động: `run-migrations-prod.js`
- ✅ Test thành công trên local database
- ✅ Commit tất cả files

## 📋 BƯỚC TIẾP THEO - DEPLOY LÊN PRODUCTION

### Bước 1: Push Code Lên GitHub (Nếu Chưa)
```powershell
git push origin main
```

### Bước 2: Deploy Trên Coolify

#### Cách A: Auto Deploy (Nếu Coolify đã setup auto-deploy)
1. Coolify sẽ tự động detect commit mới
2. Tự động pull code và rebuild
3. Migration sẽ chạy tự động khi container start (vì `npm run start` → `run-migrations-prod.js`)

#### Cách B: Manual Deploy
1. Vào **Coolify Dashboard**: https://coolify.teknix.services
2. Chọn app: **camera-api**
3. Click nút **"Redeploy"** hoặc **"Force Rebuild"**
4. Chờ build xong (có thể mất 2-5 phút)
5. Xem logs để verify migration chạy thành công

---

## 📊 XEM LOGS KHI DEPLOY

Trong Coolify logs, bạn sẽ thấy:

```
🔄 Running database migrations...
📍 Using DATABASE_URL from environment

1️⃣  Running TypeORM migrations...
✅ TypeORM migrations completed

2️⃣  Running SQL migrations...
📄 Found 2 SQL migration file(s)
✅ Connected to database
⚡ Running SQL migration: 001_add_onvif_port.sql
⏭️  Skipping 001_add_onvif_port.sql (already executed)
⚡ Running SQL migration: 002_update_ptz_logs_schema.sql
✅ 002_update_ptz_logs_schema.sql completed
✅ All SQL migrations completed

🎉 All migrations completed successfully!
```

**Nếu thấy messages này → Migration thành công!** ✅

---

## ✅ VERIFY MIGRATION THÀNH CÔNG

### Cách 1: Qua Coolify Terminal
1. Vào Coolify → App → **Terminal**
2. Chạy lệnh:
```bash
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  return client.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'ptz_logs\' ORDER BY ordinal_position');
}).then(result => {
  console.log('Columns in ptz_logs:');
  result.rows.forEach(r => console.log('  -', r.column_name));
  client.end();
});
"
```

**Phải thấy các cột:**
- ✅ command_code
- ✅ param1, param2, param3
- ✅ speed
- ✅ vector_pan, vector_tilt, vector_zoom
- ✅ duration_ms

### Cách 2: Test PTZ Command
```bash
curl -X POST https://camera-api.teknix.services/cameras/<camera-id>/ptz/control \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"PAN_RIGHT","speed":5,"duration":1500}'
```

**Kết quả mong đợi:**
- ✅ Status code 200/201
- ✅ Không còn lỗi "column command_code does not exist"
- ✅ PTZ command được log vào database

---

## 🔧 NẾU GẶP VẤN ĐỀ

### Vấn Đề 1: Migration Không Chạy
**Triệu chứng:** Không thấy log migration trong Coolify logs

**Giải pháp:**
```bash
# Vào Terminal trong Coolify
cd /app
node scripts/run-migrations-prod.js
```

### Vấn Đề 2: Lỗi "Migration Already Executed"
**Không phải lỗi!** Migration script đã được thiết kế idempotent - có thể chạy nhiều lần an toàn.

### Vấn Đề 3: Vẫn Còn Lỗi PTZ
**Nguyên nhân:** App chưa restart sau migration

**Giải pháp:**
1. Vào Coolify Dashboard
2. Click **"Restart"** container
3. Hoặc chạy: `docker restart <container-name>`

### Vấn Đề 4: Không Thể Kết Nối Database
**Kiểm tra:**
```bash
# Trong container terminal
echo $DATABASE_URL
# Phải có giá trị: postgres://postgres:admin@nco8w4ccgskss8ccgwg0ggk4:5432/Camera_api
```

---

## 📝 CHECKLIST DEPLOY

### Trước Khi Deploy
- [x] Code đã commit
- [ ] Code đã push lên GitHub
- [ ] Đã backup database production (nếu cần)

### Trong Lúc Deploy
- [ ] Trigger deploy trên Coolify
- [ ] Xem logs để verify migration chạy
- [ ] Kiểm tra không có error trong logs

### Sau Khi Deploy
- [ ] Verify columns mới đã có trong database
- [ ] Test PTZ command
- [ ] Kiểm tra logs không còn lỗi "command_code"
- [ ] Test với nhiều cameras khác nhau

---

## 🎯 KẾT QUẢ MONG ĐỢI

Sau khi deploy thành công:

✅ **Database được update**
- Bảng `ptz_logs` có đủ 17 columns
- Có bảng `sql_migrations` track migrations đã chạy

✅ **PTZ Commands hoạt động**
- Không còn lỗi crash
- Logs được ghi đầy đủ với command_code, params, vectors

✅ **Production ổn định**
- App không crash
- PTZ API responses nhanh và chính xác

---

## 📞 HỖ TRỢ

Nếu gặp vấn đề, check:
1. Coolify logs: Xem chi tiết lỗi migration
2. App logs: Xem lỗi runtime
3. Database logs: Xem SQL errors

File tài liệu:
- `migrations/PRODUCTION_MIGRATION_GUIDE_VN.md` - Hướng dẫn chi tiết
- `migrations/README_PTZ_MIGRATION.md` - Technical details
- `migrations/DEPLOYMENT_GUIDE.md` - English version

---

**Tác giả:** GitHub Copilot  
**Ngày tạo:** 15/10/2025  
**Status:** ✅ Ready to Deploy
