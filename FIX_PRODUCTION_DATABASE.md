# 🔧 SỬA LỖI DATABASE PRODUCTION

## 📋 TÓM TẮT VẤN ĐỀ

**Lỗi hiện tại:**
```
QueryFailedError: column "command_code" of relation "ptz_logs" does not exist
```

**Nguyên nhân:**
- Database production được tạo với schema CŨ (thiếu 9 cột trong `ptz_logs`)
- Source code đã được update với schema MỚI  
- TypeORM migration `1700000000000-initial-schema.ts` đã được fix với schema đầy đủ
- Nhưng production database đã tồn tại → Cần migration để bổ sung

---

## ✅ ĐÃ GIẢI QUYẾT

### 1. Fix Initial Schema ✅
File: `src/migrations/1700000000000-initial-schema.ts`
- Đã cập nhật schema `ptz_logs` với đầy đủ 14 cột
- Đổi `ILoginID` từ `varchar(64)` → `uuid`
- Database mới sẽ được tạo đúng ngay từ đầu

### 2. Tạo Migration Cho Production ✅
File: `migrations/002_update_ptz_logs_schema.sql`
- Migration SQL để update database cũ
- Thêm 9 cột bị thiếu
- Safe để chạy (idempotent)

---

## 🚀 CÁCH SỬA PRODUCTION

### ⚠️ QUAN TRỌNG
Database production **không thể kết nối từ máy local** (internal network).  
Phải chạy migration **TRỰC TIẾP trên production server**.

### Cách 1: Qua Coolify Console (KHUYẾN NGHỊ) ⭐

#### Bước 1: Truy cập Coolify Console
1. Vào **Coolify Dashboard**: https://coolify.teknix.services
2. Chọn app: **camera-api.teknix.services**
3. Click tab **"Terminal"** hoặc **"Console"**

#### Bước 2: Chạy Migration SQL
Trong terminal của container, chạy:

```bash
cd /app

# Xem file migration có chưa
ls -la migrations/002_update_ptz_logs_schema.sql

# Chạy migration bằng Node.js
node -e "
const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: process.env.DATABASE_URL });

client.connect()
  .then(() => {
    console.log('✅ Connected to database');
    const sql = fs.readFileSync('migrations/002_update_ptz_logs_schema.sql', 'utf8');
    return client.query(sql);
  })
  .then(() => {
    console.log('✅ Migration completed successfully!');
    return client.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'ptz_logs\' ORDER BY ordinal_position');
  })
  .then(result => {
    console.log('Columns in ptz_logs:');
    result.rows.forEach(r => console.log('  -', r.column_name));
    client.end();
  })
  .catch(err => {
    console.error('❌ Error:', err.message);
    client.end();
  });
"
```

#### Bước 3: Restart App
Quay lại Coolify dashboard, click **"Restart"** container.

---

### Cách 2: Deploy Lại App (Đơn Giản Hơn) 🔄

Nếu bạn đã commit code mới:

#### Bước 1: Push Code
```powershell
git push origin main
```

#### Bước 2: Redeploy
1. Vào Coolify Dashboard
2. Click **"Redeploy"** hoặc **"Force Rebuild"**
3. Chờ build xong

#### Bước 3: Chạy Migration Trong Container
Sau khi deploy xong, vào Terminal trong Coolify:
```bash
cd /app
node -e "
const { Client } = require('pg');
const fs = require('fs');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => fs.readFileSync('migrations/002_update_ptz_logs_schema.sql', 'utf8'))
  .then(sql => client.query(sql))
  .then(() => { console.log('✅ Migration OK!'); client.end(); })
  .catch(err => { console.error('❌ Error:', err.message); client.end(); });
"
```

#### Bước 4: Restart
Click **"Restart"** container.

---

### Cách 3: SSH Vào Server (Nếu Có SSH Access)

```bash
# 1. SSH vào server
ssh user@your-server.com

# 2. Tìm container
docker ps | grep camera-api

# 3. Vào container
docker exec -it <container-id> /bin/sh

# 4. Chạy migration (như Cách 1)

# 5. Restart
docker restart <container-id>
```

---

## ✅ XÁC NHẬN THÀNH CÔNG

### 1. Kiểm Tra Schema
```bash
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect()
  .then(() => client.query('SELECT column_name FROM information_schema.columns WHERE table_name = \'ptz_logs\' ORDER BY ordinal_position'))
  .then(result => {
    console.log('Columns in ptz_logs:');
    result.rows.forEach(r => console.log('  -', r.column_name));
    const cols = result.rows.map(r => r.column_name);
    const required = ['command_code', 'param1', 'param2', 'param3', 'speed', 'vector_pan', 'vector_tilt', 'vector_zoom', 'duration_ms'];
    const missing = required.filter(c => !cols.includes(c));
    if (missing.length === 0) {
      console.log('\\n✅ All required columns are present!');
    } else {
      console.log('\\n❌ Missing columns:', missing.join(', '));
    }
    client.end();
  });
"
```

**Phải thấy tất cả các cột:**
- ✅ id
- ✅ ILoginID
- ✅ nChannelID
- ✅ action
- ✅ command_code ← MỚI
- ✅ speed ← MỚI
- ✅ vector_pan ← MỚI
- ✅ vector_tilt ← MỚI
- ✅ vector_zoom ← MỚI
- ✅ duration_ms ← MỚI
- ✅ param1 ← MỚI
- ✅ param2 ← MỚI
- ✅ param3 ← MỚI
- ✅ created_at

### 2. Test PTZ Command
```bash
curl -X POST https://camera-api.teknix.services/cameras/<camera-id>/ptz/control \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"PAN_RIGHT","speed":5,"duration":1500}'
```

**Kết quả mong đợi:**
- ✅ Status code: 200 hoặc 201
- ✅ Response không có lỗi
- ✅ PTZ command được thực thi
- ✅ Log được ghi vào database

### 3. Kiểm Tra Logs
Xem app logs trong Coolify - **không còn lỗi** `column "command_code" does not exist`

---

## 📝 LƯU Ý

### Database Mới (Fresh Install)
- ✅ Không cần migration
- ✅ `1700000000000-initial-schema.ts` đã có schema đầy đủ
- ✅ Chỉ cần chạy `npm run start` → auto migrate

### Database Cũ (Production Hiện Tại)
- ⚠️ Cần chạy `002_update_ptz_logs_schema.sql`
- ⚠️ Phải chạy TRONG production container
- ⚠️ Sau đó restart app

### Tương Lai
- ✅ Mọi deployment mới sẽ có schema đúng ngay từ đầu
- ✅ Không cần lo migration nữa (trừ khi thay đổi schema)

---

## 🆘 TROUBLESHOOTING

### Lỗi: "Cannot connect to database"
- Check `DATABASE_URL` trong container: `echo $DATABASE_URL`
- Phải có giá trị: `postgres://postgres:admin@nco8w4ccgskss8ccgwg0ggk4:5432/Camera_api`

### Lỗi: "Migration file not found"
- Check file exists: `ls -la migrations/002_update_ptz_logs_schema.sql`
- Nếu không có → code chưa được pull đúng → Redeploy

### Lỗi: "Foreign key constraint cannot be implemented"
- Có thể có dữ liệu cũ không hợp lệ
- Migration script đã xử lý (xóa orphaned records)
- Nếu vẫn lỗi → backup data → drop table → recreate

### App Vẫn Lỗi Sau Migration
- **Chắc chắn đã restart app** sau migration
- Check logs xem migration có chạy không
- Verify schema bằng script ở trên

---

## 📞 HỖ TRỢ

- File migration: `migrations/002_update_ptz_logs_schema.sql`
- Initial schema: `src/migrations/1700000000000-initial-schema.ts`
- Docs chi tiết: `migrations/README_PTZ_MIGRATION.md`

**Ngày cập nhật:** 15/10/2025  
**Status:** ✅ Tested & Ready
