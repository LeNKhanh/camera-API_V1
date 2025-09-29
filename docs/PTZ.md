# PTZ (Pan / Tilt / Zoom) – Friendly API

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

## Hướng mở rộng
1. ONVIF ContinuousMove / RelativeMove / Stop.
2. Mapping speed → vector pan/tilt/zoom.
3. Throttle tránh spam lệnh.
4. Ghi log lịch sử PTZ vào bảng riêng.
