# AUTH (Đăng nhập & RBAC)

## Mục tiêu
Quản lý người dùng, đăng ký (dev), đăng nhập JWT, phân quyền vai trò (ADMIN / OPERATOR / VIEWER).

## Các endpoint
| Method | Path | Mô tả |
|--------|------|------|
| POST | /auth/register | (Dev) Tạo user mới kèm role |
| POST | /auth/login | Đăng nhập lấy accessToken |

## Vai trò
| Role | Quyền chính |
|------|-------------|
| ADMIN | Toàn quyền CRUD cameras, recordings, snapshots, events, users |
| OPERATOR | CRUD camera/snapshot/recording/event (trừ quản lý user)|
| VIEWER | Chỉ GET (xem) |

## Test nhanh (PowerShell / curl)
```powershell
# Đăng ký (tùy chọn trong dev)
curl -Method POST -Uri http://localhost:3000/auth/register -Body '{"username":"operator1","password":"op123","role":"OPERATOR"}' -ContentType 'application/json'

# Đăng nhập
$login = curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json'
$token = ($login.Content | ConvertFrom-Json).accessToken

# Dùng token gọi API khác
curl -Headers @{Authorization="Bearer $token"} http://localhost:3000/cameras
```

## Lỗi thường gặp
| Mã | Ý nghĩa | Cách xử lý |
|----|---------|-----------|
| 401 | Thiếu / token sai | Gửi Authorization header đúng |
| 403 | Sai vai trò | Đổi user có quyền cao hơn |
| 409 | Trùng username | Dùng username khác |

## Ghi chú
- Không để endpoint register mở ở production nếu không kiểm soát.
- Có thể bổ sung refresh token nếu cần.
