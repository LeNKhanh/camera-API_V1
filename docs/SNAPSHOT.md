# SNAPSHOT (Chụp ảnh)

Chụp 1 frame từ camera (RTSP hoặc FAKE). Logic nâng cao (candidate scanning, watchdog, cache, FAKE filters...) xem `ADVANCED_SNAPSHOT.md`.

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| POST | /snapshots/capture | Chụp ảnh |
| GET | /snapshots | Danh sách |
| GET | /snapshots/:id | Chi tiết |

## Body POST tối thiểu
```json
{ "cameraId": "<uuid>" }
```

## Tuỳ chọn
| Trường | Mô tả |
|--------|------|
| filename | Tên file lưu (jpg) |
| rtspUrl | Override URL tạm thời |
| strategy | RTSP (default) / FAKE / SDK_NETWORK / SDK_LOCAL |

## Ví dụ
```json
{ "cameraId": "<uuid>", "filename": "a1.jpg" }
```
FAKE (không cần camera thật):
```json
{ "cameraId": "<uuid>", "strategy": "FAKE" }
```
Override RTSP:
```json
{ "cameraId": "<uuid>", "rtspUrl": "rtsp://user:pass@192.168.1.10:554/Streaming/Channels/101" }
```

## Test nhanh (PowerShell)
```powershell
$token = (curl -Method POST -Uri http://localhost:3000/auth/login -Body '{"username":"admin","password":"admin123"}' -ContentType 'application/json').Content | ConvertFrom-Json | Select -ExpandProperty accessToken

curl -Method POST -Uri http://localhost:3000/snapshots/capture -Headers @{Authorization="Bearer $token"} -Body '{"cameraId":"<id>"}' -ContentType 'application/json'
```

## Trả về
```json
{
  "id": "...",
  "storagePath": "C:/tmp/xxxxx.jpg",
  "createdAt": "...",
  "camera": { "id": "..." }
}
```

## Lỗi phổ biến
| Lỗi | Nguyên nhân |
|-----|-------------|
| SNAPSHOT_CAPTURE_FAILED | Tất cả candidate RTSP fail |
| SNAPSHOT_FAKE_FAILED | Cả 3 filter FAKE fail |
| 404 Camera not found | cameraId sai |

## Env quan trọng (cơ bản)
| Biến | Mô tả |
|------|------|
| SNAPSHOT_DIR | Thư mục chứa ảnh |
| DEBUG_SNAPSHOT | 1: in log debug |
| SNAPSHOT_CACHE_RTSP | Tự cache URL hoạt động |

(Chi tiết nâng cao xem `ADVANCED_SNAPSHOT.md`).
