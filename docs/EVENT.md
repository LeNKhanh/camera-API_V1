# EVENT (Sự kiện)

Quản lý sự kiện liên quan camera: MOTION, ERROR, ALERT... Có thể tích hợp hệ thống phân tích ngoại vi (AI) gọi vào.

## Schema bảng `events`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | uuid | Primary key |
| camera_id | uuid | FK → cameras(id), CASCADE DELETE |
| **nChannelID** | int | **Channel của camera khi event xảy ra** (default: 1, lấy từ cameras.channel) |
| type | varchar(50) | Loại event: MOTION, ERROR, ALERT |
| description | text | Mô tả chi tiết (nullable) |
| ack | boolean | Đã xác nhận chưa (default false) |
| created_at | timestamptz | Thời điểm tạo |

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| POST | /events | Tạo sự kiện |
| GET | /events | Danh sách (hỗ trợ filter cameraId, nChannelID) |
| GET | /events/:id | Chi tiết |
| PUT | /events/:id/ack | Ack sự kiện |
| POST | /events/simulate-motion/:cameraId | Giả lập motion |

## Body POST mẫu
```json
{ 
  "cameraId": "<uuid>", 
  "type": "MOTION", 
  "description": "Phát hiện chuyển động vùng cửa" 
}
```

**Lưu ý:** `nChannelID` sẽ **tự động được lấy** từ `cameras.channel` khi tạo event, không cần gửi trong request body.

## Query Parameters cho GET /events

| Parameter | Ví dụ | Mô tả |
|-----------|-------|-------|
| cameraId | `?cameraId=<uuid>` | Lọc events theo camera cụ thể |
| nChannelID | `?nChannelID=2` | Lọc events theo channel (1, 2, 3, ...) |
| Kết hợp | `?cameraId=<uuid>&nChannelID=2` | Lọc theo cả camera và channel |

## Response mẫu

**GET /events/:id**
```json
{
  "id": "adb3b040-6bbd-4a50-a28f-c09f01bc2f41",
  "camera": {
    "id": "6b6dd4e4-b3a9-4fce-ae61-4c288c73856b",
    "name": "Camera Kho 1",
    "ipAddress": "192.168.1.108",
    "channel": 2
  },
  "nChannelID": 2,
  "type": "MOTION",
  "description": "Phát hiện chuyển động vùng cửa",
  "ack": false,
  "createdAt": "2025-10-02T01:59:07.693Z"
}
```

**GET /events (array)**
```json
[
  {
    "id": "adb3b040-...",
    "camera": { "id": "6b6dd4e4-...", "name": "Camera Kho 1" },
    "nChannelID": 2,
    "type": "MOTION",
    "description": "Phát hiện chuyển động vùng cửa",
    "ack": false,
    "createdAt": "2025-10-02T01:59:07.693Z"
  }
]
```

## Test nhanh (PowerShell)
```powershell
$token = (curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json').Content | ConvertFrom-Json | Select -ExpandProperty accessToken

# Tạo event ALERT
curl -Method POST -Uri http://localhost:3000/events -Headers @{Authorization="Bearer $token"} -Body '{"cameraId":"<id>","type":"ALERT","description":"Nhiệt độ cao"}' -ContentType 'application/json'

# Giả lập motion
curl -Method POST -Headers @{Authorization="Bearer $token"} http://localhost:3000/events/simulate-motion/<cameraId>

# Lọc theo channel
curl -Headers @{Authorization="Bearer $token"} "http://localhost:3000/events?nChannelID=2"

# Lọc theo camera + channel
curl -Headers @{Authorization="Bearer $token"} "http://localhost:3000/events?cameraId=<uuid>&nChannelID=2"

# Ack event
curl -Method PUT -Headers @{Authorization="Bearer $token"} http://localhost:3000/events/<eventId>/ack

# Danh sách tất cả
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
