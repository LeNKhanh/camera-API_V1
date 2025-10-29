// ============================================================================
// PLAYBACK SERVICE - EVENT-TRIGGERED RECORDING
// ============================================================================
// Mục đích: Quản lý event-driven recording - Tự động record khi có event
// 
// Nghiệp vụ chính:
// 1. START_RECORDING: Bắt đầu record khi event được tạo
// 2. STOP_RECORDING: Dừng record khi event kết thúc + upload R2
// 3. LIST: Danh sách playbacks với filter
// 4. GET: Chi tiết playback
// 5. DELETE: Xóa playback + video trên R2
// 
// Luồng recording:
// 1. Event created → Auto-call startRecordingForEvent()
// 2. Tạo Playback record với status RECORDING
// 3. Spawn FFmpeg process để record RTSP real-time
// 4. Store process vào Map để stop sau
// 5. Event ended → stopRecordingForEvent()
// 6. Kill FFmpeg process (graceful SIGINT)
// 7. Upload video lên R2
// 8. Update Playback với video_url, status COMPLETED
// 9. Delete local temp file
// ============================================================================

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThanOrEqual, LessThanOrEqual } from 'typeorm';
import { spawn, ChildProcess } from 'child_process';
import { existsSync, unlinkSync, mkdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';
import ffmpegPath from 'ffmpeg-static';
import { execSync } from 'child_process';

import { Playback, RecordingStatus } from '../../typeorm/entities/playback.entity';
import { Event } from '../../typeorm/entities/event.entity';
import { Camera } from '../../typeorm/entities/camera.entity';

// Import Storage Service (giống snapshot, recording)
import { StorageService } from '../storage/storage.service';

// ============================================================================
// DTOs
// ============================================================================

export interface ListPlaybackDto {
  eventId?: string;
  cameraId?: string;
  recordingStatus?: RecordingStatus;
  startedFrom?: string; // ISO 8601: filter started_at >= startedFrom
  startedTo?: string;   // ISO 8601: filter started_at <= startedTo
  page?: number;
  pageSize?: number;
}

// ============================================================================
// PLAYBACK SERVICE
// ============================================================================
@Injectable()
export class PlaybackService {
  // Map lưu FFmpeg processes đang chạy (playbackId -> ChildProcess)
  private activeRecordings = new Map<string, ChildProcess>();

  constructor(
    @InjectRepository(Playback)
    private readonly playbackRepo: Repository<Playback>,
    
    @InjectRepository(Event)
    private readonly eventRepo: Repository<Event>,
    
    @InjectRepository(Camera)
    private readonly cameraRepo: Repository<Camera>,

    private readonly storageService: StorageService,
  ) {}

  // ==========================================================================
  // START RECORDING FOR EVENT
  // ==========================================================================
  // Called by EventService when event is created
  // Auto-start FFmpeg recording to local temp file
  // ==========================================================================
  async startRecordingForEvent(eventId: string, cameraId: string): Promise<Playback> {
    console.log(`[Playback] Starting recording for event ${eventId}...`);

    // 1. Validate event và camera
    const event = await this.eventRepo.findOne({ where: { id: eventId } });
    if (!event) {
      throw new NotFoundException(`Event ${eventId} not found`);
    }

    const camera = await this.cameraRepo.findOne({ where: { id: cameraId } });
    if (!camera) {
      throw new NotFoundException(`Camera ${cameraId} not found`);
    }

    // 2. Tạo playback record
    const playback = this.playbackRepo.create({
      event,
      camera,
      recordingStatus: 'RECORDING',
      startedAt: new Date(),
      codec: camera.codec || 'H.264',
      resolution: camera.resolution || '1080p',
    });
    const saved = await this.playbackRepo.save(playback);

    // 3. Bắt đầu FFmpeg recording (async, không block)
    this.startFFmpegRecording(saved.id, camera)
      .then(localPath => {
        // Update local_path sau khi FFmpeg start xong
        return this.playbackRepo.update(saved.id, { localPath } as any);
      })
      .catch(err => {
        console.error(`[Playback] Failed to start FFmpeg for ${saved.id}:`, err);
        // Update status FAILED
        this.playbackRepo.update(saved.id, {
          recordingStatus: 'FAILED',
          errorMessage: err.message,
        } as any);
      });

    return saved;
  }

  // ==========================================================================
  // STOP RECORDING FOR EVENT
  // ==========================================================================
  // Called by EventService when event ends
  // Stop FFmpeg + Upload to R2
  // ==========================================================================
  async stopRecordingForEvent(eventId: string): Promise<Playback> {
    console.log(`[Playback] Stopping recording for event ${eventId}...`);

    // 1. Tìm playback đang RECORDING
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

    // 2. Stop FFmpeg process (graceful SIGINT)
    const ffmpegProcess = this.activeRecordings.get(playback.id);
    if (ffmpegProcess) {
      console.log(`[Playback] Sending SIGINT to FFmpeg process for ${playback.id}...`);
      ffmpegProcess.kill('SIGINT');
      this.activeRecordings.delete(playback.id);
    } else {
      console.warn(`[Playback] No FFmpeg process found for ${playback.id}`);
    }

    // 3. Wait một chút để FFmpeg close file
    await new Promise(resolve => setTimeout(resolve, 2000));

    // 4. Update status PROCESSING
    await this.playbackRepo.update(playback.id, {
      recordingStatus: 'PROCESSING',
      endedAt: new Date(),
    } as any);

    // 5. Upload to R2 (async)
    this.uploadToR2(playback.id, playback.localPath!)
      .catch(err => {
        console.error(`[Playback] Failed to upload ${playback.id} to R2:`, err);
        this.playbackRepo.update(playback.id, {
          recordingStatus: 'FAILED',
          errorMessage: `Upload failed: ${err.message}`,
        } as any);
      });

    return this.playbackRepo.findOne({ 
      where: { id: playback.id },
      relations: ['event', 'camera'],
    });
  }

  // ==========================================================================
  // FFMPEG RECORDING (INTERNAL)
  // ==========================================================================
  // Start FFmpeg to record RTSP stream to local file
  // Returns: local file path
  // ==========================================================================
  private async startFFmpegRecording(playbackId: string, camera: Camera): Promise<string> {
    // 1. Prepare temp directory - Cross-platform compatible
    const defaultTempDir = process.platform === 'win32' 
      ? join(process.env.TEMP || process.env.TMP || 'C:\\Windows\\Temp', 'playbacks')
      : '/tmp/playbacks';
    
    const tempDir = process.env.RECORD_DIR || defaultTempDir;
    
    console.log(`[FFmpeg] Using temp directory: ${tempDir} (platform: ${process.platform})`);
    
    if (!existsSync(tempDir)) {
      console.log(`[FFmpeg] Creating temp directory: ${tempDir}`);
      mkdirSync(tempDir, { recursive: true });
    }

    // 2. Generate filename
    const timestamp = Date.now();
    const filename = `playback_${playbackId}_${timestamp}.mp4`;
    const localPath = join(tempDir, filename);

    // 3. RTSP URL
    const rtspUrl = camera.rtspUrl;
    if (!rtspUrl) {
      throw new Error(`Camera ${camera.id} has no rtspUrl`);
    }

    console.log(`[FFmpeg] Starting recording: ${rtspUrl} → ${localPath}`);

    // 4. FFmpeg command
    const args = [
      '-rtsp_transport', 'tcp',
      '-i', rtspUrl,
      '-c:v', 'copy',           // Copy video (no transcode)
      '-c:a', 'aac',            // Audio codec
      '-f', 'mp4',              // MP4 format
      '-movflags', '+faststart', // Web-optimized
      '-y',                     // Overwrite
      localPath,
    ];

    // 5. Spawn FFmpeg - Use ffmpeg-static binary path
    // ffmpegPath is the absolute path to the ffmpeg binary from ffmpeg-static package
    if (!ffmpegPath) {
      throw new Error('FFmpeg binary not found. Ensure ffmpeg-static is installed.');
    }
    
    console.log(`[FFmpeg] Using FFmpeg binary: ${ffmpegPath}`);
    const ffmpeg = spawn(ffmpegPath, args);

    // 6. Store process
    this.activeRecordings.set(playbackId, ffmpeg);

    // 7. Log FFmpeg output
    ffmpeg.stderr.on('data', (data: Buffer) => {
      const log = data.toString().trim();
      if (log.includes('frame=') || log.includes('speed=')) {
        // Progress log (optional: parse và update progress)
        console.log(`[FFmpeg ${playbackId}] ${log}`);
      }
    });

    ffmpeg.on('error', (err: Error) => {
      console.error(`[FFmpeg ${playbackId}] Process error:`, err);
      this.activeRecordings.delete(playbackId);
    });

    ffmpeg.on('close', (code: number) => {
      console.log(`[FFmpeg ${playbackId}] Process exited with code ${code}`);
      this.activeRecordings.delete(playbackId);
    });

    // 8. Return local path immediately (FFmpeg runs in background)
    return localPath;
  }

  // ==========================================================================
  // UPLOAD TO R2 (INTERNAL)
  // ==========================================================================
  // Upload recorded video to R2, update playback record
  // ==========================================================================
  private async uploadToR2(playbackId: string, localPath: string): Promise<void> {
    console.log(`[Playback] Uploading ${playbackId} to R2...`);

    // 1. Validate file exists
    if (!existsSync(localPath)) {
      throw new Error(`Local file not found: ${localPath}`);
    }

    // 2. Get file info
    const stats = statSync(localPath);
    const fileSizeBytes = stats.size;
    const filename = localPath.split(/[/\\]/).pop(); // Cross-platform

    // 3. Get video duration
    const durationSec = await this.getVideoDuration(localPath);

    // 4. Upload to R2 (StorageService.uploadFile tự đọc file)
    const r2Key = `playbacks/${playbackId}/${filename}`;
    console.log(`[Playback] R2 key: ${r2Key}`);

    const videoUrl = await this.storageService.uploadFile(localPath, r2Key);

    // 6. Update playback record
    await this.playbackRepo.update(playbackId, {
      recordingStatus: 'COMPLETED',
      videoUrl,
      fileSizeBytes,
      durationSec,
    } as any);

    // 7. Delete local file
    try {
      unlinkSync(localPath);
      console.log(`[Playback] Deleted local file: ${localPath}`);
    } catch (err) {
      console.warn(`[Playback] Failed to delete local file:`, err);
    }

    console.log(`[Playback] ✅ ${playbackId} uploaded successfully: ${videoUrl}`);
  }

  // ==========================================================================
  // GET VIDEO DURATION (using FFmpeg instead of ffprobe)
  // ==========================================================================
  private async getVideoDuration(filePath: string): Promise<number> {
    try {
      if (!ffmpegPath) {
        console.warn('[Playback] FFmpeg not available, cannot get duration');
        return 0;
      }
      
      // Use FFmpeg to get file info (it outputs to stderr)
      // We run ffmpeg -i and capture stderr which contains Duration info
      const { execSync } = require('child_process');
      let output = '';
      try {
        execSync(`"${ffmpegPath}" -i "${filePath}"`, { encoding: 'utf-8' });
      } catch (err: any) {
        // FFmpeg outputs info to stderr, which causes execSync to throw
        // but err.stderr contains the info we need
        output = err.stderr || err.stdout || '';
      }
      
      // Parse: Duration: 00:01:23.45, start: 0.000000, bitrate: 1234 kb/s
      const match = output.match(/Duration: (\d{2}):(\d{2}):(\d{2}\.\d{2})/);
      if (match) {
        const hours = parseInt(match[1]);
        const minutes = parseInt(match[2]);
        const seconds = parseFloat(match[3]);
        const totalSeconds = hours * 3600 + minutes * 60 + seconds;
        return Math.round(totalSeconds);
      }
      
      console.warn('[Playback] Could not parse duration from FFmpeg output');
      return 0;
    } catch (err) {
      console.error('[Playback] Failed to get video duration:', err);
      return 0;
    }
  }

  // ==========================================================================
  // LIST PLAYBACKS
  // ==========================================================================
  async list(filter: ListPlaybackDto = {}): Promise<{
    data: Playback[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = filter.page || 1;
    const pageSize = Math.min(filter.pageSize || 20, 100);
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (filter.eventId) where.event = { id: filter.eventId };
    if (filter.cameraId) where.camera = { id: filter.cameraId };
    if (filter.recordingStatus) where.recordingStatus = filter.recordingStatus;

    // Date range filter for started_at
    if (filter.startedFrom && filter.startedTo) {
      where.startedAt = Between(new Date(filter.startedFrom), new Date(filter.startedTo));
    } else if (filter.startedFrom) {
      where.startedAt = MoreThanOrEqual(new Date(filter.startedFrom));
    } else if (filter.startedTo) {
      where.startedAt = LessThanOrEqual(new Date(filter.startedTo));
    }

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

  // ==========================================================================
  // GET PLAYBACK BY ID
  // ==========================================================================
  async get(id: string): Promise<Playback> {
    const playback = await this.playbackRepo.findOne({
      where: { id },
      relations: ['event', 'camera'],
    });
    if (!playback) {
      throw new NotFoundException(`Playback ${id} not found`);
    }
    return playback;
  }

  // ==========================================================================
  // DELETE PLAYBACK
  // ==========================================================================
  async delete(id: string): Promise<{ ok: boolean; message: string }> {
    const playback = await this.get(id);

    // Delete from R2 if exists
    if (playback.videoUrl && this.storageService.isR2Url(playback.videoUrl)) {
      try {
        const key = this.storageService.extractR2Key(playback.videoUrl);
        if (key) {
          await this.storageService.deleteFile(key);
          console.log(`[Playback] Deleted from R2: ${key}`);
        }
      } catch (err) {
        console.error('[Playback] Failed to delete from R2:', err);
      }
    }

    // Delete from database
    await this.playbackRepo.remove(playback);

    return {
      ok: true,
      message: `Playback ${id} deleted successfully`,
    };
  }

  // ==========================================================================
  // MANUAL STOP RECORDING (if needed)
  // ==========================================================================
  async manualStopRecording(playbackId: string): Promise<Playback> {
    const playback = await this.get(playbackId);
    
    if (playback.recordingStatus !== 'RECORDING') {
      throw new BadRequestException(`Playback ${playbackId} is not recording (status: ${playback.recordingStatus})`);
    }

    // Stop FFmpeg
    const ffmpegProcess = this.activeRecordings.get(playbackId);
    if (ffmpegProcess) {
      ffmpegProcess.kill('SIGINT');
      this.activeRecordings.delete(playbackId);
    }

    // Update status
    await this.playbackRepo.update(playbackId, {
      recordingStatus: 'PROCESSING',
      endedAt: new Date(),
    } as any);

    // Upload to R2
    if (playback.localPath && existsSync(playback.localPath)) {
      this.uploadToR2(playbackId, playback.localPath).catch(err => {
        console.error(`[Playback] Upload failed:`, err);
        this.playbackRepo.update(playbackId, {
          recordingStatus: 'FAILED',
          errorMessage: `Upload failed: ${err.message}`,
        } as any);
      });
    }

    return this.get(playbackId);
  }
}
