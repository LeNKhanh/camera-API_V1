# Fix Production Database Schema

## Vấn đề
Production database thiếu các cột trong bảng `ptz_logs`:
- `command_code`
- `speed` 
- `vector_pan`, `vector_tilt`, `vector_zoom`
- `duration_ms`
- `param1`, `param2`, `param3`

Lỗi: `column "command_code" of relation "ptz_logs" does not exist`

## Nguyên nhân
TypeORM migration đã được đánh dấu là "executed" trong bảng `migrations`, nhưng schema thực tế của bảng `ptz_logs` vẫn là version cũ (được tạo trước khi code migration được update).

## Giải pháp

### ✅ CÁCH 1: Thêm các cột thiếu (Khuyến nghị - Giữ data)

Chạy script Node.js trên production:

```bash
node scripts/fix-production-add-columns.js
```

Hoặc chạy SQL trực tiếp:

```bash
psql $DATABASE_URL -f scripts/add-missing-columns-production.sql
```

**Script sẽ:**
- Thêm tất cả các cột thiếu với giá trị mặc định phù hợp
- Kiểm tra và hiển thị schema sau khi update
- **KHÔNG mất data** hiện có trong `ptz_logs`

---

### ⚠️ CÁCH 2: Reset migration (Nếu không có data quan trọng)

**Chỉ dùng nếu:**
- Bảng `ptz_logs` không có data quan trọng
- Muốn schema hoàn toàn mới từ migration

**Bước 1:** Chạy SQL xóa migration record và bảng cũ:

```bash
psql $DATABASE_URL -f scripts/fix-production-schema.sql
```

Hoặc chạy SQL trực tiếp:

```sql
DELETE FROM migrations WHERE name = 'InitialSchema1700000000000';
DROP TABLE IF EXISTS ptz_logs CASCADE;
```

**Bước 2:** Restart app để TypeORM tự chạy lại migration:

```bash
# App sẽ tự detect migration chưa chạy và tạo lại bảng mới
npm run start
```

---

## Kiểm tra sau khi fix

Chạy SQL để xem schema:

```sql
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'ptz_logs'
ORDER BY ordinal_position;
```

Kết quả đúng phải có **14 cột**:
1. id (uuid)
2. ILoginID (uuid) 
3. nChannelID (integer)
4. action (varchar)
5. **command_code** (integer) ✅
6. **speed** (integer) ✅
7. **vector_pan** (integer) ✅
8. **vector_tilt** (integer) ✅
9. **vector_zoom** (integer) ✅
10. **duration_ms** (integer) ✅
11. **param1** (integer) ✅
12. **param2** (integer) ✅
13. **param3** (integer) ✅
14. created_at (timestamp with time zone)

---

## Test PTZ sau khi fix

```bash
# Test PTZ command
curl -X POST http://your-domain/cameras/{cameraId}/ptz \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "action": "PAN_RIGHT",
    "speed": 5,
    "duration": 1000
  }'
```

Không còn lỗi `column "command_code" does not exist` nữa! ✅
