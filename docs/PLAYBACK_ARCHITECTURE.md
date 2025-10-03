# PLAYBACK API - Architecture & Flow Documentation

## Kiến trúc tổng quan

```
┌─────────────────────────────────────────────────────────────────────┐
│                          CLIENT (Browser/App)                        │
│                                                                       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ Video Player │  │ Progress Bar │  │  Controls    │              │
│  │ (HLS/DASH)   │  │   (Seek)     │  │(Play/Pause)  │              │
│  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘              │
│         │                  │                  │                       │
└─────────┼──────────────────┼──────────────────┼───────────────────────┘
          │                  │                  │
          │ Load Stream      │ Update Position  │ Update Status
          ▼                  ▼                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      PLAYBACK CONTROLLER                             │
│                                                                       │
│  POST   /playbacks              ← Tạo session                        │
│  PATCH  /playbacks/:id/position ← Seek / Heartbeat                   │
│  PATCH  /playbacks/:id/status   ← Play / Pause / Stop                │
│  GET    /playbacks/:id/download ← Download MP4                       │
│  GET    /playbacks/analytics    ← Thống kê                           │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       PLAYBACK SERVICE                                │
│                                                                       │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │   Validation   │  │ Stream URL Gen │  │   Analytics    │        │
│  │  (Recording    │  │ (HLS/DASH/     │  │  (Completion   │        │
│  │   exists &     │  │  RTSP/HTTP)    │  │   Rate, Watch  │        │
│  │   COMPLETED)   │  │                │  │   Duration)    │        │
│  └────────────────┘  └────────────────┘  └────────────────┘        │
└─────────┬───────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────────────────┐
│                        DATABASE (PostgreSQL)                         │
│                                                                       │
│  ┌─────────────┐       ┌─────────────┐       ┌─────────────┐       │
│  │  playbacks  │  N─1  │ recordings  │  N─1  │   cameras   │       │
│  │             │───────│             │───────│             │       │
│  │  - status   │       │  - storage  │       │  - rtspUrl  │       │
│  │  - position │       │  - duration │       │  - channel  │       │
│  │  - streamUrl│       │  - status   │       │             │       │
│  └─────────────┘       └─────────────┘       └─────────────┘       │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Luồng nghiệp vụ chi tiết

### 1. CREATE PLAYBACK SESSION

```
┌─────────┐
│ CLIENT  │
└────┬────┘
     │ POST /playbacks
     │ { recordingId: "xxx", protocol: "HLS" }
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PlaybackController.create()                                 │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PlaybackService.create()                                    │
│                                                              │
│ STEP 1: Validate Recording                                  │
│   ├─ Find recording by ID                                   │
│   ├─ Check status === 'COMPLETED'                           │
│   └─ If not → throw BadRequestException                     │
│                                                              │
│ STEP 2: Validate File                                       │
│   ├─ Check existsSync(recording.storagePath)                │
│   └─ If not → throw NotFoundException                       │
│                                                              │
│ STEP 3: Generate Stream URL                                 │
│   ├─ HLS:  http://host/playback/{id}/index.m3u8            │
│   ├─ DASH: http://host/playback/{id}/manifest.mpd          │
│   ├─ RTSP: rtsp://host/playback/{id}                        │
│   └─ HTTP_MP4: http://api/playbacks/{id}/download           │
│                                                              │
│ STEP 4: Extract User Info                                   │
│   ├─ req.user → userId, username                            │
│   ├─ req.headers['user-agent'] → userAgent                  │
│   └─ req.ip / x-forwarded-for → clientIp                    │
│                                                              │
│ STEP 5: Create Playback Entity                              │
│   ├─ status: PENDING                                        │
│   ├─ currentPositionSec: 0                                  │
│   ├─ startedAt: null (chưa bắt đầu)                         │
│   └─ Save to DB                                             │
│                                                              │
│ STEP 6: Return with Relations                               │
│   └─ Include recording & camera objects                     │
└────┬─────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Response 201 Created                                         │
│ {                                                            │
│   id: "playback-uuid",                                       │
│   streamUrl: "http://.../index.m3u8",                        │
│   protocol: "HLS",                                           │
│   status: "PENDING",                                         │
│   recording: {...},                                          │
│   camera: {...}                                              │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
```

### 2. START PLAYING (Auto Status Update)

```
┌─────────┐
│ CLIENT  │ User click Play / Video player loads
└────┬────┘
     │ PATCH /playbacks/{id}/position
     │ { currentPositionSec: 0 }
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PlaybackController.updatePosition()                         │
└────┬────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PlaybackService.updatePosition()                            │
│                                                              │
│ 1. Validate Position                                        │
│    ├─ currentPositionSec >= 0                               │
│    └─ currentPositionSec <= recording.durationSec           │
│                                                              │
│ 2. Auto-update Status (if PENDING)                          │
│    ├─ status: PENDING → PLAYING                             │
│    └─ startedAt: now()                                      │
│                                                              │
│ 3. Check Auto-complete (if PLAYING)                         │
│    ├─ If position >= 95% duration                           │
│    ├─ status: PLAYING → COMPLETED                           │
│    └─ endedAt: now()                                        │
│                                                              │
│ 4. Update Database                                          │
│    └─ Save changes                                          │
└────┬─────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Response 200 OK                                              │
│ {                                                            │
│   id: "playback-uuid",                                       │
│   status: "PLAYING",      ← Changed from PENDING            │
│   startedAt: "2025-10-02T10:00:00Z", ← Auto-set            │
│   currentPositionSec: 0,                                     │
│   ...                                                        │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
```

### 3. HEARTBEAT (Track Watch Duration)

```
┌─────────┐
│ CLIENT  │ setInterval(() => updatePosition(), 10000)
└────┬────┘
     │ Every 10 seconds
     ▼
     │ PATCH /playbacks/{id}/position
     │ { currentPositionSec: 10 }
     ▼
     │ PATCH /playbacks/{id}/position
     │ { currentPositionSec: 20 }
     ▼
     │ PATCH /playbacks/{id}/position
     │ { currentPositionSec: 30 }
     ▼
     ...

Purpose:
- Track how long user actually watched
- Calculate watch duration for analytics
- Auto-complete when reach 95% duration
```

### 4. SEEK (Tua video)

```
┌─────────┐
│ CLIENT  │ User drags progress bar to 2:00
└────┬────┘
     │ PATCH /playbacks/{id}/position
     │ { currentPositionSec: 120 }
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PlaybackService.updatePosition()                            │
│                                                              │
│ Update currentPositionSec: 120                               │
│ Keep status: PLAYING                                         │
│ Video player will seek to 2:00                               │
└──────────────────────────────────────────────────────────────┘
```

### 5. PAUSE & RESUME

```
┌─────────┐
│ CLIENT  │ User click Pause
└────┬────┘
     │ PATCH /playbacks/{id}/status
     │ { status: "PAUSED" }
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PlaybackService.updateStatus()                              │
│                                                              │
│ status: PLAYING → PAUSED                                     │
│ Keep currentPositionSec (để resume sau)                     │
└──────────────────────────────────────────────────────────────┘
     │
     ... (user does something else) ...
     │
┌─────────┐
│ CLIENT  │ User click Resume
└────┬────┘
     │ PATCH /playbacks/{id}/status
     │ { status: "PLAYING" }
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PlaybackService.updateStatus()                              │
│                                                              │
│ status: PAUSED → PLAYING                                     │
│ Continue from currentPositionSec                             │
└──────────────────────────────────────────────────────────────┘
```

### 6. AUTO-COMPLETION

```
Current position: 285 seconds
Recording duration: 300 seconds
Completion threshold: 300 * 0.95 = 285 seconds

┌─────────┐
│ CLIENT  │ Heartbeat update
└────┬────┘
     │ PATCH /playbacks/{id}/position
     │ { currentPositionSec: 285 }
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PlaybackService.updatePosition()                            │
│                                                              │
│ Check: 285 >= 285 (95% of 300) → TRUE                       │
│                                                              │
│ Auto-complete:                                               │
│   ├─ status: PLAYING → COMPLETED                            │
│   ├─ endedAt: now()                                         │
│   └─ currentPositionSec: 285                                │
└──────────────────────────────────────────────────────────────┘
```

### 7. DOWNLOAD (HTTP_MP4 with Range Support)

```
┌─────────┐
│ CLIENT  │
└────┬────┘
     │ GET /playbacks/{id}/download
     │ Headers: Range: bytes=0-1000000
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PlaybackController.download()                               │
│                                                              │
│ 1. Get playback session                                     │
│                                                              │
│ 2. Get file path from recording.storagePath                 │
│                                                              │
│ 3. Check file exists (statSync)                             │
│                                                              │
│ 4. Parse Range header                                       │
│    ├─ If Range: bytes=0-1000000                             │
│    ├─ Response: 206 Partial Content                         │
│    ├─ Content-Range: bytes 0-1000000/50000000               │
│    └─ Stream chunk [0, 1000000]                             │
│                                                              │
│    ├─ If No Range:                                          │
│    ├─ Response: 200 OK                                      │
│    ├─ Content-Length: 50000000                              │
│    └─ Stream full file                                      │
└──────────────────────────────────────────────────────────────┘

Benefits:
- Browser can seek video without full download
- Resume download nếu bị gián đoạn
- Progressive playback (play while downloading)
```

### 8. ANALYTICS

```
┌─────────┐
│ ADMIN   │
└────┬────┘
     │ GET /playbacks/analytics?cameraId={id}&from={date}&to={date}
     ▼
┌─────────────────────────────────────────────────────────────┐
│ PlaybackService.getAnalytics()                              │
│                                                              │
│ 1. Query playbacks with filters                             │
│                                                              │
│ 2. Calculate metrics:                                       │
│    ├─ totalSessions: count(*)                               │
│    ├─ completedSessions: count(status=COMPLETED)            │
│    ├─ averageWatchDuration: avg(endedAt - startedAt)        │
│    ├─ completionRate: (completed / total) * 100             │
│    └─ uniqueUsers: count(distinct userId)                   │
│                                                              │
│ 3. Return aggregated data                                   │
└──────────────────────────────────────────────────────────────┘
     │
     ▼
┌─────────────────────────────────────────────────────────────┐
│ Response 200 OK                                              │
│ {                                                            │
│   totalSessions: 150,                                        │
│   completedSessions: 120,                                    │
│   averageWatchDuration: 180,  // seconds                    │
│   completionRate: 80.0,        // percent                   │
│   uniqueUsers: 45                                            │
│ }                                                            │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔐 Security & Authorization

```
┌──────────────────────────────────────────────────────────────┐
│ Request                                                       │
│ Headers: Authorization: Bearer <JWT>                         │
└────┬──────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ JwtAuthGuard                                                  │
│   ├─ Verify JWT signature                                    │
│   ├─ Check expiration                                        │
│   └─ Decode payload → req.user = { id, username, role }      │
└────┬──────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ RolesGuard                                                    │
│   ├─ Get required roles from @Roles decorator                │
│   ├─ Check req.user.role in requiredRoles                    │
│   └─ If not → throw ForbiddenException                       │
└────┬──────────────────────────────────────────────────────────┘
     │
     ▼
┌──────────────────────────────────────────────────────────────┐
│ Controller Method                                             │
│                                                               │
│ @Roles('ADMIN', 'OPERATOR', 'VIEWER')                        │
│ create() → All roles can create playback                     │
│                                                               │
│ @Roles('ADMIN', 'OPERATOR')                                  │
│ delete() → Only ADMIN/OPERATOR can delete                    │
└───────────────────────────────────────────────────────────────┘
```

**Permission Matrix:**

| Endpoint | ADMIN | OPERATOR | VIEWER |
|----------|-------|----------|--------|
| POST /playbacks | ✅ | ✅ | ✅ |
| GET /playbacks | ✅ | ✅ | ✅ |
| GET /playbacks/:id | ✅ | ✅ | ✅ |
| PATCH /playbacks/:id/position | ✅ | ✅ | ✅ |
| PATCH /playbacks/:id/status | ✅ | ✅ | ✅ |
| GET /playbacks/:id/download | ✅ | ✅ | ✅ |
| GET /playbacks/analytics | ✅ | ✅ | ❌ |
| DELETE /playbacks/:id | ✅ | ✅ | ❌ |

---

## 💾 Database Design

### Entity Relationships

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  cameras    │       │ recordings  │       │  playbacks  │
│             │       │             │       │             │
│ - id (PK)   │◄─┐    │ - id (PK)   │◄─┐    │ - id (PK)   │
│ - name      │  │    │ - camera_id │  │    │ - recording │
│ - ipAddress │  │    │ - storage   │  │    │ - camera_id │
│ - channel   │  │    │ - duration  │  │    │ - streamUrl │
└─────────────┘  │    │ - status    │  │    │ - protocol  │
                 │    └─────────────┘  │    │ - status    │
                 │                     │    │ - position  │
                 │  N:1                │    │ - userId    │
                 └─────────────────────┼────│ - clientIp  │
                                       │    └─────────────┘
                                       │
                                    N:1
                                       │
```

### Cascade Delete Behavior

```
DELETE FROM cameras WHERE id = 'xxx'
    ↓
┌──────────────────────────────────────┐
│ ON DELETE CASCADE                    │
│                                      │
│ Auto-delete:                         │
│   ├─ recordings (camera_id = xxx)   │
│   │   └─ playbacks (recording_id)   │ ← Cascade chain
│   │                                  │
│   └─ playbacks (camera_id = xxx)    │ ← Direct cascade
└──────────────────────────────────────┘

Result:
✅ Data consistency maintained
✅ No orphan records
✅ Single DELETE statement
```

---

## 🎯 State Machine (Status Transitions)

```
              ┌─────────┐
              │ PENDING │ ← Initial state
              └────┬────┘
                   │
        ┌──────────┼──────────┐
        │ (first position      │
        │  update)             │ (error)
        ▼                      ▼
   ┌─────────┐           ┌─────────┐
   │ PLAYING │           │ FAILED  │
   └────┬────┘           └─────────┘
        │                      ▲
        │                      │
        ├──────────────────────┤
        │  (stream error)      │
        │                      │
   ┌────┴────┐                 │
   │ PAUSED  │                 │
   └────┬────┘                 │
        │                      │
        ├──────────────────────┘
        │  (resume)
        ▼
   ┌─────────┐
   │ PLAYING │
   └────┬────┘
        │
        ├───────────────┬──────────────┐
        │ (user stop)   │ (>= 95%)     │
        ▼               ▼              │
   ┌─────────┐     ┌──────────┐       │
   │ STOPPED │     │COMPLETED │       │
   └─────────┘     └──────────┘       │
        ▲               ▲              │
        └───────────────┴──────────────┘

Terminal states: STOPPED, COMPLETED, FAILED
```

---

## 📊 Performance Considerations

### 1. Database Indexes

```sql
-- Fast query by recording
CREATE INDEX IDX_playbacks_recording_id ON playbacks(recording_id);

-- Fast query by camera
CREATE INDEX IDX_playbacks_camera_id ON playbacks(camera_id);

-- Fast filter by status
CREATE INDEX IDX_playbacks_status ON playbacks(status);

-- Fast sort by time
CREATE INDEX IDX_playbacks_created_at ON playbacks(created_at);

-- Fast user history
CREATE INDEX IDX_playbacks_user_created 
ON playbacks(user_id, created_at);
```

### 2. Query Optimization

```typescript
// BAD: N+1 query problem
const playbacks = await playbackRepo.find();
for (const pb of playbacks) {
  const recording = await recordingRepo.findOne(pb.recordingId);
  const camera = await cameraRepo.findOne(pb.cameraId);
}

// GOOD: Use relations (1 query with JOINs)
const playbacks = await playbackRepo.find({
  relations: ['recording', 'camera']
});
```

### 3. Pagination

```typescript
// Always use pagination for list endpoints
const [data, total] = await playbackRepo.findAndCount({
  skip: (page - 1) * pageSize,
  take: pageSize,  // Max 100
  order: { createdAt: 'DESC' }
});
```

---

## 🧪 Testing Strategy

### Unit Tests
```typescript
describe('PlaybackService', () => {
  it('should create playback for COMPLETED recording');
  it('should throw error for PENDING recording');
  it('should throw error if file not exists');
  it('should auto-set PLAYING on first position update');
  it('should auto-complete when position >= 95%');
  it('should calculate analytics correctly');
});
```

### Integration Tests
```typescript
describe('Playback API (E2E)', () => {
  it('POST /playbacks → 201 with streamUrl');
  it('PATCH /playbacks/:id/position → auto-start');
  it('PATCH /playbacks/:id/status → pause/resume');
  it('GET /playbacks/:id/download → stream MP4');
  it('GET /playbacks/analytics → correct metrics');
});
```

---

**Author:** Camera API Team  
**Last Updated:** October 2, 2025  
**Version:** 1.0.0
