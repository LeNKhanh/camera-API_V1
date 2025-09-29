# EVENT (Sự kiện)

Quản lý sự kiện liên quan camera: MOTION, ERROR, ALERT... Có thể tích hợp hệ thống phân tích ngoại vi (AI) gọi vào.

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| POST | /events | Tạo sự kiện |
| GET | /events | Danh sách |
| GET | /events/:id | Chi tiết |

## Body POST mẫu
```json
{ "cameraId": "<uuid>", "type": "MOTION", "description": "Phát hiện chuyển động vùng cửa" }
```

## Test nhanh (PowerShell)
```powershell
$token = (curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json').Content | ConvertFrom-Json | Select -ExpandProperty accessToken

curl -Method POST -Uri http://localhost:3000/events -Headers @{Authorization="Bearer $token"} -Body '{"cameraId":"<id>","type":"ALERT","description":"Nhiệt độ cao"}' -ContentType 'application/json'

curl -Headers @{Authorization="Bearer $token"} http://localhost:3000/events
```

## Lỗi phổ biến
| Lỗi | Nguyên nhân |
|-----|-------------|
| 404 Camera not found | cameraId sai |
| 400 Validation failed | type không hợp lệ |

## Ghi chú
- Có thể thêm priority, category, ack flag.
- Có thể đẩy sự kiện ra message queue (Kafka, Redis Stream) để xử lý tiếp.
