# CAMERA (Quản lý Camera)

## Mục tiêu
CRUD thông tin camera: IP, credential, port RTSP, vendor, trạng thái.

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| GET | /cameras | Danh sách |
| GET | /cameras/:id | Chi tiết |
| POST | /cameras | Tạo mới |
| PATCH | /cameras/:id | Cập nhật |
| DELETE | /cameras/:id | Xoá |
| GET | /cameras/:id/verify | Kiểm tra nhanh kết nối RTSP (ffmpeg ping) |

## Thuộc tính chính (body POST)
```json
{
  "name": "Kho 1",
  "ipAddress": "192.168.1.10",
  "username": "user",
  "password": "pass",
  "rtspPort": 554,
  "vendor": "hikvision",
  "enabled": true
}
```
Tùy chọn: sdk_port, codec, resolution, onvifUrl.

## Test nhanh (PowerShell)
```powershell
$token = (curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json').Content | ConvertFrom-Json | Select-Object -ExpandProperty accessToken

# Tạo camera
curl -Method POST -Uri http://localhost:3000/cameras -Headers @{Authorization="Bearer $token"} -Body '{"name":"Kho 1","ipAddress":"192.168.1.10","username":"u","password":"p","rtspPort":554}' -ContentType 'application/json'

# Danh sách
curl -Headers @{Authorization="Bearer $token"} http://localhost:3000/cameras

# Cập nhật
curl -Method PATCH -Uri http://localhost:3000/cameras/<id> -Headers @{Authorization="Bearer $token"} -Body '{"enabled":false}' -ContentType 'application/json'

# Xoá
curl -Method DELETE -Uri http://localhost:3000/cameras/<id> -Headers @{Authorization="Bearer $token"}
```

## Lỗi thường gặp
| Mã | Ý nghĩa | Gợi ý |
|----|---------|-------|
| 404 | Không tìm thấy id | Kiểm tra lại id |
| 409 | ip_address trùng | Sửa ipAddress khác |
| 400 | Invalid IP address format | Kiểm tra IPv4/IPv6 hợp lệ |

## Ghi chú
- Nên mã hoá (hoặc tối thiểu mask) credential khi log.
- Có thể bổ sung field health/trạng thái kết nối sau.
- IP validation: hỗ trợ IPv4 chặt (0-255 mỗi octet) & IPv6 (rút gọn ::). Sai định dạng trả 400.
- /cameras/:id/verify dùng ffmpeg: mở RTSP TCP, lấy 1 frame trong ~timeout (CAMERA_VERIFY_TIMEOUT_MS, mặc định 4000ms) và phân loại: OK / TIMEOUT / AUTH / CONN / NOT_FOUND / UNKNOWN.

### Ví dụ verify
```powershell
curl -Headers @{Authorization="Bearer $token"} http://localhost:3000/cameras/<id>/verify
```
Kết quả mẫu:
```json
{ "ok": true, "status": "OK", "rtsp": "rtsp://admin:admin@192.168.1.10:554", "ms": 812 }
```
Lỗi auth mẫu:
```json
{ "ok": false, "status": "AUTH", "ms": 1030 }
```
