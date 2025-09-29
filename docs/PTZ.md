# PTZ (Pan / Tilt / Zoom) – API

## Mục tiêu
Cung cấp endpoint điều khiển PTZ thân thiện theo `cameraId`, không cần session giả lập.

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| POST | /cameras/:id/ptz | Gửi lệnh PTZ (PAN_LEFT, ZOOM_IN, ...) |
| GET | /cameras/:id/ptz/status | Trạng thái chuyển động hiện tại |

## Body ví dụ
```json
{ "action": "PAN_LEFT", "speed": 2, "durationMs": 1500 }
```

- action: one of PAN_LEFT, PAN_RIGHT, TILT_UP, TILT_DOWN, ZOOM_IN, ZOOM_OUT, STOP
- speed: (tạm thời chỉ trả về echo, phục vụ UI; sau này map vào SDK/ONVIF)
- durationMs: nếu đặt sẽ tự dừng sau thời gian này (auto STOP nội bộ)

## Mô phỏng
Hiện tại chỉ giả lập (không gửi tới thiết bị). Trả về:
```json
{
  "ok": true,
  "cameraId": "...",
  "action": "PAN_LEFT",
  "vendorCommand": "DH_PTZ_LEFT_CONTROL",
  "speed": 2,
  "willAutoStopAfterMs": 1500,
  "startedAt": 1696000000000
}
```

## Trạng thái
`GET /cameras/:id/ptz/status` trả:
```json
{ "moving": true, "action": "PAN_LEFT", "ms": 820 }
```
Hoặc `{ "moving": false }` nếu không có chuyển động đang active.

## Dừng thủ công
```json
{ "action": "STOP" }
```

## Hướng mở rộng (ĐÃ TRIỂN KHAI MỘT PHẦN)
1. ONVIF ContinuousMove / RelativeMove / Stop. (CHƯA)
2. Mapping speed → vector pan/tilt/zoom. (ĐÃ LÀM)
3. Throttle tránh spam lệnh. (ĐÃ LÀM - 200ms mặc định)
4. Ghi log lịch sử PTZ vào bảng riêng `ptz_logs`. (ĐÃ LÀM)

### Mapping speed → vector
Server chuyển action + speed thành vector:

| Action | vectorPan | vectorTilt | vectorZoom |
|--------|-----------|-----------|------------|
| PAN_LEFT  | -speed | 0 | 0 |
| PAN_RIGHT | speed  | 0 | 0 |
| TILT_UP   | 0 | speed | 0 |
| TILT_DOWN | 0 | -speed | 0 |
| ZOOM_IN   | 0 | 0 | speed |
| ZOOM_OUT  | 0 | 0 | -speed |
| STOP      | 0 | 0 | 0 |

Phản hồi API bổ sung trường:
```json
"vector": { "pan": -2, "tilt": 0, "zoom": 0 }
```

### Throttle
Nếu gửi lệnh quá nhanh (<200ms so với lệnh trước cùng camera) server trả:
```json
{ "ok": false, "throttled": true, "minIntervalMs": 200 }
```
Có thể điều chỉnh qua biến môi trường:
```
PTZ_THROTTLE_MS=150   # ví dụ giảm còn 150ms
PTZ_THROTTLE_DEBUG=1  # bật trả thêm lastDeltaMs giúp debug
```

### Ghi log lịch sử PTZ
Entity mới `ptz_logs` gồm:
| Trường | Giải thích |
|--------|------------|
| id | UUID |
| camera_id | FK camera (CASCADE) |
| action | PAN_LEFT...STOP |
| speed | int |
| vector_pan | int (-speed..speed) |
| vector_tilt | int |
| vector_zoom | int |
| duration_ms | thời gian dự kiến auto stop (nullable) |
| created_at | timestamp |

Mỗi lệnh (kể cả STOP) đều được insert một bản ghi.

### Giới hạn số log lưu (retention)
Mặc định chỉ giữ lại 5 bản ghi PTZ mới nhất cho mỗi camera (auto prune các bản cũ hơn).
Có thể thay đổi:
```
PTZ_LOG_MAX=10   # ví dụ giữ 10 thay vì 5
```
Giới hạn mềm: 1..200.

### Lưu ý migration
Dev: `synchronize=true` tự tạo bảng. Prod: cần sinh migration:
```
npm run migration:generate
npm run migration:run
```
