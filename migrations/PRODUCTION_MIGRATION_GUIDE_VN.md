# 🚨 HƯỚNG DẪN MIGRATE DATABASE PRODUCTION

## Vấn Đề Hiện Tại
- ❌ Database production chưa có các cột: `command_code`, `param1-3`, `speed`, `vector_pan/tilt/zoom`, `duration_ms`
- ❌ App production bị crash khi chạy PTZ commands
- ❌ Không thể kết nối database từ máy local (internal network)

## Giải Pháp: Chạy Migration Từ Production Server

### Cách 1: Sử dụng Coolify Console (Nhanh Nhất) ⭐

1. **Vào Coolify Dashboard**
   - Mở: https://coolify.teknix.services (hoặc URL Coolify của bạn)
   - Login với tài khoản admin

2. **Vào Container Console**
   - Chọn project/app: `camera-api`
   - Click vào tab **"Terminal"** hoặc **"Console"**
   - Hoặc click nút **"Execute Command"**

3. **Chạy Migration**
   ```bash
   # Trong terminal của container
   cd /app
   
   # Kiểm tra file migration có chưa
   ls -la migrations/002_update_ptz_logs_schema.sql
   
   # Chạy migration
   node scripts/run-ptz-migration.js
   ```

4. **Restart App**
   - Quay lại Coolify dashboard
   - Click **"Restart"** container

---

### Cách 2: SSH Vào Server (Nếu Có Quyền SSH)

```bash
# 1. SSH vào server Coolify
ssh user@your-coolify-server.com

# 2. Tìm container ID
docker ps | grep camera-api

# 3. Vào container
docker exec -it <container-id> /bin/sh

# 4. Chạy migration
cd /app
node scripts/run-ptz-migration.js

# 5. Exit và restart
exit
docker restart <container-id>
```

---

### Cách 3: Deploy Lại App (Tự Động Chạy Migration)

**Nếu file migration đã được commit vào git:**

1. **Kiểm tra file đã commit chưa:**
   ```powershell
   git status
   git add migrations/002_update_ptz_logs_schema.sql
   git add scripts/run-ptz-migration.js
   git commit -m "Add PTZ logs schema migration"
   git push
   ```

2. **Trigger Redeploy trên Coolify:**
   - Vào Coolify dashboard
   - Click **"Redeploy"** hoặc **"Force Rebuild"**
   - Coolify sẽ pull code mới và deploy

3. **⚠️ NHƯNG** script `run-migrations-prod.js` chỉ chạy TypeORM migrations
   - Cần update script để chạy cả SQL migrations

---

### Cách 4: Chạy SQL Trực Tiếp Qua Database UI (Nếu Có)

Nếu Coolify có expose database ra ngoài hoặc có pgAdmin:

1. Connect vào database production
2. Mở file `migrations/002_update_ptz_logs_schema.sql`
3. Copy toàn bộ SQL
4. Paste và Execute trong database UI
5. Restart app từ Coolify

---

## ✅ Sau Khi Migration Xong

### Kiểm Tra Migration Thành Công:

Vào container terminal và chạy:
```bash
# Kết nối vào database
node -e "
const { Client } = require('pg');
const client = new Client({ connectionString: process.env.DATABASE_URL });
client.connect().then(() => {
  return client.query(\`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'ptz_logs' 
    ORDER BY ordinal_position
  \`);
}).then(result => {
  console.log('Columns in ptz_logs:');
  result.rows.forEach(r => console.log('  -', r.column_name));
  client.end();
});
"
```

Phải thấy các cột:
- ✅ command_code
- ✅ param1, param2, param3
- ✅ speed, vector_pan, vector_tilt, vector_zoom
- ✅ duration_ms

### Test PTZ Command:

```bash
curl -X POST https://camera-api.teknix.services/cameras/<camera-id>/ptz/control \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"action":"PAN_RIGHT","speed":5,"duration":1500}'
```

Không còn lỗi `column "command_code" does not exist`!

---

## 🔄 Update Script Start để Auto-Run SQL Migrations

Để migration tự động chạy khi deploy, cần update `scripts/run-migrations-prod.js`:

```javascript
// Thêm vào cuối file
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

async function runSQLMigrations() {
  const sqlDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(sqlDir).filter(f => f.endsWith('.sql'));
  
  if (files.length === 0) return;
  
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  
  for (const file of files.sort()) {
    console.log(`Running SQL migration: ${file}`);
    const sql = fs.readFileSync(path.join(sqlDir, file), 'utf8');
    await client.query(sql);
  }
  
  await client.end();
}

// Chạy sau TypeORM migrations
runSQLMigrations().catch(console.error);
```

---

## 💡 Khuyến Nghị

**Nhanh nhất:** Dùng **Cách 1** - Coolify Console
- Không cần SSH
- Chạy trực tiếp trong container
- Restart dễ dàng

**Lâu dài:** Update script để auto-run khi deploy
- Commit migration files
- Update `run-migrations-prod.js`
- Mọi lần deploy sẽ tự động migrate

---

Bạn muốn tôi hướng dẫn chi tiết cách nào?
