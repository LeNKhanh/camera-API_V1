# PLAYBACK REDESIGN - Event-Triggered Recording

## 📋 Yêu cầu

**Logic mới:**
1. **Khi nhận Event** → Tự động bắt đầu record video từ camera
2. **Lưu vào Playback table** ngay lập tức với:
   - `event_id` (FK to events)
   - `started_at` (thời điểm nhận event)
   - `status = 'RECORDING'`
   - `camera_id`, `stream_url`
3. **Khi Event kết thúc** → Dừng record, upload lên R2, cập nhật:
   - `ended_at`
   - `status = 'COMPLETED'`
   - `storage_path` (R2 URL)
   - `duration_sec`
4. **Record real-time** (không phải playback file đã ghi)

---

## 🗃️ Database Changes

### 1. Migration: Update Playback Table

**Thêm columns mới:**
```sql
ALTER TABLE playbacks ADD COLUMN event_id UUID REFERENCES events(id) ON DELETE SET NULL;
ALTER TABLE playbacks ADD COLUMN recording_status VARCHAR(20) DEFAULT 'PENDING';
ALTER TABLE playbacks ADD COLUMN video_url VARCHAR(500); -- R2 public URL
ALTER TABLE playbacks ADD COLUMN file_size_bytes BIGINT;
ALTER TABLE playbacks ADD COLUMN duration_sec INTEGER;

-- Index cho query nhanh
CREATE INDEX idx_playbacks_event ON playbacks(event_id);
CREATE INDEX idx_playbacks_status ON playbacks(recording_status);
```

**Giải thích:**
- `event_id`: Link với event trigger (nullable vì có thể manual record)
- `recording_status`: 'PENDING' | 'RECORDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED'
- `video_url`: URL public trên R2 (giống snapshot)
- `file_size_bytes`: Metadata cho analytics
- `duration_sec`: Thời lượng video thực tế

### 2. Update Entity

**playback.entity.ts:**
```typescript
@Entity({ name: 'playbacks' })
export class Playback {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // NEW: Link với Event trigger
  @ManyToOne(() => Event, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'event_id' })
  event?: Event | null;

  @ManyToOne(() => Camera, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'camera_id' })
  camera: Camera;

  // NEW: Recording status (vòng đời của video)
  @Column({ name: 'recording_status', type: 'varchar', length: 20, default: 'PENDING' })
  recordingStatus: 'PENDING' | 'RECORDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

  // NEW: R2 public URL
  @Column({ name: 'video_url', type: 'varchar', length: 500, nullable: true })
  videoUrl?: string | null;

  // NEW: Local temp path (trước khi upload R2)
  @Column({ name: 'local_path', type: 'varchar', length: 500, nullable: true })
  localPath?: string | null;

  // NEW: Metadata
  @Column({ name: 'file_size_bytes', type: 'bigint', nullable: true })
  fileSizeBytes?: number | null;

  @Column({ name: 'duration_sec', type: 'int', nullable: true })
  durationSec?: number | null;

  @Column({ name: 'codec', type: 'varchar', length: 20, nullable: true })
  codec?: string | null;

  @Column({ name: 'resolution', type: 'varchar', length: 20, nullable: true })
  resolution?: string | null;

  // Timestamps
  @Column({ name: 'started_at', type: 'timestamptz', nullable: true })
  startedAt?: Date | null;

  @Column({ name: 'ended_at', type: 'timestamptz', nullable: true })
  endedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt: Date;

  // Error tracking
  @Column({ name: 'error_message', type: 'varchar', length: 500, nullable: true })
  errorMessage?: string | null;
}
```

---

## 🔧 Service Logic

### 1. EventService - Auto-trigger recording

**event.service.ts:**
```typescript
@Injectable()
export class EventService {
  constructor(
    @InjectRepository(Event) private eventRepo: Repository<Event>,
    @InjectRepository(Camera) private camRepo: Repository<Camera>,
    private playbackService: PlaybackService, // INJECT
  ) {}

  // Tạo event VÀ tự động bắt đầu record
  async create(dto: { cameraId: string; type: any; description?: string }) {
    const cam = await this.camRepo.findOne({ where: { id: dto.cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');

    // 1. Tạo event
    const event = this.eventRepo.create({
      camera: cam,
      nChannelID: cam.channel || 1,
      type: dto.type,
      description: dto.description,
    } as any);
    const savedEvent = await this.eventRepo.save(event);

    // 2. AUTO-START RECORDING (nếu event type = MOTION)
    if (dto.type === 'MOTION') {
      try {
        await this.playbackService.startRecordingForEvent(savedEvent.id, cam.id);
      } catch (err) {
        console.error(`Failed to start recording for event ${savedEvent.id}:`, err);
      }
    }

    return savedEvent;
  }

  // Kết thúc event = stop recording
  async endEvent(eventId: string) {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    // Stop recording liên quan
    await this.playbackService.stopRecordingForEvent(eventId);

    // Có thể update event status/endedAt nếu cần
    return { ok: true, eventId };
  }
}
```

### 2. PlaybackService - Recording Manager

**playback.service.ts (NEW LOGIC):**
```typescript
@Injectable()
export class PlaybackService {
  private activeRecordings = new Map<string, any>(); // eventId -> ffmpeg process

  constructor(
    @InjectRepository(Playback) private playbackRepo: Repository<Playback>,
    @InjectRepository(Event) private eventRepo: Repository<Event>,
    @InjectRepository(Camera) private cameraRepo: Repository<Camera>,
    private storageService: StorageService, // Upload R2
  ) {}

  // ===================================================================
  // START RECORDING WHEN EVENT CREATED
  // ===================================================================
  async startRecordingForEvent(eventId: string, cameraId: string): Promise<Playback> {
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');

    const camera = await this.cameraRepo.findOne({ where: { id: cameraId } });
    if (!camera) throw new NotFoundException('Camera not found');

    // 1. Tạo playback record với status RECORDING
    const playback = this.playbackRepo.create({
      event,
      camera,
      recordingStatus: 'RECORDING',
      startedAt: new Date(),
      codec: camera.codec || 'H.264',
      resolution: camera.resolution || '1080p',
    });
    const saved = await this.playbackRepo.save(playback);

    // 2. Bắt đầu record real-time bằng ffmpeg
    const localPath = await this.startFFmpegRecording(saved.id, camera);
    await this.playbackRepo.update(saved.id, { localPath } as any);

    return saved;
  }

  // ===================================================================
  // STOP RECORDING WHEN EVENT ENDS
  // ===================================================================
  async stopRecordingForEvent(eventId: string): Promise<Playback> {
    // 1. Tìm playback đang record
    const playback = await this.playbackRepo.findOne({
      where: { 
        event: { id: eventId },
        recordingStatus: 'RECORDING'
      },
      relations: ['event', 'camera'],
    });

    if (!playback) {
      throw new NotFoundException(`No active recording for event ${eventId}`);
    }

    // 2. Stop ffmpeg process
    const ffmpegProcess = this.activeRecordings.get(eventId);
    if (ffmpegProcess) {
      ffmpegProcess.kill('SIGINT'); // Graceful stop
      this.activeRecordings.delete(eventId);
    }

    // 3. Update status = PROCESSING (đợi upload R2)
    await this.playbackRepo.update(playback.id, {
      recordingStatus: 'PROCESSING',
      endedAt: new Date(),
    } as any);

    // 4. Upload to R2 (async)
    this.uploadToR2(playback.id, playback.localPath!)
      .catch(err => {
        console.error(`Failed to upload playback ${playback.id}:`, err);
        this.playbackRepo.update(playback.id, {
          recordingStatus: 'FAILED',
          errorMessage: err.message,
        } as any);
      });

    return this.playbackRepo.findOne({ where: { id: playback.id } });
  }

  // ===================================================================
  // FFMPEG RECORDING (Real-time)
  // ===================================================================
  private async startFFmpegRecording(
    playbackId: string,
    camera: Camera,
  ): Promise<string> {
    const ffmpeg = require('ffmpeg-static');
    const { spawn } = require('child_process');
    const path = require('path');
    const fs = require('fs');

    // Local temp path
    const tempDir = process.env.RECORD_DIR || '/tmp';
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }
    const filename = `playback_${playbackId}_${Date.now()}.mp4`;
    const localPath = path.join(tempDir, filename);

    // RTSP URL
    const rtspUrl = camera.rtspUrl;

    // FFmpeg command for real-time recording
    const args = [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-c:v', 'copy',        // Copy video codec (no transcode)
      '-c:a', 'aac',         // Audio codec
      '-f', 'mp4',           // Output format
      '-movflags', '+faststart', // Web-optimized
      '-y',                  // Overwrite
      localPath,
    ];

    const proc = spawn(ffmpeg, args);

    // Store process để stop sau
    this.activeRecordings.set(playbackId, proc);

    // Log output
    proc.stderr.on('data', (data: Buffer) => {
      console.log(`[FFmpeg ${playbackId}]:`, data.toString());
    });

    proc.on('close', (code: number) => {
      console.log(`[FFmpeg ${playbackId}] Process exited with code ${code}`);
      this.activeRecordings.delete(playbackId);
    });

    return localPath;
  }

  // ===================================================================
  // UPLOAD TO R2
  // ===================================================================
  private async uploadToR2(playbackId: string, localPath: string): Promise<void> {
    const fs = require('fs');
    const path = require('path');

    // 1. Read file
    if (!fs.existsSync(localPath)) {
      throw new Error(`Local file not found: ${localPath}`);
    }

    const fileBuffer = fs.readFileSync(localPath);
    const fileSizeBytes = fileBuffer.length;
    const filename = path.basename(localPath);

    // 2. Upload to R2
    const r2Key = `playbacks/${playbackId}/${filename}`;
    const uploadResult = await this.storageService.upload(
      fileBuffer,
      r2Key,
      'video/mp4',
    );

    // 3. Get public URL
    const videoUrl = uploadResult.url || `${process.env.R2_PUBLIC_URL}/${r2Key}`;

    // 4. Get video duration using ffprobe
    const durationSec = await this.getVideoDuration(localPath);

    // 5. Update playback record
    await this.playbackRepo.update(playbackId, {
      recordingStatus: 'COMPLETED',
      videoUrl,
      fileSizeBytes,
      durationSec,
    } as any);

    // 6. Delete local temp file
    fs.unlinkSync(localPath);

    console.log(`✅ Playback ${playbackId} uploaded to R2: ${videoUrl}`);
  }

  // ===================================================================
  // GET VIDEO DURATION (ffprobe)
  // ===================================================================
  private async getVideoDuration(filePath: string): Promise<number> {
    const { execSync } = require('child_process');
    
    try {
      const output = execSync(
        `ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 "${filePath}"`,
        { encoding: 'utf-8' }
      );
      return Math.round(parseFloat(output.trim()));
    } catch (err) {
      console.error('Failed to get duration:', err);
      return 0;
    }
  }

  // ===================================================================
  // LIST PLAYBACKS (Updated)
  // ===================================================================
  async list(filter: {
    eventId?: string;
    cameraId?: string;
    recordingStatus?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const page = filter.page || 1;
    const pageSize = Math.min(filter.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (filter.eventId) where.event = { id: filter.eventId };
    if (filter.cameraId) where.camera = { id: filter.cameraId };
    if (filter.recordingStatus) where.recordingStatus = filter.recordingStatus;

    const [data, total] = await this.playbackRepo.findAndCount({
      where,
      relations: ['event', 'camera'],
      order: { createdAt: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ===================================================================
  // GET PLAYBACK BY ID
  // ===================================================================
  async get(id: string) {
    const playback = await this.playbackRepo.findOne({
      where: { id },
      relations: ['event', 'camera'],
    });
    if (!playback) throw new NotFoundException('Playback not found');
    return playback;
  }

  // ===================================================================
  // DELETE PLAYBACK (+ R2 file)
  // ===================================================================
  async delete(id: string) {
    const playback = await this.get(id);

    // Delete from R2 nếu có
    if (playback.videoUrl) {
      try {
        const key = this.extractR2KeyFromUrl(playback.videoUrl);
        await this.storageService.delete(key);
      } catch (err) {
        console.error('Failed to delete from R2:', err);
      }
    }

    await this.playbackRepo.remove(playback);
    return { ok: true, message: 'Playback deleted' };
  }

  private extractR2KeyFromUrl(url: string): string {
    // Extract key from: https://iotek.tn-cdn.net/playbacks/xxx/file.mp4
    const publicUrl = process.env.R2_PUBLIC_URL || '';
    return url.replace(publicUrl + '/', '');
  }
}
```

---

## 🔌 Controller Updates

**playback.controller.ts:**
```typescript
@Controller('playbacks')
export class PlaybackController {
  constructor(private readonly service: PlaybackService) {}

  // List playbacks
  @Get()
  list(@Query() filter: any) {
    return this.service.list(filter);
  }

  // Get playback detail
  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  // Delete playback
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  // Manual stop recording (nếu cần)
  @Post(':id/stop')
  async stopRecording(@Param('id') id: string) {
    const playback = await this.service.get(id);
    if (!playback.event) {
      throw new BadRequestException('No event associated');
    }
    return this.service.stopRecordingForEvent(playback.event.id);
  }
}
```

**event.controller.ts:**
```typescript
@Controller('events')
export class EventController {
  constructor(private readonly service: EventService) {}

  // Create event (auto-start recording)
  @Post()
  create(@Body() dto: any) {
    return this.service.create(dto);
  }

  // End event (stop recording)
  @Post(':id/end')
  endEvent(@Param('id') id: string) {
    return this.service.endEvent(id);
  }

  // ... other endpoints
}
```

---

## 🧪 Testing Flow

### 1. Create Event (Auto-start recording)
```bash
POST /events
{
  "cameraId": "xxx",
  "type": "MOTION",
  "description": "Motion detected"
}

# Response:
{
  "id": "event-123",
  "cameraId": "xxx",
  "type": "MOTION",
  "createdAt": "2025-10-27T10:00:00Z"
}
```

### 2. Check Playback (Recording in progress)
```bash
GET /playbacks?eventId=event-123

# Response:
{
  "data": [{
    "id": "playback-456",
    "eventId": "event-123",
    "cameraId": "xxx",
    "recordingStatus": "RECORDING",
    "startedAt": "2025-10-27T10:00:01Z",
    "localPath": "/tmp/playback_456_xxx.mp4"
  }]
}
```

### 3. End Event (Stop recording + upload R2)
```bash
POST /events/event-123/end

# Background:
# - FFmpeg process stopped
# - Video uploaded to R2
# - Playback status → COMPLETED
```

### 4. Get Final Playback
```bash
GET /playbacks/playback-456

# Response:
{
  "id": "playback-456",
  "eventId": "event-123",
  "cameraId": "xxx",
  "recordingStatus": "COMPLETED",
  "videoUrl": "https://iotek.tn-cdn.net/playbacks/playback-456/video.mp4",
  "startedAt": "2025-10-27T10:00:01Z",
  "endedAt": "2025-10-27T10:05:30Z",
  "durationSec": 329,
  "fileSizeBytes": 45678912
}
```

---

## 📝 Migration Script

**Create file:** `src/migrations/1730000000000-add-event-triggered-recording.ts`

```typescript
import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddEventTriggeredRecording1730000000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Add new columns to playbacks
    await queryRunner.query(`
      ALTER TABLE playbacks 
      ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS recording_status VARCHAR(20) DEFAULT 'PENDING',
      ADD COLUMN IF NOT EXISTS video_url VARCHAR(500),
      ADD COLUMN IF NOT EXISTS local_path VARCHAR(500),
      ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT,
      ADD COLUMN IF NOT EXISTS duration_sec INTEGER,
      ADD COLUMN IF NOT EXISTS codec VARCHAR(20),
      ADD COLUMN IF NOT EXISTS resolution VARCHAR(20)
    `);

    // Create indexes
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_playbacks_event ON playbacks(event_id);
      CREATE INDEX IF NOT EXISTS idx_playbacks_recording_status ON playbacks(recording_status);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE playbacks
      DROP COLUMN IF EXISTS event_id,
      DROP COLUMN IF EXISTS recording_status,
      DROP COLUMN IF EXISTS video_url,
      DROP COLUMN IF EXISTS local_path,
      DROP COLUMN IF EXISTS file_size_bytes,
      DROP COLUMN IF EXISTS duration_sec,
      DROP COLUMN IF EXISTS codec,
      DROP COLUMN IF EXISTS resolution
    `);

    await queryRunner.query(`
      DROP INDEX IF EXISTS idx_playbacks_event;
      DROP INDEX IF EXISTS idx_playbacks_recording_status;
    `);
  }
}
```

---

## ✅ Summary

**Changes:**
1. ✅ Playback entity thêm: `event_id`, `recording_status`, `video_url`, metadata
2. ✅ EventService auto-trigger recording khi tạo event MOTION
3. ✅ PlaybackService quản lý FFmpeg process real-time
4. ✅ Upload R2 sau khi stop recording (giống snapshot/recording)
5. ✅ Migration script để update database schema

**Benefits:**
- ✅ Tự động record khi có event (không cần manual)
- ✅ Video lưu trên R2 (public URL, dễ access)
- ✅ Real-time recording (không cần wait download)
- ✅ Track metadata (duration, size, codec, resolution)
- ✅ Graceful stop (FFmpeg SIGINT)

Bạn có muốn tôi implement code này không?
