// StreamService: Sinh URL phát lại (HLS/DASH) theo cameraId (minh họa)
// Ghi chú: cần triển khai server streaming (SRS/nginx-rtmp/segmenter) tương thích để URL hoạt động
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { Camera } from '../../typeorm/entities/camera.entity';

// Service giả lập tạo URL phát lại cho camera (thực tế cần nginx-rtmp, srs, hay ffmpeg segmenter)
@Injectable()
export class StreamService {
  constructor(@InjectRepository(Camera) private readonly camRepo: Repository<Camera>) {}

  // Trả về URL phát minh hoạ; cần hạ tầng streaming thực tế để dùng được
  async getPlaybackUrl(cameraId: string, protocol: 'HLS' | 'DASH' = 'HLS') {
    if (!cameraId) throw new NotFoundException('cameraId required');
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');
    const base = process.env.STREAM_BASE_URL || 'http://localhost:8080/live';
    const ext = protocol === 'HLS' ? 'm3u8' : 'mpd';
    const url = `${base}/${cameraId}/index.${ext}`;
    return { protocol, url, note: 'Cần triển khai streaming server để hoạt động thực tế' };
  }

  // Trả về RTSP URL trực tiếp từ camera để test với VLC/FFmpeg
  async getRtspUrl(cameraId: string) {
    if (!cameraId) throw new NotFoundException('cameraId required');
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');

    // Build RTSP URL from camera config
    let rtspUrl: string;
    
    if (cam.rtspUrl && cam.rtspUrl.trim().length > 0) {
      // Use custom RTSP URL from database
      rtspUrl = cam.rtspUrl;
    } else {
      // Build RTSP URL from camera credentials (Dahua format)
      const username = cam.username || 'admin';
      const password = cam.password || 'admin';
      const ip = cam.ipAddress;
      const port = cam.rtspPort || 554;
      const channel = cam.channel || 1;
      
      // Dahua RTSP URL format: rtsp://username:password@ip:port/cam/realmonitor?channel=X&subtype=0
      rtspUrl = `rtsp://${username}:${password}@${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=0`;
    }

    return {
      cameraId: cam.id,
      cameraName: cam.name,
      rtspUrl,
      instructions: {
        vlc: [
          '1. Open VLC Media Player',
          '2. Go to: Media → Open Network Stream (Ctrl+N)',
          '3. Paste RTSP URL below',
          '4. Click Play',
        ],
        ffplay: [
          '1. Open terminal/command prompt',
          `2. Run: ffplay -rtsp_transport tcp "${rtspUrl}"`,
        ],
      },
      note: 'Copy RTSP URL để paste vào VLC hoặc FFplay',
    };
  }
}
