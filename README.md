# Camera API (NestJS)

REST quản lý camera (multi-channel), snapshot, recording, playback, event & **PTZ ONVIF** (điều khiển camera thật). Ngắn gọn – đủ để dev onboard nhanh.

## tính năng chính
* Auth + RBAC (ADMIN / OPERATOR / VIEWER)
* Camera: CRUD, bulk channel, verify RTSP, ONVIF support
* Snapshot: RTSP hoặc FAKE
* Recording: start / stop / download / lọc thời gian & status
* Playback: session + position + status (PLAYING/PAUSED/STOPPED; COMPLETED auto khi >=95%)
* Event: tạo, list, ack, simulate motion, delete 1, delete theo camera
* **PTZ ONVIF:** pan/tilt/zoom thật, diagonal, preset, throttle, auto-stop, logs

## Cài đặt nhanh
```powershell
npm install
Copy-Item src\.env.example .env
npm run seed   # user admin/admin123
npm run start:dev
```
Server: http://localhost:3000

## Flow test 1 phút
1. Login → lấy token
2. POST /cameras (với onvifPort: 80)
3. POST /snapshots/capture
4. POST /recordings/start → vài giây → PUT /recordings/:id/stop
5. POST /events hoặc simulate-motion
6. **PTZ ONVIF:** POST /cameras/:id/ptz { action: "PAN_LEFT", speed: 5, durationMs: 2000 } → **Camera thật di chuyển!** 🎥
7. Playback: create → PATCH position → PATCH status → đợi COMPLETED

## Lỗi thường gặp
DB connect fail: kiểm tra ENV & Postgres
Snapshot fail: sai RTSP hoặc ffmpeg
403: thiếu Bearer hoặc role
PATCH playback báo finalized: session đã COMPLETED/FAILED


-- Finished --



