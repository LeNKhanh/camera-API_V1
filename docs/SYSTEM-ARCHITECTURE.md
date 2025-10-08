# 📐 Sơ đồ Kiến trúc Hệ thống Camera API

> **Camera Management System** - NestJS Backend API
> 
> Hệ thống quản lý camera Dahua với các tính năng: PTZ control, Stream, Recording, Snapshot, Events, Playback

---

## 🏗️ Tổng quan Kiến trúc Hệ thống

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         CLIENT LAYER                                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │
│  │  Web Client  │  │  Mobile App  │  │  Hoppscotch  │  │  Postman    │ │
│  │  (React/Vue) │  │  (Flutter)   │  │  (Testing)   │  │  (Testing)  │ │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘  └──────┬──────┘ │
│         │                 │                 │                 │         │
│         └─────────────────┴─────────────────┴─────────────────┘         │
│                                   │                                      │
│                            HTTP/HTTPS REST API                           │
│                                   │                                      │
└───────────────────────────────────┼──────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    API GATEWAY / AUTH LAYER                             │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │  JWT Authentication Middleware                                    │  │
│  │  - Token validation                                               │  │
│  │  - User authorization                                             │  │
│  │  - Role-based access control                                      │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└───────────────────────────────────┼─────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                      NESTJS APPLICATION LAYER                           │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │                        CONTROLLERS                              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │   Auth   │ │  Camera  │ │   PTZ    │ │  Stream  │          │   │
│  │  │Controller│ │Controller│ │Controller│ │Controller│          │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │   │
│  │       │            │            │            │                 │   │
│  │  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐          │   │
│  │  │Recording │ │ Snapshot │ │  Event   │ │ Playback │          │   │
│  │  │Controller│ │Controller│ │Controller│ │Controller│          │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
│  ┌─────────────────────────────┴───────────────────────────────────┐   │
│  │                          SERVICES                               │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │   Auth   │ │  Camera  │ │   PTZ    │ │  Stream  │          │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │          │   │
│  │  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │   │
│  │       │            │            │            │                 │   │
│  │  ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐ ┌────┴─────┐          │   │
│  │  │Recording │ │ Snapshot │ │  Event   │ │ Playback │          │   │
│  │  │ Service  │ │ Service  │ │ Service  │ │ Service  │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
│  ┌─────────────────────────────┴───────────────────────────────────┐   │
│  │                    REPOSITORIES (TypeORM)                       │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │   │
│  │  │   User   │ │  Camera  │ │ PTZ Log  │ │Recording │          │   │
│  │  │   Repo   │ │   Repo   │ │   Repo   │ │   Repo   │          │   │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘          │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                       │   │
│  │  │ Snapshot │ │  Event   │ │ Playback │                       │   │
│  │  │   Repo   │ │   Repo   │ │   Repo   │                       │   │
│  │  └──────────┘ └──────────┘ └──────────┘                       │   │
│  └─────────────────────────────┬───────────────────────────────────┘   │
│                                │                                        │
└────────────────────────────────┼────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        DATABASE LAYER                                   │
│  ┌───────────────────────────────────────────────────────────────────┐  │
│  │                    PostgreSQL Database                           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │  │
│  │  │  users   │ │ cameras  │ │ ptz_logs │ │recordings│           │  │
│  │  │  table   │ │  table   │ │  table   │ │  table   │           │  │
│  │  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐                        │  │
│  │  │snapshots │ │  events  │ │playbacks │                        │  │
│  │  │  table   │ │  table   │ │  table   │                        │  │
│  │  └──────────┘ └──────────┘ └──────────┘                        │  │
│  └───────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL SERVICES LAYER                             │
│  ┌─────────────────────────────────────────────────────────────┐       │
│  │              DAHUA CAMERA DEVICES                           │       │
│  │  ┌─────────────────────────────────────────────────────┐    │       │
│  │  │  Camera 1: 192.168.1.66 (IPC-HDBW2431R-ZS)         │    │       │
│  │  │  - Channel: 2                                       │    │       │
│  │  │  - PTZ Support: ✅ HTTP CGI API                     │    │       │
│  │  │  - ONVIF Support: ⚠️  Limited                       │    │       │
│  │  │  - SDK Port: 37777                                  │    │       │
│  │  │  - ONVIF Port: 80                                   │    │       │
│  │  └─────────────────────────────────────────────────────┘    │       │
│  │  ┌─────────────────────────────────────────────────────┐    │       │
│  │  │  Camera 2: 192.168.1.x                              │    │       │
│  │  │  Camera 3: 192.168.1.x                              │    │       │
│  │  │  ...                                                │    │       │
│  │  └─────────────────────────────────────────────────────┘    │       │
│  └─────────────────────────────────────────────────────────────┘       │
│                                                                         │
│  Communication Protocols:                                              │
│  ├─ HTTP/HTTPS (CGI API) ✅ Currently Used                             │
│  ├─ RTSP (Video Streaming)                                             │
│  ├─ ONVIF (Partial Support)                                            │
│  └─ Dahua SDK Protocol (Port 37777)                                    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 🔐 Luồng Authentication

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ 1. POST /auth/login
     │    { username, password }
     ▼
┌─────────────────┐
│ AuthController  │
└────┬────────────┘
     │
     │ 2. Validate credentials
     ▼
┌─────────────────┐
│  AuthService    │
└────┬────────────┘
     │
     │ 3. Query DB
     ▼
┌─────────────────┐
│  UserRepository │
└────┬────────────┘
     │
     │ 4. Compare password (bcrypt)
     ▼
┌─────────────────┐
│  AuthService    │
└────┬────────────┘
     │
     │ 5. Generate JWT token
     │    { userId, username, role }
     ▼
┌──────────┐
│  Client  │ ← Returns: { access_token, refresh_token }
└──────────┘
```

---

## 🎥 Luồng PTZ Control (Chi tiết)

```
┌──────────────┐
│   Client     │
│ (Hoppscotch) │
└──────┬───────┘
       │
       │ POST /cameras/:id/ptz
       │ Body: {
       │   action: "PAN_LEFT",
       │   speed: 5,
       │   duration: 2000
       │ }
       │
       ▼
┌─────────────────────────────────────┐
│      PtzController                  │
│  @Post(':cameraId/ptz')             │
│  - Validate JWT token               │
│  - Parse request body               │
└──────┬──────────────────────────────┘
       │
       │ Call: sendCommand(cameraId, dto)
       ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PtzService                                   │
│                                                                 │
│  1. Get camera info from database                              │
│     ┌───────────────────────────────────────────┐              │
│     │ SELECT * FROM cameras WHERE id = :id      │              │
│     │ Returns:                                  │              │
│     │   - ipAddress: 192.168.1.66               │              │
│     │   - username: aidev                       │              │
│     │   - password: aidev123                    │              │
│     │   - channel: 2                            │              │
│     │   - sdkPort: 37777                        │              │
│     │   - onvifPort: 80                         │              │
│     └───────────────────────────────────────────┘              │
│                                                                 │
│  2. Check PTZ mode                                             │
│     ┌───────────────────────────────────────────┐              │
│     │ const useOnvif = process.env              │              │
│     │   .PTZ_USE_ONVIF === '1';                 │              │
│     │                                           │              │
│     │ if (useOnvif) {                           │              │
│     │   // ❌ SKIP - ONVIF disabled             │              │
│     │ } else {                                  │              │
│     │   // ✅ USE HTTP API                      │              │
│     │ }                                         │              │
│     └───────────────────────────────────────────┘              │
│                                                                 │
│  3. Map action to Dahua command                                │
│     ┌───────────────────────────────────────────┐              │
│     │ DahuaPtzCommandNames = {                  │              │
│     │   'PAN_LEFT': 'Left',                     │              │
│     │   'PAN_RIGHT': 'Right',                   │              │
│     │   'TILT_UP': 'Up',                        │              │
│     │   'TILT_DOWN': 'Down',                    │              │
│     │   'ZOOM_IN': 'ZoomTele',                  │              │
│     │   'ZOOM_OUT': 'ZoomWide'                  │              │
│     │ }                                         │              │
│     │                                           │              │
│     │ dahuaCommand = 'Left'                     │              │
│     └───────────────────────────────────────────┘              │
│                                                                 │
│  4. Build HTTP URL                                             │
│     ┌───────────────────────────────────────────┐              │
│     │ URL Format:                               │              │
│     │ http://{ip}/cgi-bin/ptz.cgi?              │              │
│     │   action=start                            │              │
│     │   &channel={channel}                      │              │
│     │   &code={command}                         │              │
│     │   &arg1=0                                 │              │
│     │   &arg2={speed}                           │              │
│     │   &arg3=0                                 │              │
│     │                                           │              │
│     │ Built URL:                                │              │
│     │ http://192.168.1.66/cgi-bin/ptz.cgi?      │              │
│     │   action=start&channel=2&code=Left        │              │
│     │   &arg1=0&arg2=5&arg3=0                   │              │
│     └───────────────────────────────────────────┘              │
│                                                                 │
│  5. ⭐ Send HTTP Request to Camera ⭐                           │
│     ┌───────────────────────────────────────────┐              │
│     │ import { DigestClient }                   │              │
│     │   from 'digest-fetch';                    │              │
│     │                                           │              │
│     │ const client = new DigestClient(          │              │
│     │   'aidev',                                │              │
│     │   'aidev123'                              │              │
│     │ );                                        │              │
│     │                                           │              │
│     │ const response = await client.fetch(      │              │
│     │   url,                                    │              │
│     │   { method: 'GET', timeout: 5000 }        │              │
│     │ );                                        │              │
│     │                                           │              │
│     │ // Camera returns: "OK"                   │              │
│     └───────────────────────────────────────────┘              │
│                                                                 │
│  6. Schedule auto-stop command                                 │
│     ┌───────────────────────────────────────────┐              │
│     │ if (duration > 0) {                       │              │
│     │   setTimeout(async () => {                │              │
│     │     const stopUrl =                       │              │
│     │       'http://192.168.1.66/cgi-bin/       │              │
│     │        ptz.cgi?action=stop&               │              │
│     │        channel=2&code=Left&               │              │
│     │        arg1=0&arg2=0&arg3=0';             │              │
│     │                                           │              │
│     │     await client.fetch(stopUrl);          │              │
│     │   }, 2000); // Stop after 2 seconds       │              │
│     │ }                                         │              │
│     └───────────────────────────────────────────┘              │
│                                                                 │
│  7. Save PTZ log to database                                   │
│     ┌───────────────────────────────────────────┐              │
│     │ INSERT INTO ptz_logs (                    │              │
│     │   camera_id,                              │              │
│     │   action,                                 │              │
│     │   speed,                                  │              │
│     │   duration,                               │              │
│     │   status,                                 │              │
│     │   timestamp                               │              │
│     │ )                                         │              │
│     └───────────────────────────────────────────┘              │
│                                                                 │
└──────┬──────────────────────────────────────────────────────────┘
       │
       │ Return response
       ▼
┌─────────────────────────────────────┐
│      PtzController                  │
│  Returns: {                         │
│    ok: true,                        │
│    action: "PAN_LEFT",              │
│    speed: 5,                        │
│    willAutoStopAfterMs: 2000        │
│  }                                  │
└──────┬──────────────────────────────┘
       │
       ▼
┌──────────────┐
│   Client     │ ← Response received
└──────────────┘

       ║
       ║ Meanwhile, in parallel...
       ▼
┌─────────────────────────────────────┐
│   Dahua Camera (192.168.1.66)       │
│   🎥 CAMERA PHYSICALLY MOVES!       │
│                                     │
│   - Receives HTTP request           │
│   - Authenticates Digest Auth       │
│   - Executes PTZ command            │
│   - Motor moves left                │
│   - Continues for 2 seconds         │
│   - Receives STOP command           │
│   - Motor stops                     │
└─────────────────────────────────────┘
```

---

## 📹 Luồng Video Streaming

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ GET /streams/:cameraId/url
     ▼
┌─────────────────┐
│StreamController │
└────┬────────────┘
     │
     │ getStreamUrl(cameraId)
     ▼
┌─────────────────┐
│ StreamService   │
└────┬────────────┘
     │
     │ Get camera info
     ▼
┌─────────────────┐
│CameraRepository │
└────┬────────────┘
     │
     │ Build RTSP URL
     ▼
┌─────────────────────────────────────┐
│ RTSP URL Format:                    │
│ rtsp://{user}:{pass}@{ip}:554/      │
│   cam/realmonitor?channel={ch}      │
│   &subtype=0                        │
│                                     │
│ Example:                            │
│ rtsp://aidev:aidev123@              │
│   192.168.1.66:554/cam/             │
│   realmonitor?channel=2&subtype=0   │
└────┬────────────────────────────────┘
     │
     │ Return RTSP URL
     ▼
┌──────────┐
│  Client  │ → Plays via VLC/FFmpeg/Video.js
└──────────┘
```

---

## 📸 Luồng Snapshot Capture

```
┌──────────┐
│  Client  │
└────┬─────┘
     │
     │ POST /snapshots/capture
     │ Body: { cameraId, description }
     ▼
┌─────────────────┐
│SnapshotController
└────┬────────────┘
     │
     │ captureSnapshot()
     ▼
┌─────────────────┐
│ SnapshotService │
└────┬────────────┘
     │
     │ Get camera info
     ▼
┌─────────────────┐
│CameraRepository │
└────┬────────────┘
     │
     │ HTTP Request to camera
     ▼
┌──────────────────────────────────────┐
│ Camera CGI API:                      │
│ http://{ip}/cgi-bin/snapshot.cgi?    │
│   channel={channel}                  │
│                                      │
│ Example:                             │
│ http://192.168.1.66/cgi-bin/         │
│   snapshot.cgi?channel=2             │
│                                      │
│ Returns: JPEG image binary           │
└────┬─────────────────────────────────┘
     │
     │ Save image to file system
     ▼
┌─────────────────────────────────────┐
│ File System:                        │
│ /uploads/snapshots/                 │
│   {cameraId}_{timestamp}.jpg        │
└────┬────────────────────────────────┘
     │
     │ Save metadata to DB
     ▼
┌─────────────────────────────────────┐
│ INSERT INTO snapshots (             │
│   camera_id, file_path, size,       │
│   description, created_at           │
│ )                                   │
└────┬────────────────────────────────┘
     │
     │ Return snapshot info
     ▼
┌──────────┐
│  Client  │
└──────────┘
```

---

## 🎬 Database Schema Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS TABLE                             │
├──────────────┬──────────────────────┬──────────────────────────┤
│ id (UUID)    │ username (unique)    │ password (hashed)        │
│ email        │ role (admin/user)    │ isActive (boolean)       │
│ created_at   │ updated_at           │                          │
└──────────────┴──────────────────────┴──────────────────────────┘
                          │
                          │ 1:N relationship
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                        CAMERAS TABLE                            │
├──────────────┬──────────────────────┬──────────────────────────┤
│ id (UUID)    │ name                 │ ipAddress                │
│ username     │ password             │ channel                  │
│ sdkPort      │ onvifPort            │ location                 │
│ brand        │ model                │ isActive                 │
│ hasPtz       │ hasAudio             │ resolution               │
│ user_id (FK) │ created_at           │ updated_at               │
└──────────────┴──────────────────────┴──────────────────────────┘
         │
         ├─────────────────┐
         │                 │
         │ 1:N             │ 1:N
         ▼                 ▼
┌──────────────────┐  ┌──────────────────┐
│   PTZ_LOGS       │  │   RECORDINGS     │
├──────────────────┤  ├──────────────────┤
│ id               │  │ id               │
│ camera_id (FK)   │  │ camera_id (FK)   │
│ action           │  │ file_path        │
│ speed            │  │ start_time       │
│ duration         │  │ end_time         │
│ status           │  │ duration         │
│ error_message    │  │ file_size        │
│ created_at       │  │ status           │
└──────────────────┘  │ created_at       │
                      └──────────────────┘
         │
         ├─────────────────┐
         │                 │
         │ 1:N             │ 1:N
         ▼                 ▼
┌──────────────────┐  ┌──────────────────┐
│   SNAPSHOTS      │  │     EVENTS       │
├──────────────────┤  ├──────────────────┤
│ id               │  │ id               │
│ camera_id (FK)   │  │ camera_id (FK)   │
│ file_path        │  │ event_type       │
│ file_size        │  │ description      │
│ width            │  │ severity         │
│ height           │  │ is_acknowledged  │
│ description      │  │ acknowledged_at  │
│ created_at       │  │ created_at       │
└──────────────────┘  └──────────────────┘
         │
         │ 1:N
         ▼
┌──────────────────┐
│   PLAYBACKS      │
├──────────────────┤
│ id               │
│ camera_id (FK)   │
│ recording_id (FK)│
│ current_position │
│ playback_rate    │
│ status           │
│ started_at       │
│ created_at       │
└──────────────────┘
```

---

## 🔌 API Endpoints Overview

### **Authentication**
```
POST   /auth/register          - Đăng ký user mới
POST   /auth/login             - Đăng nhập (trả về JWT)
POST   /auth/refresh           - Refresh access token
POST   /auth/logout            - Đăng xuất
```

### **Cameras**
```
GET    /cameras                - Lấy danh sách cameras
POST   /cameras                - Thêm camera mới
GET    /cameras/:id            - Lấy thông tin camera
PATCH  /cameras/:id            - Cập nhật camera
DELETE /cameras/:id            - Xóa camera
GET    /cameras/:id/verify     - Verify kết nối camera
POST   /cameras/bulk-channels  - Thêm nhiều channels
```

### **PTZ Control** ⭐
```
POST   /cameras/:id/ptz        - Điều khiển PTZ
GET    /cameras/:id/ptz/status - Lấy trạng thái PTZ
GET    /cameras/:id/ptz/logs   - Lấy PTZ logs
GET    /cameras/ptz/logs/advanced - Lấy PTZ logs nâng cao
```

**PTZ Actions:**
- `PAN_LEFT`, `PAN_RIGHT`
- `TILT_UP`, `TILT_DOWN`
- `ZOOM_IN`, `ZOOM_OUT`
- `GOTO_PRESET`, `SET_PRESET`
- `AUTO_SCAN`, `STOP`

### **Streaming**
```
GET    /streams/:cameraId/url  - Lấy RTSP URL
```

### **Recording**
```
POST   /recordings/start       - Bắt đầu recording
GET    /recordings             - Lấy danh sách recordings
GET    /recordings/:id         - Lấy thông tin recording
PUT    /recordings/:id/stop    - Dừng recording
GET    /recordings/:id/download - Download recording
```

### **Snapshots**
```
POST   /snapshots/capture      - Chụp snapshot
POST   /snapshots/capture/network - Chụp qua network
GET    /snapshots              - Lấy danh sách snapshots
GET    /snapshots/:id          - Lấy snapshot
DELETE /snapshots/:id          - Xóa snapshot
```

### **Events**
```
POST   /events                 - Tạo event mới
GET    /events                 - Lấy danh sách events
GET    /events/:id             - Lấy thông tin event
PUT    /events/:id/ack         - Acknowledge event
DELETE /events/:id             - Xóa event
DELETE /events/by-camera/:cameraId - Xóa events theo camera
POST   /events/simulate-motion/:cameraId - Simulate motion event
```

### **Playback**
```
POST   /playbacks              - Tạo playback session
GET    /playbacks              - Lấy danh sách playbacks
GET    /playbacks/:id          - Lấy thông tin playback
PATCH  /playbacks/:id/position - Cập nhật vị trí playback
PATCH  /playbacks/:id/status   - Cập nhật trạng thái
GET    /playbacks/:id/download - Download video
DELETE /playbacks/:id          - Xóa playback session
GET    /playbacks/analytics    - Lấy analytics
```

---

## ⚙️ Environment Variables

```env
# Database
DB_TYPE=postgres
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_NAME=camera_api

# Application
PORT=3000
NODE_ENV=development

# JWT
JWT_SECRET=your_jwt_secret_key_here
JWT_EXPIRES_IN=1h
JWT_REFRESH_SECRET=your_refresh_secret_key
JWT_REFRESH_EXPIRES_IN=7d

# PTZ Configuration
PTZ_USE_ONVIF=0                 # 0 = HTTP API, 1 = ONVIF
PTZ_DEFAULT_SPEED=5
PTZ_DEFAULT_DURATION=2000

# File Upload
UPLOAD_PATH=./uploads
MAX_FILE_SIZE=100MB
```

---

## 🚀 Technology Stack

### **Backend Framework**
- **NestJS** - Progressive Node.js framework
- **TypeScript** - Type-safe JavaScript
- **Express** - HTTP server

### **Database**
- **PostgreSQL** - Relational database
- **TypeORM** - ORM framework

### **Authentication**
- **JWT** - JSON Web Tokens
- **Passport** - Authentication middleware
- **bcrypt** - Password hashing

### **Camera Communication**
- **digest-fetch** - Digest authentication (Dahua API)
- **onvif** - ONVIF protocol support
- **axios** - HTTP client

### **Others**
- **class-validator** - DTO validation
- **class-transformer** - Object transformation
- **multer** - File upload handling

---

## 📦 Module Structure

```
src/
├── app.module.ts                 # Root module
├── main.ts                       # Application entry point
│
├── modules/
│   ├── auth/                     # Authentication & Authorization
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── jwt.strategy.ts
│   │   └── dto/
│   │
│   ├── users/                    # User management
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── user.entity.ts
│   │   └── dto/
│   │
│   ├── camera/                   # Camera management
│   │   ├── camera.module.ts
│   │   ├── camera.controller.ts
│   │   ├── camera.service.ts
│   │   ├── camera.entity.ts
│   │   └── dto/
│   │
│   ├── ptz/                      # PTZ Control ⭐
│   │   ├── ptz.module.ts
│   │   ├── ptz.controller.ts
│   │   ├── ptz.service.ts
│   │   ├── ptz-log.entity.ts
│   │   ├── onvif-ptz.helper.ts  # ONVIF helper (not used)
│   │   ├── ptz-command-map.ts   # Command mapping
│   │   └── dto/
│   │
│   ├── stream/                   # Video streaming
│   │   ├── stream.module.ts
│   │   ├── stream.controller.ts
│   │   └── stream.service.ts
│   │
│   ├── recording/                # Recording management
│   │   ├── recording.module.ts
│   │   ├── recording.controller.ts
│   │   ├── recording.service.ts
│   │   ├── recording.entity.ts
│   │   └── dto/
│   │
│   ├── snapshot/                 # Snapshot capture
│   │   ├── snapshot.module.ts
│   │   ├── snapshot.controller.ts
│   │   ├── snapshot.service.ts
│   │   ├── snapshot.entity.ts
│   │   └── dto/
│   │
│   ├── event/                    # Event management
│   │   ├── event.module.ts
│   │   ├── event.controller.ts
│   │   ├── event.service.ts
│   │   ├── event.entity.ts
│   │   └── dto/
│   │
│   └── playback/                 # Playback management
│       ├── playback.module.ts
│       ├── playback.controller.ts
│       ├── playback.service.ts
│       ├── playback.entity.ts
│       └── dto/
│
├── common/                       # Shared utilities
│   ├── decorators/
│   ├── filters/
│   ├── guards/
│   ├── interceptors/
│   └── pipes/
│
└── config/                       # Configuration
    ├── database.config.ts
    └── jwt.config.ts
```

---

## 🔒 Security Features

```
┌─────────────────────────────────────────────────────────────┐
│                    SECURITY LAYERS                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1. JWT Authentication                                      │
│     ✓ Token-based authentication                           │
│     ✓ Short-lived access tokens (1h)                       │
│     ✓ Long-lived refresh tokens (7d)                       │
│     ✓ Secure token storage                                 │
│                                                             │
│  2. Password Security                                       │
│     ✓ bcrypt hashing (10 rounds)                           │
│     ✓ Salt per password                                    │
│     ✓ No plain text storage                                │
│                                                             │
│  3. Camera Authentication                                   │
│     ✓ Digest Authentication (Dahua)                        │
│     ✓ Credentials encrypted in DB                          │
│     ✓ Per-camera credentials                               │
│                                                             │
│  4. API Security                                            │
│     ✓ CORS enabled                                         │
│     ✓ Rate limiting                                        │
│     ✓ Input validation (class-validator)                   │
│     ✓ SQL injection prevention (TypeORM)                   │
│                                                             │
│  5. Role-Based Access Control                              │
│     ✓ Admin vs User roles                                  │
│     ✓ Resource ownership validation                        │
│     ✓ Route guards                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📊 System Status

### ✅ **Implemented & Working**
- Authentication & Authorization
- Camera CRUD operations
- **PTZ Control via HTTP CGI API** ⭐
- RTSP streaming URL generation
- Snapshot capture
- Recording management
- Event logging
- Playback sessions

### ⚠️ **Partially Implemented**
- ONVIF support (exists but not used)
- File upload for recordings
- Real-time notifications

### 🔄 **Future Enhancements**
- WebSocket for real-time updates
- Video analytics (motion detection, face recognition)
- Multi-camera synchronization
- Cloud storage integration
- Mobile app API optimization
- Performance monitoring dashboard

---

## 🎯 Key Success Factors

✅ **Camera PTZ Control Working**
- Dahua HTTP CGI API integrated
- Digest authentication implemented
- Auto-stop functionality
- Command mapping complete
- Channel=2 configuration correct

✅ **Database Structure**
- Normalized schema
- Foreign key relationships
- Audit fields (created_at, updated_at)
- UUID primary keys

✅ **Code Quality**
- TypeScript type safety
- DTOs for validation
- Service layer separation
- Repository pattern
- Error handling

✅ **Documentation**
- API endpoints documented
- Database schema documented
- PTZ testing guide
- System architecture (this file)

---

## 📞 Support & Contact

For technical questions or issues:
- Check documentation in `/docs` folder
- Review API endpoints with Hoppscotch
- Test PTZ with `TEST-PTZ.md` guide
- Check logs in console for debugging

---

**Last Updated:** October 8, 2025
**Version:** 1.0.0
**Status:** ✅ Production Ready (PTZ Control Working)
