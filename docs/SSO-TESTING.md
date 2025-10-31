# Hướng dẫn Test SSO Authentication

## Tổng quan

Hệ thống đã được cấu hình để sử dụng SSO (Single Sign-On) thay vì JWT token tự sinh. Khi SSO được bật, API sẽ:

1. **Chấp nhận Bearer token từ SSO provider** thay vì tự sinh token
2. **Tự động tạo user** trong database khi user đăng nhập lần đầu
3. **Sử dụng `.sub` claim làm userId** (primary key trong bảng users)
4. **Vô hiệu hóa local login** (`/auth/login`, `/auth/refresh`, `/auth/logout`)

## Cấu hình môi trường Deploy

### Biến môi trường bắt buộc

Thêm các biến sau vào môi trường deploy (Coolify/Docker):

```bash
SSO_API_KEY=43e57ec4-6ec8-4bac-8114-837215556571
SSO_CLIENT_ID=Watcher
SSO_DEFAULT_ROLE=ADMIN
```

### Biến môi trường tùy chọn

Nếu SSO provider có introspection endpoint để validate token:

```bash
SSO_INTROSPECT_URL=https://your-sso-server.com/introspect
```

**Lưu ý:** 
- Nếu có `SSO_INTROSPECT_URL`: Guard sẽ gọi endpoint này để validate token (khuyến nghị cho production)
- Nếu không có: Guard sẽ decode JWT mà không verify signature (chỉ dùng cho dev/testing)

## Test trên môi trường Deploy

### Bước 1: Lấy Access Token từ SSO

Lấy access token từ SSO provider. Token phải chứa claim:

```json
{
  "sub": "b6514cad-77d8-4134-80a8-d06bf8644d39",
  "username": "your-username",
  "aud": "Watcher",  // hoặc azp, client_id
  ...
}
```

### Bước 2: Test API với Bearer Token

#### Test endpoint cameras (đọc danh sách camera)

```bash
curl https://your-deploy-url.com/cameras \
  -H "Authorization: Bearer YOUR_SSO_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

#### Test endpoint cameras/list (tương tự)

```bash
curl https://your-deploy-url.com/cameras/list \
  -H "Authorization: Bearer YOUR_SSO_TOKEN_HERE"
```

#### Test tạo camera mới

```bash
curl -X POST https://your-deploy-url.com/cameras \
  -H "Authorization: Bearer YOUR_SSO_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test Camera SSO",
    "ip": "192.168.1.100",
    "port": 554,
    "username": "admin",
    "password": "admin123",
    "path": "/Streaming/Channels/101"
  }'
```

### Bước 3: Kiểm tra User được tạo tự động

Sau lần đầu gọi API thành công, kiểm tra database:

```sql
SELECT * FROM users WHERE id = 'b6514cad-77d8-4134-80a8-d06bf8644d39';
```

**Kết quả mong đợi:**
```
| id                                   | username      | role  | passwordHash | createdAt           |
|--------------------------------------|---------------|-------|--------------|---------------------|
| b6514cad-77d8-4134-80a8-d06bf8644d39 | your-username | ADMIN | (empty)      | 2025-10-31 10:00:00 |
```

**Lưu ý:**
- `id` = `.sub` từ SSO token
- `passwordHash` = rỗng (SSO users không có local password)
- `role` = `SSO_DEFAULT_ROLE` hoặc từ token claim `role`/`roles`

## Test với Postman/Hoppscotch

### 1. Import Collection

Create new request:
- **Method**: GET
- **URL**: `https://your-deploy-url.com/cameras`
- **Headers**:
  - `Authorization`: `Bearer YOUR_SSO_TOKEN_HERE`
  - `Content-Type`: `application/json`

### 2. Test tất cả endpoints

Thử các endpoint sau:

| Method | Endpoint | Mô tả |
|--------|----------|-------|
| GET | `/cameras` | Danh sách cameras |
| GET | `/events` | Danh sách events |
| GET | `/playbacks` | Danh sách playbacks |
| GET | `/recordings` | Danh sách recordings |
| GET | `/snapshots` | Danh sách snapshots |
| GET | `/streams/:id` | Stream info |

**Tất cả endpoints yêu cầu ADMIN role** (theo cấu hình RBAC hiện tại).

## Xử lý lỗi phổ biến

### Lỗi: `401 Unauthorized - Missing Authorization header`

**Nguyên nhân:** Thiếu Bearer token trong header.

**Giải pháp:**
```bash
-H "Authorization: Bearer YOUR_TOKEN_HERE"
```

### Lỗi: `401 Unauthorized - SSO token missing sub claim`

**Nguyên nhân:** Token không chứa claim `.sub`.

**Giải pháp:** Kiểm tra token từ SSO provider phải có `.sub` claim.

### Lỗi: `401 Unauthorized - Token audience/client mismatch for SSO`

**Nguyên nhân:** Token không chứa `aud` hoặc `azp` = `Watcher` (SSO_CLIENT_ID).

**Giải pháp:** 
- Kiểm tra token có claim `aud`, `azp`, hoặc `client_id` = `Watcher`
- Hoặc điều chỉnh `SSO_CLIENT_ID` trong env

### Lỗi: `401 Unauthorized - Invalid or expired token`

**Nguyên nhân:** 
- Token đã hết hạn (expired)
- Token không hợp lệ (invalid signature)
- SSO introspection endpoint trả về `active: false`

**Giải pháp:** Lấy token mới từ SSO provider.

### Lỗi: `501 Not Implemented - SSO is enabled`

**Nguyên nhân:** Đang cố gọi `/auth/login` local khi SSO đã bật.

**Giải pháp:** Không sử dụng local login nữa, chỉ dùng SSO tokens.

## Debug Mode

Để xem chi tiết validation process, enable debug logs:

```bash
# Thêm vào .env
NODE_ENV=development
```

Logs sẽ hiển thị:
- Token được decode
- Claims được extract
- User được tạo/update
- Validation errors

## Tắt SSO (quay lại Local JWT)

Nếu muốn tắt SSO và quay lại local JWT mode:

```bash
# Xóa hoặc comment biến SSO_API_KEY
# SSO_API_KEY=43e57ec4-6ec8-4bac-8114-837215556571
```

Sau đó restart service. Local login `/auth/login` sẽ hoạt động trở lại.

## Flow tổng quát

```
1. Client lấy token từ SSO Provider
   └─> Token chứa: { "sub": "uuid", "aud": "Watcher", ... }

2. Client gọi API với Bearer token
   └─> Authorization: Bearer <SSO_TOKEN>

3. JwtAuthGuard validate token:
   ├─> Nếu có SSO_INTROSPECT_URL: POST to introspection endpoint
   └─> Nếu không: Decode JWT và check audience/client

4. Guard extract claims.sub làm userId

5. Guard auto-provision user:
   ├─> Check user exists (id = claims.sub)
   ├─> Nếu không có: Create user với id=sub, role=ADMIN
   └─> Nếu có: Skip (hoặc update username/role)

6. Attach user to request: req.user = { userId: sub, ... }

7. Controller xử lý request với req.user.userId
```

## Checklist triển khai Production

- [ ] Set `SSO_API_KEY` trong environment variables
- [ ] Set `SSO_CLIENT_ID=Watcher`
- [ ] Set `SSO_DEFAULT_ROLE=ADMIN` (hoặc role mong muốn)
- [ ] (Khuyến nghị) Set `SSO_INTROSPECT_URL` nếu có
- [ ] Deploy và restart service
- [ ] Test với SSO token thật
- [ ] Verify user được tạo trong database
- [ ] Kiểm tra logs không có errors
- [ ] Test tất cả endpoints quan trọng
- [ ] Document SSO token endpoint cho frontend team
- [ ] Notify users về việc chuyển sang SSO

## Liên hệ

Nếu gặp vấn đề khi test SSO, cung cấp các thông tin sau:
- Environment variables đã set (ẩn sensitive values)
- Token payload (decode tại jwt.io, ẩn sensitive claims)
- Error message từ API
- Logs từ server
