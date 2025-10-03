# PTZ (Pan / Tilt / Zoom) – API

## Mục tiêu
Cung cấp endpoint điều khiển PTZ đơn giản theo `cameraId` (map sang `ILoginID` + `nChannelID` nội bộ), trả về mã lệnh số (`dwPTZCommand`) và tham số thô (param1-3) để thuận tiện tích hợp SDK / ONVIF / vendor sau này. Không cần tự quản lý session giả lập.

## Endpoint
| Method | Path | Mô tả |
|--------|------|------|
| POST | /cameras/:id/ptz | Gửi lệnh PTZ (PAN_LEFT, ZOOM_IN, ...) |
| GET | /cameras/:id/ptz/status | Trạng thái chuyển động hiện tại |
| GET | /cameras/:id/ptz/logs | Log PTZ gần nhất (giới hạn retention) |
| GET | /cameras/ptz/logs/advanced | Log nâng cao (lọc theo ILoginID & channel + pagination) |

## Body ví dụ (lệnh cơ bản)
```json
{ "action": "PAN_LEFT", "speed": 2, "durationMs": 1500 }
```

- action: một trong danh sách mở rộng bên dưới
- speed: 1..8 (được chuẩn hoá server `normSpeed` nếu out-of-range)
- durationMs: nếu đặt sẽ tự dừng sau thời gian này (auto STOP nội bộ)
- param1/param2/param3: (tùy lệnh) có thể override mapping mặc định

## Danh sách action hỗ trợ
```
PAN_LEFT, PAN_RIGHT,
TILT_UP, TILT_DOWN,
PAN_LEFT_UP, PAN_RIGHT_UP, PAN_LEFT_DOWN, PAN_RIGHT_DOWN,
ZOOM_IN, ZOOM_OUT,
FOCUS_NEAR, FOCUS_FAR,
IRIS_OPEN, IRIS_CLOSE,
PRESET_SET, PRESET_DELETE, PRESET_GOTO,
AUTO_SCAN_START, AUTO_SCAN_STOP,
PATTERN_START, PATTERN_STOP, PATTERN_RUN,
TOUR_START, TOUR_STOP,
STOP
```

## Bảng mã số dwPTZCommand (commandCode) – dải chuẩn hoá 0..24
| Action | Code | Mô tả |
|--------|------|------|
| STOP | 0 | Dừng hành động / reset vector |
| TILT_UP | 1 | Nghiêng lên |
| TILT_DOWN | 2 | Nghiêng xuống |
| PAN_LEFT | 3 | Quay trái |
| PAN_RIGHT | 4 | Quay phải |
| PAN_LEFT_UP | 5 | Quay trái + lên (chéo) |
| PAN_RIGHT_UP | 6 | Quay phải + lên (chéo) |
| PAN_LEFT_DOWN | 7 | Quay trái + xuống (chéo) |
| PAN_RIGHT_DOWN | 8 | Quay phải + xuống (chéo) |
| ZOOM_IN | 9 | Zoom vào |
| ZOOM_OUT | 10 | Zoom ra |
| FOCUS_NEAR | 11 | Lấy nét gần |
| FOCUS_FAR | 12 | Lấy nét xa |
| IRIS_OPEN | 13 | Mở iris |
| IRIS_CLOSE | 14 | Đóng iris |
| PRESET_SET | 15 | Lưu preset |
| PRESET_DELETE | 16 | Xoá preset |
| PRESET_GOTO | 17 | Goto preset |
| AUTO_SCAN_START | 18 | Bắt đầu auto scan |
| AUTO_SCAN_STOP | 19 | Dừng auto scan |
| PATTERN_START | 20 | Ghi pattern (bắt đầu) |
| PATTERN_STOP | 21 | Kết thúc ghi pattern |
| PATTERN_RUN | 22 | Chạy pattern đã lưu |
| TOUR_START | 23 | Bắt đầu tour |
| TOUR_STOP | 24 | Dừng tour |

GHI CHÚ:
- Dải mã số cũ (ví dụ PRESET_GOTO 20, 21, 22; diagonal 30..33) đã được quy về dải liên tục 0..24 để dễ lọc / sort.
- Nếu cần khôi phục theo vendor nguyên bản, chỉ chỉnh trong `ptz-command-map.ts`.

## Phản hồi ví dụ (giả lập)
Hiện tại chỉ giả lập (chưa gọi SDK thực). Ví dụ trả về:
```json
{
  "ok": true,
  "ILoginID": "...",
  "nChannelID": 1,
  "action": "PAN_LEFT",
  "dwPTZCommand": 3,
  "speed": 2,
  "vector": { "pan": -2, "tilt": 0, "zoom": 0 },
  "params": { "param1": null, "param2": 2, "param3": null },
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
Schema `ptz_logs` (phiên bản mới mở rộng) gồm:
| Trường | Kiểu | Giải thích |
|--------|------|-----------|
| id | UUID | Khoá chính |
| ILoginID | UUID | Id camera tại thời điểm log (mapping = camera.id hiện tại) |
| nChannelID | int | Channel (mapping = camera.channel) |
| action | enum | PAN_LEFT...STOP |
| command_code | int | Mã số dwPTZCommand (xem bảng ở trên – đã mở rộng) |
| speed | int | Giá trị speed yêu cầu |
| vector_pan | int | -speed..speed (sau mapping) |
| vector_tilt | int | -speed..speed |
| vector_zoom | int | -speed..speed |
| duration_ms | int nullable | Thời gian dự kiến auto stop (nếu set) |
| param1 | int nullable | Tham số vendor thô #1 (ví dụ vertical speed, hoặc null) |
| param2 | int nullable | Tham số vendor thô #2 (ví dụ horizontal speed / preset number) |
| param3 | int nullable | Tham số vendor thô #3 (dự phòng) |
| created_at | timestamp | Thời điểm ghi |

Trường camera_id (FK) TRƯỚC ĐÂY đã bị loại bỏ để tránh ràng buộc cứng và mở đường log trước/sau vòng đời entity hoặc gắn với session SDK.

Mỗi lệnh (kể cả STOP) đều được insert một bản ghi. Retention áp dụng theo cặp (ILoginID, nChannelID).

### Giới hạn số log lưu (retention)
Mặc định giữ lại 10 bản ghi PTZ mới nhất cho mỗi camera (auto prune các bản cũ hơn).
Có thể thay đổi:
```
PTZ_LOG_MAX=10   # ví dụ giữ 10 thay vì 5
```
Giới hạn mềm: 1..200. (Nếu đặt <1 hoặc >200 sẽ bị bỏ qua.)

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

Response có pagination (đã bao gồm vector + params nếu select – ở bản mặc định chúng tôi trả các cột chính):
```json
{
  "data": [{
    "id":"...",
    "ILoginID":"...",
    "nChannelID":2,
    "action":"PAN_LEFT",
  "commandCode":3,
    "speed":2,
    "vectorPan":-2,
    "vectorTilt":0,
    "vectorZoom":0,
    "param1":null,
    "param2":2,
    "param3":null,
    "durationMs":1500,
    "createdAt":"2024-09-29T10:10:10.000Z"
  }],
  "pagination": { "page":1, "pageSize":20, "total":42, "totalPages":3 },
  "filtersApplied": { "ILoginID": "...", "nChannelID": 2 }
}
```
Không pagination: trả mảng các bản ghi.

Lưu ý: Endpoint /cameras/:id/ptz/logs vẫn giới hạn theo PTZ_LOG_MAX để lightweight; endpoint nâng cao dùng được cho khai thác lịch sử dài (tùy DB).

### Lưu ý migration & nâng cấp
1. Giai đoạn bỏ `camera_id`:
   - Thêm `ILoginID`, `nChannelID` (nullable) → backfill → drop `camera_id` → đặt NOT NULL + index (đã có migration `alter-ptz-logs-loginid-channel`).
2. Thêm cột `command_code` (migration: add-ptz-command-code) – backfill có thể set theo mapping cơ bản cũ (0..6) nếu cần.
3. Thêm cột `param1/param2/param3` (migration: add-ptz-params) – giá trị cũ = NULL an toàn.
4. Tăng retention mặc định từ 5 lên 10 (cấu hình qua `PTZ_LOG_MAX`).

Chạy tất cả migration:
```
npm run migration:run
```

### Bảng mapping param (tham khảo – dải mới)
| Action | param1 | param2 | param3 | Ghi chú |
|--------|--------|--------|--------|--------|
| PAN_LEFT / PAN_RIGHT | null | normSpeed | null | param2 = horizontal speed |
| TILT_UP / TILT_DOWN | null | normSpeed | null | param2 = vertical speed |
| PAN_(LEFT|RIGHT)_(UP|DOWN) | normSpeed | normSpeed | null | param1=vertical, param2=horizontal |
| ZOOM_IN / ZOOM_OUT | null | normSpeed | null | param2 = zoom speed |
| FOCUS_NEAR / FOCUS_FAR | null | normSpeed | null | param2 = focus speed |
| IRIS_OPEN / IRIS_CLOSE | null | normSpeed | null | param2 = iris speed |
| PRESET_SET / PRESET_DELETE / PRESET_GOTO | null | presetNumber | null | presetNumber mặc định =1 |
| AUTO_SCAN_START / AUTO_SCAN_STOP | null | null | null | Chưa cần param (SDK thật có thể khác) |
| PATTERN_START / PATTERN_STOP / PATTERN_RUN | null | null | null | Tuỳ vendor có thể cần ID pattern |
| TOUR_START / TOUR_STOP | null | null | null | Tuỳ vendor có thể cần ID tour |
| STOP | null | null | null | Dừng – durationMs=0 |

Caller có thể override bằng cách gửi `param1/param2/param3` cụ thể trong body.

### Ví dụ nâng cao
Gọi preset 12:
```json
{ "action": "PRESET_GOTO", "param2": 12 }
```
Lưu preset 5:
```json
{ "action": "PRESET_SET", "param2": 5 }
```
Diagonal pan trái lên tốc độ vertical 3, horizontal 5:
```json
{ "action": "PAN_LEFT_UP", "param1": 3, "param2": 5 }
```
Focus near tốc độ 6 trong 800ms:
```json
{ "action": "FOCUS_NEAR", "speed": 6, "durationMs": 800 }
```

### Tương thích & thay đổi phá vỡ (breaking changes)
- Trường phản hồi cũ `cameraId` → `ILoginID` + `nChannelID`.
- `vendorCommand` (string) → `dwPTZCommand` (số) dải mới 0..24.
- Bảng mã thay đổi (diagonal & preset & pattern/tour gom về dải liên tục) – client cũ phải cập nhật.
- Log thêm các cột `command_code`, `param1..3`.
- Retention mặc định tăng 5 → 10.
- Bộ action mở rộng (AUTO_SCAN / PATTERN / TOUR) – UI cần thêm nút hoặc ẩn nếu chưa hỗ trợ.

Nếu client cũ dựa trên danh sách 7 action ban đầu, hãy whitelist hoặc cập nhật enum.

### Kế hoạch tương lai
- Tích hợp ONVIF ContinuousMove / RelativeMove thật.
- Mapping linh hoạt speed → vector (profile-based) thay vì speed = vector trực tiếp.
- Giới hạn concurrency theo camera / session SDK.
- Thêm filter theo action & khoảng thời gian cho advanced logs.
- Bổ sung ID cho pattern / tour nếu backend thực sự hỗ trợ.

