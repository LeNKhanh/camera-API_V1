# AUTH (Đăng nhập & RBAC)

## Mục tiêu
Quản lý người dùng, đăng ký (dev), đăng nhập JWT, phân quyền vai trò (ADMIN / OPERATOR / VIEWER).

## Các endpoint
| Method | Path | Mô tả |
|--------|------|------|
| POST | /auth/register | (Dev) Tạo user mới kèm role |
| POST | /auth/login | Đăng nhập lấy accessToken + refreshToken |
| POST | /auth/refresh | Lấy cặp access + refresh mới (rotate) (fallback userId từ Bearer nếu body thiếu) |
| POST | /auth/logout | Thu hồi refresh token (revoke) (fallback userId từ Bearer nếu body thiếu) |
| GET  | /users/profile | Thông tin user hiện tại (Bearer) |

## Vai trò
| Role | Quyền chính |
|------|-------------|
| ADMIN | Toàn quyền CRUD cameras, recordings, snapshots, events, users |
| OPERATOR | CRUD camera/snapshot/recording/event (trừ quản lý user)|
| VIEWER | Chỉ GET (xem) |

## Refresh token & Cơ chế
- accessToken: JWT hết hạn ~2h.
- refreshToken: chuỗi random base64url, hash lưu trong DB (cột refresh_token_hash) với hạn refresh_token_exp.
- Mỗi /auth/refresh: cấp token mới & rotate refreshToken (token cũ vô hiệu).
- /auth/logout: xoá hash + exp → không thể refresh nữa.

ENV TTL: REFRESH_TOKEN_TTL_SEC (mặc định 604800 = 7 ngày).

## Rate limit
In-memory guard (dev) giới hạn:
| Endpoint | Limit | Window |
|----------|-------|--------|
| /auth/login | 10 / IP | 60s |
| /auth/refresh | 30 / IP | 60s |
Vượt quá → HTTP 429.

## Test nhanh (PowerShell / curl)
```powershell
# Đăng ký (tùy chọn trong dev)
curl -Method POST -Uri http://localhost:3000/auth/register -Body '{"username":"operator1","password":"op123","role":"OPERATOR"}' -ContentType 'application/json'

# Đăng nhập (nhận cả access + refresh)
$login = curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json'
$loginBody = $login.Content | ConvertFrom-Json
$access = $loginBody.accessToken
$refresh = $loginBody.refreshToken
# Nếu login response chưa có userId (tuỳ code), dùng /users/profile để lấy hoặc decode JWT
$me = curl -Headers @{Authorization="Bearer $access"} http://localhost:3000/users/profile
$userId = ($me.Content | ConvertFrom-Json).id

# Gọi API bảo vệ
curl -Headers @{Authorization="Bearer $access"} http://localhost:3000/cameras

# Refresh (có thể bỏ userId nếu kèm Authorization Bearer còn hạn)
$ref = curl -Method POST -Uri http://localhost:3000/auth/refresh -Headers @{Authorization="Bearer $access"} -Body ("{`"refreshToken`":`"{0}`"}" -f $refresh) -ContentType 'application/json'
$refBody = $ref.Content | ConvertFrom-Json
$access = $refBody.accessToken
$refresh = $refBody.refreshToken  # đã rotate

# Logout (có thể bỏ userId nếu gửi kèm Bearer)
curl -Method POST -Uri http://localhost:3000/auth/logout -Headers @{Authorization="Bearer $access"} -Body '{}' -ContentType 'application/json'

# Thử refresh lại → phải 403
curl -Method POST -Uri http://localhost:3000/auth/refresh -Body ("{`"userId`":`"{0}`",`"refreshToken`":`"{1}`"}" -f $userId $refresh) -ContentType 'application/json'

# Test rate limit login (cố tình sai mật khẩu >10 lần trong 60s)
for ($i=1; $i -le 12; $i++) { curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"WRONG"}' -ContentType 'application/json' | Out-Null }
```

### Test refresh & logout (chi tiết)

Có 2 cách dùng cho `/auth/refresh` và `/auth/logout`:

1. Kèm `userId` trong body (cách tường minh)
2. Không gửi `userId` – server tự suy ra từ Bearer access token (fallback)

#### A. Dòng chuẩn (tường minh)
```powershell
# Login
$login = curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json'
$loginBody = $login.Content | ConvertFrom-Json
$access = $loginBody.accessToken
$refresh = $loginBody.refreshToken
$userId = $loginBody.userId # Nếu response đã trả userId; nếu không dùng /users/profile

# Refresh (tường minh)
$ref = curl -Method POST -Uri http://localhost:3000/auth/refresh -Body ("{`"userId`":`"{0}`",`"refreshToken`":`"{1}`"}" -f $userId $refresh) -ContentType 'application/json'
$refBody = $ref.Content | ConvertFrom-Json
$access = $refBody.accessToken
$refresh = $refBody.refreshToken

# Logout
curl -Method POST -Uri http://localhost:3000/auth/logout -Body ("{`"userId`":`"{0}`"}" -f $userId) -ContentType 'application/json'
```

#### B. Dùng fallback (không gửi userId)
```powershell
# Login lấy access + refresh như trên

# Refresh chỉ kèm refreshToken + Authorization header
$ref = curl -Method POST -Uri http://localhost:3000/auth/refresh -Headers @{Authorization="Bearer $access"} -Body ("{`"refreshToken`":`"{0}`"}" -f $refresh) -ContentType 'application/json'
$refBody = $ref.Content | ConvertFrom-Json
$access = $refBody.accessToken
$refresh = $refBody.refreshToken

# Logout chỉ cần Bearer
curl -Method POST -Uri http://localhost:3000/auth/logout -Headers @{Authorization="Bearer $access"} -Body '{}' -ContentType 'application/json'
```

#### C. Hoppscotch / Postman JSON payload mẫu
Refresh (fallback, không userId):
```json
{
	"refreshToken": "<refresh_token_moi>"
}
```
Header: `Authorization: Bearer <accessToken>`

Logout (fallback):
```json
{}
```

#### D. Kiểm tra luồng an toàn
1. Login → có (access1, refresh1)
2. Refresh → nhận (access2, refresh2). Dùng lại refresh1 → 403 Refresh invalid
3. Logout (khi access2 còn hạn) → Refresh với refresh2 → 403 Refresh denied
4. Access2 hết hạn → gọi API bảo vệ → 401 Unauthorized

#### E. Bật debug khi cần
Thêm ENV: `REFRESH_DEBUG=1` để log `DEBUG_REFRESH_BODY` server side.

#### F. Lỗi thường gặp nhanh
| Tình huống | HTTP | Khắc phục |
|------------|------|-----------|
| Thiếu cả userId và Bearer | 401 | Gửi userId hoặc kèm Authorization |
| refreshToken rỗng | 400 | Gửi đúng chuỗi refresh token |
| Dùng refresh cũ sau rotate | 403 (Refresh invalid) | Lưu refresh mới trả về |
| Hết hạn TTL | 403 (Refresh expired) | Login lại |
| Sai userId (không khớp hash) | 403 (Refresh denied) | Dùng đúng cặp userId + refresh |

## Lỗi thường gặp
| Mã | message / Ý nghĩa | Nguyên nhân | Khắc phục |
|----|-------------------|------------|-----------|
| 401 | Unauthorized | Thiếu hoặc accessToken hết hạn/sai | Login lại / refresh |
| 403 | Refresh denied | userId sai / chưa có refresh token | Login lại |
| 403 | Refresh expired | refresh token hết hạn | Login lại |
| 403 | Refresh invalid | Refresh token cũ (đã rotate) / giả mạo | Dùng token mới / login |
| 403 | Insufficient role | Role không đủ | Dùng user có quyền cao hơn |
| 409 | Username exists | Trùng username khi register | Đổi tên khác |
| 429 | Rate limit exceeded | Gọi quá giới hạn cửa sổ | Chờ hết 60s |

## Ghi chú
- Không để endpoint register mở ở production nếu không kiểm soát.
- In-memory rate limit chỉ phục vụ dev. Prod: dùng Redis + nestjs/throttler.
- Nên thêm userId vào response /auth/login để client tránh decode JWT.
- Muốn đa phiên (multi-device) → tách bảng sessions thay vì cột đơn lẻ.
