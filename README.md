# Camera API (NestJS)

REST quản lý camera (multi-channel), snapshot, recording, playback, event & PTZ mock. Ngắn gọn – đủ để dev onboard nhanh.

## 1. Tính năng chính
* Auth + RBAC (ADMIN / OPERATOR / VIEWER)
* Camera: CRUD, bulk channel, verify RTSP
* Snapshot: RTSP hoặc FAKE
* Recording: start / stop / download / lọc thời gian & status
* Playback: session + position + status (PLAYING/PAUSED/STOPPED; COMPLETED auto khi >=95%)
* Event: tạo, list, ack, simulate motion, delete 1, delete theo camera
* PTZ: pan/tilt/zoom + hướng chéo, throttle, logs, vector trả về

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
```
Optional: PTZ_THROTTLE_MS, PTZ_LOG_MAX, CAMERA_VERIFY_TIMEOUT_MS, SNAPSHOT_DIR, RECORD_DIR.

## 4. API chính (tóm tắt)
Auth: login / refresh / logout
Camera: CRUD, bulk-channels, verify, lọc
Snapshot: capture, list, detail
Recording: start, stop, list (?cameraId&from&to&status), detail, download
Playback: create, list, get, patch position, patch status, analytics, delete
Event: create, list (?cameraId&nChannelID), get, ack, simulate-motion, delete:id, delete:by-camera
PTZ: send command, status, logs, advanced logs
Stream (stub): URL giả HLS/DASH

## 5. Playback rules
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
2. POST /cameras
3. POST /snapshots/capture
4. POST /recordings/start → vài giây → PUT /recordings/:id/stop
5. POST /events hoặc simulate-motion
6. PTZ: POST /cameras/:id/ptz { action: "PAN_RIGHT_DOWN", speed: 3 }
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



