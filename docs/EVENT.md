# EVENT (Sự kiện)

Quản lý sự kiện liên quan camera: MOTION, ERROR, ALERT... Có thể tích hợp hệ thống phân tích ngoại vi (AI) gọi vào.

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| POST | /events | Tạo sự kiện |
| GET | /events | Danh sách |
| GET | /events/:id | Chi tiết |
| PUT | /events/:id/ack | Ack sự kiện |
| POST | /events/simulate-motion/:cameraId | Giả lập motion |

## Body POST mẫu
```json
{ "cameraId": "<uuid>", "type": "MOTION", "description": "Phát hiện chuyển động vùng cửa" }
```

## Test nhanh (PowerShell)
```powershell
$token = (curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json').Content | ConvertFrom-Json | Select -ExpandProperty accessToken

# Tạo event ALERT
curl -Method POST -Uri http://localhost:3000/events -Headers @{Authorization="Bearer $token"} -Body '{"cameraId":"<id>","type":"ALERT","description":"Nhiệt độ cao"}' -ContentType 'application/json'

# Giả lập motion
curl -Method POST -Headers @{Authorization="Bearer $token"} http://localhost:3000/events/simulate-motion/<cameraId>

# Ack event
curl -Method PUT -Headers @{Authorization="Bearer $token"} http://localhost:3000/events/<eventId>/ack

# Danh sách
curl -Headers @{Authorization="Bearer $token"} http://localhost:3000/events
```

## Lỗi phổ biến
| Lỗi | Nguyên nhân |
|-----|-------------|
| 404 Camera not found | cameraId sai |
| 400 Validation failed | type không hợp lệ |
| 401 Unauthorized | Thiếu header Authorization Bearer hoặc JWT_SECRET mismatch giữa auth.module và jwt.strategy |

## Ghi chú
- Đã có ack flag: PUT /events/:id/ack.
- Simulate motion: POST /events/simulate-motion/:cameraId.
- Có thể mở rộng priority, category, push message queue sau.
