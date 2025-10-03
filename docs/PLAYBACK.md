# PLAYBACK (Phát lại video đã ghi)

Quản lý playback sessions để phát lại video từ recordings đã ghi. Hỗ trợ HLS/DASH/RTSP/HTTP_MP4, pause/resume, seek, analytics.

---

## 📊 Schema bảng `playbacks`

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| id | uuid | Primary key |
| recording_id | uuid | FK → recordings(id), CASCADE DELETE |
| camera_id | uuid | FK → cameras(id), CASCADE DELETE |
| stream_url | varchar(500) | URL để phát video (m3u8/mpd/mp4/rtsp) |
| protocol | varchar(20) | HLS / DASH / RTSP / HTTP_MP4 |
| status | varchar(20) | PENDING / PLAYING / PAUSED / STOPPED / COMPLETED / FAILED |
| current_position_sec | int | Vị trí hiện tại trong video (giây) |
| started_at | timestamptz | Thời điểm bắt đầu phát |
| ended_at | timestamptz | Thời điểm kết thúc phát |
| user_id | uuid | User đã xem (nullable, audit) |
| username | varchar(100) | Username snapshot (audit) |
| error_message | varchar(500) | Lỗi nếu status = FAILED |
| user_agent | varchar(500) | Browser/app của client |
| client_ip | varchar(100) | IP address của client |
| created_at | timestamptz | Thời gian tạo session |
| updated_at | timestamptz | Thời gian cập nhật cuối |

**Indexes:**
- `recording_id` - Query playback history của recording
- `camera_id` - Query playback history của camera
- `status` - Filter active sessions
- `created_at` - Sort by time
- `(user_id, created_at)` - User playback history

---

## 🎯 Trạng thái Playback (Status)

| Status | Ý nghĩa | Chuyển từ | Chuyển đến |
|--------|--------|-----------|-----------|
| **PENDING** | Session vừa tạo, chưa bắt đầu phát | - | PLAYING, FAILED |
| **PLAYING** | Đang phát video | PENDING, PAUSED | PAUSED, STOPPED, COMPLETED, FAILED |
| **PAUSED** | Tạm dừng (có thể resume) | PLAYING | PLAYING, STOPPED |
| **STOPPED** | User dừng thủ công | PLAYING, PAUSED | - |
| **COMPLETED** | Xem xong toàn bộ video | PLAYING | - |
| **FAILED** | Lỗi khi phát | PENDING, PLAYING | - |

---

## 📡 Protocols hỗ trợ

| Protocol | Stream URL | Mô tả | Use Case |
|----------|------------|-------|----------|
| **HLS** | `.m3u8` | HTTP Live Streaming | Web/mobile, adaptive bitrate |
| **DASH** | `.mpd` | MPEG-DASH | Web modern, CDN |
| **RTSP** | `rtsp://...` | Real-Time Streaming | Native apps, low latency |
| **HTTP_MP4** | `.mp4` | Progressive download | Simple, direct download |

---

## 🔌 API Endpoints

| Method | Path | Mô tả | Quyền |
|--------|------|-------|-------|
| POST | `/playbacks` | Tạo playback session | ADMIN, OPERATOR, VIEWER |
| GET | `/playbacks` | Danh sách sessions (filter + pagination) | ADMIN, OPERATOR, VIEWER |
| GET | `/playbacks/analytics` | Thống kê playback | ADMIN, OPERATOR |
| GET | `/playbacks/:id` | Chi tiết session | ADMIN, OPERATOR, VIEWER |
| PATCH | `/playbacks/:id/position` | Cập nhật vị trí (seek/resume) | ADMIN, OPERATOR, VIEWER |
| PATCH | `/playbacks/:id/status` | Cập nhật trạng thái (play/pause/stop) | ADMIN, OPERATOR, VIEWER |
| GET | `/playbacks/:id/download` | Download file MP4 (range support) | ADMIN, OPERATOR, VIEWER |
| DELETE | `/playbacks/:id` | Xóa session | ADMIN, OPERATOR |

---

## 🚀 Luồng nghiệp vụ (Flow)

### 1. Tạo Playback Session

```
Client Request
    ↓
Validate recording exists & COMPLETED
    ↓
Check file tồn tại trên disk
    ↓
Generate stream URL (HLS/DASH/RTSP/HTTP_MP4)
    ↓
Extract user info (id, username, IP, user-agent)
    ↓
Create playback session (status=PENDING)
    ↓
Return {id, streamUrl, protocol, ...}
```

### 2. Phát Video (Play)

```
Client bắt đầu phát
    ↓
PATCH /playbacks/:id/position {currentPositionSec: 0}
    ↓
Auto-update: PENDING → PLAYING
    ↓
Set startedAt = now()
    ↓
Client định kỳ update position (heartbeat 10s)
```

### 3. Tua Video (Seek)

```
User tua đến giây 120
    ↓
PATCH /playbacks/:id/position {currentPositionSec: 120}
    ↓
Update current_position_sec
    ↓
Continue PLAYING
```

### 4. Tạm dừng (Pause)

```
User click Pause
    ↓
PATCH /playbacks/:id/status {status: "PAUSED"}
    ↓
Update status, keep position
```

### 5. Resume

```
User click Resume
    ↓
PATCH /playbacks/:id/status {status: "PLAYING"}
    ↓
Continue từ currentPositionSec
```

### 6. Hoàn thành (Auto-complete)

```
Client update position >= 95% duration
    ↓
Auto-update: PLAYING → COMPLETED
    ↓
Set endedAt = now()
```

---

## 📝 Body Request Examples

### POST /playbacks - Tạo session mới

```json
{
  "recordingId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "protocol": "HLS",          // optional: HLS/DASH/RTSP/HTTP_MP4
  "startPositionSec": 0       // optional: bắt đầu từ giây X
}
```

**Response 201 Created:**
```json
{
  "id": "f1e2d3c4-b5a6-7980-dcba-fe0987654321",
  "recording": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "storagePath": "C:/tmp/rec_xxx.mp4",
    "durationSec": 300,
    "status": "COMPLETED"
  },
  "camera": {
    "id": "9191910f-7757-4fbc-983b-c9ddcb994544",
    "name": "Camera Kho 1",
    "ipAddress": "192.168.1.108"
  },
  "streamUrl": "http://localhost:8080/playback/a1b2c3d4-e5f6-7890-abcd-ef1234567890/index.m3u8",
  "protocol": "HLS",
  "status": "PENDING",
  "currentPositionSec": 0,
  "userId": "user-uuid",
  "username": "admin",
  "clientIp": "192.168.1.100",
  "createdAt": "2025-10-02T10:00:00.000Z",
  "updatedAt": "2025-10-02T10:00:00.000Z"
}
```

### PATCH /playbacks/:id/position - Update vị trí

```json
{
  "currentPositionSec": 120
}
```

**Auto behavior:**
- PENDING → PLAYING (lần đầu update)
- PLAYING → COMPLETED (khi position >= 95% duration)

### PATCH /playbacks/:id/status - Update trạng thái

```json
{
  "status": "PAUSED"
}
```

**Valid transitions:**
- `PENDING` → `PLAYING`, `FAILED`
- `PLAYING` → `PAUSED`, `STOPPED`, `COMPLETED`, `FAILED`
- `PAUSED` → `PLAYING`, `STOPPED`

---

## 🔍 Query Parameters

### GET /playbacks - List sessions

| Param | Type | Ví dụ | Mô tả |
|-------|------|-------|-------|
| recordingId | uuid | `?recordingId=<uuid>` | Filter theo recording |
| cameraId | uuid | `?cameraId=<uuid>` | Filter theo camera |
| userId | uuid | `?userId=<uuid>` | Filter theo user |
| status | enum | `?status=PLAYING` | Filter theo trạng thái |
| from | ISO8601 | `?from=2025-10-01T00:00:00Z` | Từ thời gian |
| to | ISO8601 | `?to=2025-10-02T23:59:59Z` | Đến thời gian |
| page | int | `?page=2` | Trang hiện tại (default: 1) |
| pageSize | int | `?pageSize=50` | Số records/trang (default: 20, max: 100) |

**Response:**
```json
{
  "data": [ /* array of playback sessions */ ],
  "total": 150,
  "page": 1,
  "pageSize": 20,
  "totalPages": 8
}
```

### GET /playbacks/analytics - Thống kê

| Param | Type | Ví dụ | Mô tả |
|-------|------|-------|-------|
| recordingId | uuid | `?recordingId=<uuid>` | Thống kê cho recording |
| cameraId | uuid | `?cameraId=<uuid>` | Thống kê cho camera |
| from | ISO8601 | `?from=2025-10-01T00:00:00Z` | Từ thời gian |
| to | ISO8601 | `?to=2025-10-02T23:59:59Z` | Đến thời gian |

**Response:**
```json
{
  "totalSessions": 150,
  "completedSessions": 120,
  "averageWatchDuration": 180,  // giây
  "completionRate": 80.0,        // phần trăm
  "uniqueUsers": 45
}
```

---

## 🧪 Test nhanh (PowerShell)

### 1. Login

```powershell
$login = Invoke-RestMethod -Method POST -Uri http://localhost:3000/auth/login `
  -Body (@{ username='admin'; password='admin123' } | ConvertTo-Json) `
  -ContentType 'application/json'
$token = $login.accessToken
Write-Host "Token: $token"
```

### 2. Lấy recording đã COMPLETED

```powershell
$recordings = Invoke-RestMethod -Uri http://localhost:3000/recordings `
  -Headers @{ Authorization="Bearer $token" }
$completedRec = $recordings | Where-Object { $_.status -eq 'COMPLETED' } | Select-Object -First 1
Write-Host "Recording ID: $($completedRec.id)"
```

### 3. Tạo playback session (HLS)

```powershell
$playback = Invoke-RestMethod -Method POST -Uri http://localhost:3000/playbacks `
  -Headers @{ Authorization="Bearer $token" } `
  -Body (@{
    recordingId = $completedRec.id
    protocol = 'HLS'
    startPositionSec = 0
  } | ConvertTo-Json) `
  -ContentType 'application/json'

Write-Host "Playback ID: $($playback.id)"
Write-Host "Stream URL: $($playback.streamUrl)"
```

### 4. Bắt đầu phát (update position)

```powershell
$updated = Invoke-RestMethod -Method PATCH `
  -Uri "http://localhost:3000/playbacks/$($playback.id)/position" `
  -Headers @{ Authorization="Bearer $token" } `
  -Body (@{ currentPositionSec = 0 } | ConvertTo-Json) `
  -ContentType 'application/json'

Write-Host "Status: $($updated.status)"  # Should be PLAYING
```

### 5. Tua video đến giây 60

```powershell
Invoke-RestMethod -Method PATCH `
  -Uri "http://localhost:3000/playbacks/$($playback.id)/position" `
  -Headers @{ Authorization="Bearer $token" } `
  -Body (@{ currentPositionSec = 60 } | ConvertTo-Json) `
  -ContentType 'application/json'
```

### 6. Tạm dừng

```powershell
Invoke-RestMethod -Method PATCH `
  -Uri "http://localhost:3000/playbacks/$($playback.id)/status" `
  -Headers @{ Authorization="Bearer $token" } `
  -Body (@{ status = 'PAUSED' } | ConvertTo-Json) `
  -ContentType 'application/json'
```

### 7. Resume

```powershell
Invoke-RestMethod -Method PATCH `
  -Uri "http://localhost:3000/playbacks/$($playback.id)/status" `
  -Headers @{ Authorization="Bearer $token" } `
  -Body (@{ status = 'PLAYING' } | ConvertTo-Json) `
  -ContentType 'application/json'
```

### 8. Download MP4 (HTTP_MP4 protocol)

```powershell
Invoke-WebRequest `
  -Uri "http://localhost:3000/playbacks/$($playback.id)/download" `
  -Headers @{ Authorization="Bearer $token" } `
  -OutFile "downloaded-video.mp4"
```

### 9. Lấy thống kê

```powershell
$analytics = Invoke-RestMethod -Uri "http://localhost:3000/playbacks/analytics?cameraId=$($completedRec.camera.id)" `
  -Headers @{ Authorization="Bearer $token" }
Write-Host "Total sessions: $($analytics.totalSessions)"
Write-Host "Completion rate: $($analytics.completionRate)%"
```

### 10. Danh sách playbacks

```powershell
# Tất cả sessions
Invoke-RestMethod -Uri http://localhost:3000/playbacks `
  -Headers @{ Authorization="Bearer $token" }

# Filter theo status
Invoke-RestMethod -Uri "http://localhost:3000/playbacks?status=PLAYING" `
  -Headers @{ Authorization="Bearer $token" }

# Filter theo camera + time range
Invoke-RestMethod -Uri "http://localhost:3000/playbacks?cameraId=$($completedRec.camera.id)&from=2025-10-01T00:00:00Z" `
  -Headers @{ Authorization="Bearer $token" }
```

---

## ⚠️ Lỗi phổ biến

| Lỗi | Nguyên nhân | Khắc phục |
|-----|-------------|-----------|
| 404 Recording not found | Sai recordingId | Kiểm tra ID recording |
| 400 Cannot playback PENDING/RUNNING/FAILED recording | Recording chưa COMPLETED | Đợi recording hoàn tất |
| 404 Recording file not found | File đã bị xóa/di chuyển | Kiểm tra RECORD_DIR và storagePath |
| 400 Position exceeds duration | currentPositionSec > durationSec | Kiểm tra giá trị position |
| 400 Position cannot be negative | currentPositionSec < 0 | Kiểm tra giá trị position |
| 401 Unauthorized | Thiếu/sai JWT token | Kiểm tra header Authorization |
| 403 Forbidden | Role không đủ quyền | Kiểm tra role user (VIEWER có thể xem, không xóa) |

---

## 🔧 Environment Variables

| Env | Mô tả | Default | Ví dụ |
|-----|-------|---------|-------|
| `STREAM_BASE_URL` | Base URL cho HLS/DASH streams | `http://localhost:8080` | `https://cdn.example.com` |
| `API_BASE_URL` | Base URL cho HTTP_MP4 download | `http://localhost:3000` | `https://api.example.com` |
| `RECORD_DIR` | Thư mục lưu recordings | `%TEMP%` (Windows) | `C:/recordings` |

---

## 📊 Luồng Integration với Frontend

### Ví dụ: Video.js Player

```javascript
// 1. Tạo playback session
const response = await fetch('http://localhost:3000/playbacks', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    recordingId: 'a1b2c3d4-...',
    protocol: 'HLS'
  })
});

const playback = await response.json();

// 2. Load HLS stream vào Video.js
const player = videojs('my-video');
player.src({
  src: playback.streamUrl,
  type: 'application/x-mpegURL'
});

// 3. Update position mỗi 10 giây (heartbeat)
setInterval(async () => {
  const currentTime = Math.floor(player.currentTime());
  await fetch(`http://localhost:3000/playbacks/${playback.id}/position`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ currentPositionSec: currentTime })
  });
}, 10000);

// 4. Pause event
player.on('pause', async () => {
  await fetch(`http://localhost:3000/playbacks/${playback.id}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'PAUSED' })
  });
});

// 5. Play event
player.on('play', async () => {
  await fetch(`http://localhost:3000/playbacks/${playback.id}/status`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status: 'PLAYING' })
  });
});
```

---

## 🎯 Use Cases

### 1. Security Review (Xem lại video bảo mật)
```
Admin xem lại video phát hiện xâm nhập lúc 2AM
→ Tạo playback từ recording 2AM-3AM
→ Tua đến thời điểm sự kiện (seek)
→ Xem chi tiết, download để bảo quản
```

### 2. Training (Đào tạo nhân viên)
```
Trainer phát video hướng dẫn từ recordings
→ Pause để giải thích
→ Resume tiếp tục
→ Track completion rate (analytics)
```

### 3. Evidence (Bằng chứng pháp lý)
```
Cảnh sát yêu cầu video sự cố
→ Tạo playback từ recording sự cố
→ Download MP4 qua HTTP_MP4 protocol
→ Cung cấp file cho cơ quan chức năng
```

### 4. Quality Check (Kiểm tra chất lượng)
```
Kỹ thuật viên kiểm tra chất lượng recording
→ Playback nhiều recordings cùng lúc
→ So sánh codec, bitrate, fps
→ Analytics: completion rate thấp → video có vấn đề
```

---

## 🚀 Tính năng mở rộng (Future)

### 1. Transcoding on-the-fly
```typescript
// Convert MP4 → HLS real-time bằng FFmpeg
const transcodedUrl = await transcodeToHLS(recording.storagePath);
```

### 2. Adaptive Bitrate Streaming (ABR)
```typescript
// Generate multiple quality levels
const qualities = ['360p', '720p', '1080p'];
const manifestUrl = await generateAdaptiveManifest(recording, qualities);
```

### 3. DRM Protection
```typescript
// Encrypt HLS/DASH với Widevine/FairPlay
const protectedUrl = await applyDRM(playback.streamUrl, {
  drm: 'widevine',
  keyServer: 'https://license.example.com'
});
```

### 4. Multi-angle Playback
```typescript
// Sync playback nhiều camera cùng lúc
const syncedPlaybacks = await createSyncedPlayback([
  recording1, recording2, recording3
]);
```

### 5. AI Highlights
```typescript
// Tự động phát hiện điểm nổi bật (motion, faces)
const highlights = await detectHighlights(recording);
// [ { timestampSec: 120, type: 'MOTION' }, ... ]
```

---

## 📖 Ghi chú kỹ thuật

### Range Requests (Video Seeking)
- API `/playbacks/:id/download` hỗ trợ HTTP Range header
- Cho phép seeking trong video mà không cần download toàn bộ
- Browser tự động gửi Range request khi user tua video

### Auto-completion Logic
- Auto-set status = COMPLETED khi `currentPositionSec >= 95% duration`
- Threshold 95% để tránh video chưa hết nhưng buffer đã hết

### Cascade Delete
- Xóa recording → auto xóa playback sessions
- Xóa camera → auto xóa playback history
- Đảm bảo data consistency

### Audit Trail
- Lưu user_id, username, client_ip, user_agent
- Không FK đến users table (avoid hard constraint)
- Giữ lại audit info khi user bị xóa

---

## 📚 Tài liệu liên quan

- [RECORDING.md](./RECORDING.md) - Ghi video từ camera
- [STREAM.md](./STREAM.md) - Live streaming URLs
- [AUTH.md](./AUTH.md) - Authentication & Authorization
- [CAMERA.md](./CAMERA.md) - Camera management

---

**Last updated:** October 2, 2025
