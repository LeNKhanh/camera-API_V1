# EVENT-TRIGGERED RECORDING - IMPLEMENTATION SUMMARY

## 📋 Tổng quan
Hệ thống được redesign hoàn toàn:
- **Trước**: User request playback → Play pre-recorded file → Track position/status
- **Sau**: Event created → Auto-start FFmpeg recording → Upload R2 when event ends

## ✅ Hoàn thành (2025-01-XX)

### 1. Database Migration
**File**: `src/migrations/1730000000000-add-event-triggered-recording.ts`

**Schema Changes**:
```sql
-- ADD NEW COLUMNS
ALTER TABLE playbacks ADD COLUMN event_id UUID;
ALTER TABLE playbacks ADD COLUMN recording_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE playbacks ADD COLUMN video_url VARCHAR(500);
ALTER TABLE playbacks ADD COLUMN local_path VARCHAR(500);
ALTER TABLE playbacks ADD COLUMN file_size_bytes BIGINT;
ALTER TABLE playbacks ADD COLUMN duration_sec INT;
ALTER TABLE playbacks ADD COLUMN codec VARCHAR(50);
ALTER TABLE playbacks ADD COLUMN resolution VARCHAR(50);

-- ADD FOREIGN KEY
ALTER TABLE playbacks ADD CONSTRAINT FK_playbacks_event 
  FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE SET NULL;

-- CREATE INDEXES
CREATE INDEX idx_playbacks_event ON playbacks(event_id);
CREATE INDEX idx_playbacks_recording_status ON playbacks(recording_status);

-- DROP OLD COLUMNS
ALTER TABLE playbacks DROP COLUMN recording_id;
ALTER TABLE playbacks DROP COLUMN user_id;
ALTER TABLE playbacks DROP COLUMN status;
ALTER TABLE playbacks DROP COLUMN position;
ALTER TABLE playbacks DROP COLUMN speed;
ALTER TABLE playbacks DROP COLUMN stream_url;
ALTER TABLE playbacks DROP COLUMN protocol;
ALTER TABLE playbacks DROP COLUMN current_position_sec;
ALTER TABLE playbacks DROP COLUMN username;
ALTER TABLE playbacks DROP COLUMN user_agent;
ALTER TABLE playbacks DROP COLUMN client_ip;
ALTER TABLE playbacks DROP COLUMN error_message;
```

**Status**: ✅ Migration file created, chưa run

---

### 2. Entity Refactoring
**File**: `src/typeorm/entities/playback.entity.ts`

**Changes**:
```typescript
// REMOVED (old playback-session model)
- recording: Recording relation
- PlaybackStatus: 'PENDING'|'PLAYING'|'PAUSED'|'STOPPED'|'COMPLETED'|'FAILED'
- PlaybackProtocol: 'HLS'|'DASH'|'RTSP'|'HTTP_MP4'
- userId, username, userAgent, clientIp (user tracking)
- currentPositionSec, streamUrl, protocol (position tracking)

// ADDED (new event-recording model)
- event?: Event | null (nullable FK to events)
- RecordingStatus: 'PENDING'|'RECORDING'|'PROCESSING'|'COMPLETED'|'FAILED'
- videoUrl?: string (R2 public URL)
- localPath?: string (temp file path during recording)
- fileSizeBytes?: number (video file size)
- durationSec?: number (video duration)
- codec?: string (video codec, e.g., H.264, H.265)
- resolution?: string (video resolution, e.g., 1080p)
```

**Status**: ✅ Entity updated successfully

---

### 3. PlaybackService - Hoàn toàn mới
**File**: `src/modules/playback/playback.service.ts`

**Core Methods**:

#### `startRecordingForEvent(eventId, cameraId)`
1. Validate event và camera
2. Tạo Playback record với status='RECORDING'
3. Spawn FFmpeg process:
   ```bash
   ffmpeg -rtsp_transport tcp \
          -i rtsp://192.168.1.66:554/... \
          -c:v copy \
          -c:a aac \
          -f mp4 \
          -movflags +faststart \
          /tmp/playbacks/playback_{id}_{timestamp}.mp4
   ```
4. Store FFmpeg process vào Map
5. Return playback record

#### `stopRecordingForEvent(eventId)`
1. Tìm playback với event_id và status='RECORDING'
2. Kill FFmpeg process (SIGINT cho graceful stop)
3. Wait 2s để FFmpeg đóng file
4. Update status='PROCESSING'
5. Call `uploadToR2()` (async)
6. Return playback

#### `uploadToR2(playbackId, localPath)`
1. Validate file exists
2. Get file stats (size, duration với ffprobe)
3. Upload lên R2 với key: `playbacks/{playbackId}/video.mp4`
4. Update playback: videoUrl, fileSizeBytes, durationSec, status='COMPLETED'
5. Delete local temp file

#### `list(filter)`, `get(id)`, `delete(id)`, `manualStopRecording(playbackId)`
CRUD operations cho playback management

**Dependencies**:
- `ffmpeg-static`: FFmpeg binary
- `ffprobe`: Video metadata extraction (duration, codec)
- `StorageService`: R2 upload/delete (from existing snapshot/recording modules)

**Status**: ✅ Service implemented completely

---

### 4. EventService Integration
**File**: `src/modules/event/event.service.ts`

**Changes**:

#### `create(dto)` - Auto-trigger recording
```typescript
async create(dto) {
  // 1. Create event (existing logic)
  const cam = await this.camRepo.findOne({ where: { id: dto.cameraId } });
  const ev = this.eventRepo.create({ camera: cam, type: dto.type, ... });
  const savedEvent = await this.eventRepo.save(ev);

  // 2. NEW: Auto-start recording if type='MOTION'
  if (dto.type === 'MOTION') {
    try {
      await this.playbackService.startRecordingForEvent(savedEvent.id, dto.cameraId);
    } catch (err) {
      console.error('Failed to start recording:', err);
      // Don't throw - event created successfully, recording failed
    }
  }

  return savedEvent;
}
```

#### `endEvent(eventId)` - Stop recording
```typescript
async endEvent(eventId: string) {
  // 1. Validate event exists
  const ev = await this.eventRepo.findOne({ where: { id: eventId } });
  if (!ev) throw new NotFoundException();

  // 2. Stop recording → upload R2
  const playback = await this.playbackService.stopRecordingForEvent(eventId);
  return { ok: true, eventId, playbackId: playback.id };
}
```

**Status**: ✅ Service updated with auto-trigger logic

---

### 5. EventController - New endpoint
**File**: `src/modules/event/event.controller.ts`

**New Endpoint**:
```typescript
// POST /events/:id/end
@Post(':id/end')
@Roles('ADMIN', 'OPERATOR')
endEvent(@Param('id') id: string) {
  return this.svc.endEvent(id);
}
```

**Status**: ✅ Endpoint added

---

### 6. PlaybackController - Simplified
**File**: `src/modules/playback/playback.controller.ts`

**Endpoints** (hoàn toàn mới):
```typescript
GET    /playbacks                    - List với filter (eventId, cameraId, recordingStatus)
GET    /playbacks/:id                - Chi tiết playback
DELETE /playbacks/:id                - Xóa playback + R2 video
POST   /playbacks/:id/stop           - Manual stop recording
```

**Removed Endpoints** (không còn cần):
```
POST   /playbacks                    - Không cần tạo thủ công (auto via event)
PATCH  /playbacks/:id/position       - Không track position nữa
PATCH  /playbacks/:id/status         - Không track play/pause nữa
GET    /playbacks/analytics          - Sẽ implement sau nếu cần
GET    /playbacks/:id/download       - Video có R2 URL, download trực tiếp
```

**Status**: ✅ Controller simplified completely

---

### 7. Module Dependencies
**File**: `src/modules/playback/playback.module.ts`

**Changes**:
```typescript
imports: [
  TypeOrmModule.forFeature([Playback, Event, Camera]), // Changed: Recording → Event
  StorageModule, // NEW: Import StorageModule
],
exports: [PlaybackService], // Export để EventService dùng
```

**File**: `src/modules/event/event.module.ts`

**Changes**:
```typescript
imports: [
  TypeOrmModule.forFeature([Event, Camera]),
  PlaybackModule, // NEW: Import PlaybackModule
],
```

**Status**: ✅ Dependencies configured

---

## 🔄 Luồng hoạt động (End-to-End)

### Scenario 1: Event-triggered recording
```
1. POST /events
   Body: { "cameraId": "xxx", "type": "MOTION" }
   
   ↓
   
2. EventService.create()
   - Tạo Event record
   - Auto-call PlaybackService.startRecordingForEvent()
   
   ↓
   
3. PlaybackService.startRecordingForEvent()
   - Tạo Playback record (status='RECORDING')
   - Spawn FFmpeg: rtsp://camera → /tmp/playback_xxx.mp4
   - Store process in Map
   
   ↓
   
4. Response to client:
   {
     "id": "event-uuid",
     "type": "MOTION",
     "camera": { ... },
     "createdAt": "2025-01-XX..."
   }
   
   (FFmpeg runs in background)
```

### Scenario 2: Stop recording and upload
```
1. POST /events/:id/end
   
   ↓
   
2. EventService.endEvent()
   - Validate event exists
   - Call PlaybackService.stopRecordingForEvent()
   
   ↓
   
3. PlaybackService.stopRecordingForEvent()
   - Find playback with event_id
   - Kill FFmpeg process (SIGINT)
   - Wait 2s
   - Update status='PROCESSING'
   - Call uploadToR2() async
   
   ↓
   
4. PlaybackService.uploadToR2()
   - Read file stats
   - Get duration with ffprobe
   - Upload to R2: playbacks/{playbackId}/video.mp4
   - Update: videoUrl, fileSizeBytes, durationSec, status='COMPLETED'
   - Delete local temp file
   
   ↓
   
5. Response to client:
   {
     "ok": true,
     "eventId": "xxx",
     "playbackId": "xxx",
     "recordingStatus": "PROCESSING" // hoặc COMPLETED nếu upload nhanh
   }
```

### Scenario 3: Query playback
```
1. GET /playbacks/:id
   
   ↓
   
2. Response:
   {
     "id": "playback-uuid",
     "event": { "id": "event-uuid", "type": "MOTION", ... },
     "camera": { "id": "camera-uuid", "name": "Camera 1", ... },
     "recordingStatus": "COMPLETED",
     "videoUrl": "https://iotek.tn-cdn.net/playbacks/xxx/video.mp4",
     "fileSizeBytes": 15728640,
     "durationSec": 45,
     "codec": "H.264",
     "resolution": "1080p",
     "startedAt": "2025-01-XX...",
     "endedAt": "2025-01-XX...",
     "createdAt": "2025-01-XX..."
   }
```

---

## 📦 Environment Variables

**Required for FFmpeg Recording**:
```bash
# Temp directory cho video files (default: /tmp/playbacks)
RECORD_DIR=/tmp/playbacks

# R2 Storage (existing)
R2_ENDPOINT=https://xxx.r2.cloudflarestorage.com
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=iotek
R2_PUBLIC_URL=https://iotek.tn-cdn.net
STORAGE_MODE=r2
```

---

## 🧪 Testing Flow

### 1. Run Migration
```bash
npm run migration:run
# Expected: Table playbacks altered successfully
```

### 2. Create MOTION Event (Auto-start recording)
```bash
POST http://localhost:3000/events
Authorization: Bearer {jwt_token}
Content-Type: application/json

{
  "cameraId": "49e77c80-af6e-4ac6-b0ea-b4f018dacac7",
  "type": "MOTION",
  "description": "Test event-triggered recording"
}

# Expected Response:
{
  "id": "event-uuid-123",
  "type": "MOTION",
  "camera": { "id": "xxx", "name": "Camera 1" },
  "createdAt": "2025-01-XX..."
}

# Check logs:
# [Event] Auto-starting recording for event event-uuid-123...
# [Playback] Starting recording for event event-uuid-123...
# [FFmpeg] Starting recording: rtsp://... → /tmp/playbacks/playback_xxx.mp4
```

### 3. Check Recording Status
```bash
GET http://localhost:3000/playbacks?eventId=event-uuid-123

# Expected:
{
  "data": [
    {
      "id": "playback-uuid",
      "recordingStatus": "RECORDING",
      "localPath": "/tmp/playbacks/playback_xxx_1234567890.mp4",
      "event": { "id": "event-uuid-123" },
      "camera": { "id": "xxx" }
    }
  ],
  "total": 1
}
```

### 4. Wait 30 seconds (recording...)

### 5. End Event (Stop recording)
```bash
POST http://localhost:3000/events/event-uuid-123/end

# Expected:
{
  "ok": true,
  "eventId": "event-uuid-123",
  "playbackId": "playback-uuid",
  "recordingStatus": "PROCESSING"
}

# Check logs:
# [Event] Ending event event-uuid-123, stopping recording...
# [Playback] Stopping recording for event event-uuid-123...
# [Playback] Sending SIGINT to FFmpeg process for playback-uuid...
# [FFmpeg playback-uuid] Process exited with code 0
# [Playback] Uploading playback-uuid to R2...
# [Playback] R2 key: playbacks/playback-uuid/playback_xxx.mp4
# [Playback] ✅ playback-uuid uploaded successfully: https://iotek.tn-cdn.net/playbacks/...
```

### 6. Verify Video on R2
```bash
GET http://localhost:3000/playbacks/playback-uuid

# Expected:
{
  "id": "playback-uuid",
  "recordingStatus": "COMPLETED",
  "videoUrl": "https://iotek.tn-cdn.net/playbacks/playback-uuid/video.mp4",
  "fileSizeBytes": 15728640,
  "durationSec": 30,
  "codec": "H.264",
  "resolution": "1080p",
  "startedAt": "2025-01-XX...",
  "endedAt": "2025-01-XX..."
}

# Test video URL trong browser hoặc VLC:
# https://iotek.tn-cdn.net/playbacks/playback-uuid/video.mp4
```

---

## 📁 Backup Files

**Old implementations backed up**:
- `src/modules/playback/playback.service.backup.ts` (old playback-session service)
- `src/modules/playback/playback.controller.backup.ts` (old controller with position/status tracking)

**Lý do backup**: Có thể cần reference old code hoặc restore nếu có vấn đề

---

## 🚀 Next Steps

### 1. Deployment Checklist
- [ ] Test migration trên local database
- [ ] Test end-to-end flow với camera thật (Dahua PTZ)
- [ ] Verify R2 upload working với credentials production
- [ ] Test FFmpeg graceful shutdown (SIGINT)
- [ ] Test disk space management (cleanup old temp files)

### 2. Production Deployment
```bash
# 1. SSH vào production server
ssh user@production-server

# 2. Pull latest code
cd /path/to/Camera-api
git pull origin main

# 3. Install dependencies (if package.json changed)
npm install

# 4. Run migration
npm run migration:run

# 5. Restart application
pm2 restart camera-api
# or (Coolify auto-restart on push)

# 6. Verify logs
pm2 logs camera-api
# Check for migration success, no errors on startup
```

### 3. Enhancements (Future)
- [ ] **Auto-cleanup**: Delete local temp files older than 1 hour
- [ ] **Progress tracking**: Parse FFmpeg stderr to show recording progress (frames, bitrate)
- [ ] **Error handling**: Retry R2 upload on failure
- [ ] **Webhook**: Notify external system when recording completed
- [ ] **Thumbnail**: Extract thumbnail from video (ffmpeg -ss 00:00:01 -i video.mp4 -vframes 1 thumb.jpg)
- [ ] **Analytics**: Recording statistics (total duration, total size, success rate)
- [ ] **Concurrent recordings**: Support multiple cameras recording simultaneously
- [ ] **Manual recording**: API endpoint để start recording không cần event

---

## 🐛 Known Issues & Considerations

### 1. FFmpeg Process Management
- **Issue**: Nếu Node.js crash, FFmpeg processes có thể orphaned
- **Mitigation**: Use process monitoring tool (PM2) để restart, cleanup orphaned processes on startup

### 2. Disk Space
- **Issue**: Temp files có thể fill disk nếu không cleanup
- **Mitigation**: 
  - Set RECORD_DIR to partition có space lớn
  - Implement auto-cleanup (delete files older than 1 hour)
  - Monitor disk usage

### 3. R2 Upload Latency
- **Issue**: Upload video lớn (>100MB) có thể mất vài phút
- **Mitigation**: 
  - Status='PROCESSING' để client biết đang upload
  - Async upload không block response
  - Implement retry logic

### 4. Concurrent Recordings
- **Issue**: Multiple cameras recording cùng lúc → CPU/bandwidth spike
- **Mitigation**:
  - Monitor server resources
  - Limit concurrent recordings (queue system)
  - Use `-c:v copy` để không transcode (copy video codec directly)

### 5. RTSP Stream Stability
- **Issue**: RTSP stream có thể disconnect, FFmpeg exit unexpectedly
- **Mitigation**:
  - FFmpeg error event listener
  - Update playback status='FAILED' nếu FFmpeg exit code != 0
  - Retry logic (restart FFmpeg nếu fail trong 5s đầu)

---

## 📚 Related Documentation
- `PLAYBACK-REDESIGN.md` - Design document chi tiết
- `docs/PLAYBACK.md` - API documentation (need update)
- `docs/EVENT.md` - Event system documentation (need update)
- `docs/ONVIF_IMPLEMENTATION_SUMMARY.md` - ONVIF integration (camera RTSP URLs)

---

## ✅ Completion Checklist

- [x] Migration script created
- [x] Playback entity refactored
- [x] PlaybackService implemented
- [x] EventService integration
- [x] EventController endpoint added
- [x] PlaybackController simplified
- [x] Module dependencies configured
- [x] No TypeScript errors
- [ ] Migration run on database
- [ ] End-to-end testing với camera thật
- [ ] Production deployment
- [ ] Documentation updated (PLAYBACK.md, EVENT.md)

---

## 📝 Commit Message (Suggested)

```
feat: Implement event-triggered recording system

- Redesign playback architecture from user-session to event-driven
- Auto-start FFmpeg recording when MOTION event created
- Upload video to R2 when event ends
- Simplify playback API (remove position/status tracking)

BREAKING CHANGES:
- Playback entity schema changed (migration required)
- Old playback endpoints removed (create, update position/status)
- New endpoint: POST /events/:id/end

Files changed:
- src/migrations/1730000000000-add-event-triggered-recording.ts
- src/typeorm/entities/playback.entity.ts
- src/modules/playback/playback.service.ts (rewritten)
- src/modules/playback/playback.controller.ts (simplified)
- src/modules/event/event.service.ts (auto-trigger)
- src/modules/event/event.controller.ts (new endpoint)
- src/modules/playback/playback.module.ts (dependencies)
- src/modules/event/event.module.ts (dependencies)

Backup files:
- playback.service.backup.ts
- playback.controller.backup.ts
```

---

**Status**: ✅ Implementation Complete - Ready for Testing
**Date**: 2025-01-XX
**Author**: AI Assistant (GitHub Copilot)
