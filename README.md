# Camera API (NestJS)

REST quản lý camera (multi-channel), snapshot, recording, playback, event & **PTZ ONVIF** (điều khiển camera thật). Ngắn gọn – đủ để dev onboard nhanh.

## 1. Tính năng chính
* Auth + RBAC (ADMIN / OPERATOR / VIEWER)
* Camera: CRUD, bulk channel, verify RTSP, ONVIF support
* Snapshot: RTSP hoặc FAKE
* Recording: start / stop / download / lọc thời gian & status
* Playback: session + position + status (PLAYING/PAUSED/STOPPED; COMPLETED auto khi >=95%)
* Event: tạo, list, ack, simulate motion, delete 1, delete theo camera
* **PTZ ONVIF:** pan/tilt/zoom thật, diagonal, preset, throttle, auto-stop, logs

## 2. Cài đặt nhanh
```powershell
npm install
Copy-Item src\.env.example .env
npm run seed   # user admin/admin123
npm run start:dev
```
Server: http://localhost:3000

Đăng nhập: POST /auth/login { username: "admin", password: "admin123" }

## 3. ENV cốt lõi
```
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=postgres
DB_NAME=Camera_api
JWT_SECRET=changeme

# PTZ ONVIF
PTZ_USE_ONVIF=1           # 1=enabled (default), 0=mock mode
PTZ_THROTTLE_MS=200       # Throttle giữa commands
PTZ_LOG_MAX=10            # Log retention per camera
```
Optional: CAMERA_VERIFY_TIMEOUT_MS, SNAPSHOT_DIR, RECORD_DIR.

## 4. API chính (tóm tắt)
Auth: login / refresh / logout
Camera: CRUD, bulk-channels, verify, lọc
Snapshot: capture, list, detail
Recording: start, stop, list (?cameraId&from&to&status), detail, download
Playback: create, list, get, patch position, patch status, analytics, delete
Event: create, list (?cameraId&nChannelID), get, ack, simulate-motion, delete:id, delete:by-camera
**PTZ:** send command (ONVIF), status, logs, advanced logs
Stream (stub): URL giả HLS/DASH

## 5. PTZ ONVIF (✨ NEW!)
**Camera thực tế sẽ di chuyển vật lý!** 🎥

### Quick Start
```json
// 1. Create camera with ONVIF port
POST /cameras
{
  "name": "PTZ Camera",
  "ipAddress": "192.168.1.66",
  "username": "admin",
  "password": "admin123",
  "onvifPort": 80,  // Default 80 (Dahua: 80/8000/8899)
  "sdkPort": 37777,
  "rtspPort": 554
}

// 2. Send PTZ command
POST /cameras/:id/ptz
{
  "action": "PAN_LEFT",
  "speed": 5,
  "durationMs": 2000  // Auto-stop after 2 seconds
}
```

### Supported Actions
- **Basic:** PAN_LEFT, PAN_RIGHT, TILT_UP, TILT_DOWN, ZOOM_IN, ZOOM_OUT
- **Diagonal:** PAN_LEFT_UP, PAN_RIGHT_UP, PAN_LEFT_DOWN, PAN_RIGHT_DOWN
- **Control:** STOP, PRESET_GOTO, PRESET_SET, PRESET_DELETE
- **Focus/Iris:** FOCUS_NEAR, FOCUS_FAR, IRIS_OPEN, IRIS_CLOSE

### Test Script
```powershell
# Quick test (sau khi có token & cameraId)
.\scripts\test-onvif-ptz.ps1
```

**📖 Xem chi tiết:** [docs/ONVIF_PTZ_GUIDE.md](docs/ONVIF_PTZ_GUIDE.md)

## 6. Playback rules
PATCH /playbacks/:id/status chỉ nhận: PLAYING | PAUSED | STOPPED
Không đổi được nếu đã COMPLETED hoặc FAILED.
STOPPED không auto thành COMPLETED (policy có thể đổi sau).

## 6. PTZ notes
Throttle mặc định 200ms (ENV: PTZ_THROTTLE_MS)
Hướng chéo trả vector pan & tilt ≠ 0
Logs cắt tỉa sau PTZ_LOG_MAX bản ghi mỗi camera/channel

## 7. Cấu trúc nhanh
```
src/modules/
  auth/ camera/ snapshot/ recording/ playback/ event/ stream/ ptz/
src/typeorm/entities/*.ts
common/ (roles, guards)
docs/ (chi tiết sâu hơn)
```

## 8. Flow test 1 phút
1. Login → lấy token
2. POST /cameras (với onvifPort: 80)
3. POST /snapshots/capture
4. POST /recordings/start → vài giây → PUT /recordings/:id/stop
5. POST /events hoặc simulate-motion
6. **PTZ ONVIF:** POST /cameras/:id/ptz { action: "PAN_LEFT", speed: 5, durationMs: 2000 } → **Camera thật di chuyển!** 🎥
7. Playback: create → PATCH position → PATCH status → đợi COMPLETED

## 9. Lỗi thường gặp
DB connect fail: kiểm tra ENV & Postgres
Snapshot fail: sai RTSP hoặc ffmpeg
403: thiếu Bearer hoặc role
PATCH playback báo finalized: session đã COMPLETED/FAILED

## 10. Ghi chú triển khai
Prod: tắt synchronize, dùng migrations
Có thể thêm Swagger / S3 / ONVIF về sau

-- Finished --



