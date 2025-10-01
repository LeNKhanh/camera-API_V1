# PTZ (Pan / Tilt / Zoom) – API

## Mục tiêu
Cung cấp endpoint điều khiển PTZ thân thiện theo `cameraId`, không cần session giả lập.

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| POST | /cameras/:id/ptz | Gửi lệnh PTZ (PAN_LEFT, ZOOM_IN, ...) |
| GET | /cameras/:id/ptz/status | Trạng thái chuyển động hiện tại |
| GET | /cameras/:id/ptz/logs | Log PTZ gần nhất (giới hạn retention) |
| GET | /cameras/ptz/logs/advanced | Log nâng cao (lọc theo ILoginID & channel + pagination) |

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

## Hướng mở rộng
1. ONVIF ContinuousMove / RelativeMove / Stop. (CHƯA)
2. Mapping speed → vector pan/tilt/zoom. (ĐÃ LÀM)
3. Throttle tránh spam lệnh. (ĐÃ LÀM - 200ms mặc định)
4. Ghi log lịch sử PTZ vào bảng riêng `ptz_logs` (đÃ refactor: dùng ILoginID + nChannelID thay cho camera_id). (ĐÃ LÀM)

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
Schema `ptz_logs` (phiên bản mới) gồm:
| Trường | Kiểu | Giải thích |
|--------|------|-----------|
| id | UUID | Khoá chính |
| ILoginID | UUID | Id camera tại thời điểm log (mapping = camera.id hiện tại, tương lai có thể là login handle) |
| nChannelID | int | Channel (mapping = camera.channel) |
| action | enum | PAN_LEFT...STOP |
| speed | int | Giá trị speed yêu cầu |
| vector_pan | int | -speed..speed (sau mapping) |
| vector_tilt | int | -speed..speed |
| vector_zoom | int | -speed..speed |
| duration_ms | int nullable | Thời gian dự kiến auto stop (nếu set) |
| created_at | timestamp | Thời điểm ghi |

Trường camera_id (FK) TRƯỚC ĐÂY đã bị loại bỏ để tránh ràng buộc cứng và mở đường log trước/sau vòng đời entity hoặc gắn với session SDK.

Mỗi lệnh (kể cả STOP) đều được insert một bản ghi. Retention áp dụng theo cặp (ILoginID, nChannelID).

### Giới hạn số log lưu (retention)
Mặc định chỉ giữ lại 5 bản ghi PTZ mới nhất cho mỗi camera (auto prune các bản cũ hơn).
Có thể thay đổi:
```
PTZ_LOG_MAX=10   # ví dụ giữ 10 thay vì 5
```
Giới hạn mềm: 1..200.

### Tra cứu nâng cao theo ILoginID & nChannelID
Endpoint mới:
```
GET /cameras/ptz/logs/advanced?ILoginID=<cameraId>&nChannelID=2&page=1&pageSize=20
```
Query params:
| Param | Mô tả |
|-------|-------|
| ILoginID | cameraId tương ứng (bắt buộc) |
| nChannelID | Lọc theo channel cụ thể (tùy chọn) |
| page, pageSize | Bật pagination (nếu không gửi trả về mảng) |

Response có pagination:
```json
{
  "data": [{"id":"...","ILoginID":"...","nChannelID":2,"action":"PAN_LEFT","speed":2,"createdAt":"..."}],
  "pagination": { "page":1, "pageSize":20, "total":42, "totalPages":3 },
  "filtersApplied": { "ILoginID": "...", "nChannelID": 2 }
}
```
Không pagination: trả mảng các bản ghi.

Lưu ý: Endpoint /cameras/:id/ptz/logs vẫn giới hạn theo PTZ_LOG_MAX để lightweight; endpoint nâng cao dùng được cho khai thác lịch sử dài (tùy DB).

### Lưu ý migration & nâng cấp
- Nếu bạn đang nâng cấp từ version dùng `camera_id`:
  1. Thêm cột ILoginID, nChannelID nullable
  2. Backfill từ bảng cameras (ILoginID = camera.id, nChannelID = camera.channel)
  3. Drop camera_id
  4. Đặt NOT NULL và (tuỳ chọn) index (ILoginID, nChannelID)
  5. Áp dụng retention trên cặp mới

Script đã được cung cấp trong migration tương ứng (`alter-ptz-logs-loginid-channel`). Chỉ cần:
```
npm run migration:run
```
Dev environment vẫn có thể dùng synchronize, nhưng khuyến nghị tắt trong production.
