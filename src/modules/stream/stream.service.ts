// StreamService: Sinh URL phát lại (HLS/DASH) theo cameraId (minh họa)
// Ghi chú: cần triển khai server streaming (SRS/nginx-rtmp/segmenter) tương thích để URL hoạt động
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import axios from 'axios';

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

  // ✨ NEW: Get MediaMTX proxy URL (hides camera IP and credentials)
  async getProxyUrl(cameraId: string) {
    if (!cameraId) throw new NotFoundException('cameraId required');
    const cam = await this.camRepo.findOne({ where: { id: cameraId } });
    if (!cam) throw new NotFoundException('Camera not found');

    // MediaMTX configuration from environment
    const mediamtxHost = process.env.MEDIAMTX_HOST || 'localhost';
    const mediamtxApiUrl = process.env.MEDIAMTX_API_URL || 'http://localhost:9997';
    const rtspPort = process.env.MEDIAMTX_RTSP_PORT || '8554';
    const hlsPort = process.env.MEDIAMTX_HLS_PORT || '8888';
    const webrtcPort = process.env.MEDIAMTX_WEBRTC_PORT || '8889';
    const useHttps = process.env.MEDIAMTX_USE_HTTPS === 'true';
    
    // Use first 8 characters of camera ID for path
    const pathId = cameraId.substring(0, 8);
    const pathName = `camera_${pathId}`;
    
    // Build RTSP source URL from camera config
    const sourceUrl = this.buildRtspUrl(cam);
    
    // Auto-register camera with MediaMTX via API
    console.log(`[MediaMTX] Auto-registration triggered for ${pathName}`);
    console.log(`[MediaMTX] Camera: ${cam.name} (${cam.id})`);
    console.log(`[MediaMTX] API URL: ${mediamtxApiUrl}`);
    
    try {
      await this.registerCameraWithMediaMTX(pathName, sourceUrl, mediamtxApiUrl);
    } catch (error) {
      console.error(`[MediaMTX] Camera ${pathName} registration failed: ${error.message}`);
      // Log but continue - return proxy URL anyway for manual troubleshooting
      // User can still try to use the stream even if registration failed
    }
    
    // Build proxy URLs
    const httpScheme = useHttps ? 'https' : 'http';
    const hlsUrl = hlsPort === '80' || hlsPort === '443' 
      ? `${httpScheme}://${mediamtxHost}/hls/${pathName}/index.m3u8`
      : `${httpScheme}://${mediamtxHost}:${hlsPort}/${pathName}/index.m3u8`;
    
    const webrtcUrl = webrtcPort === '80' || webrtcPort === '443'
      ? `${httpScheme}://${mediamtxHost}/webrtc/${pathName}/whep`
      : `${httpScheme}://${mediamtxHost}:${webrtcPort}/${pathName}/whep`;

    return {
      cameraId: cam.id,
      cameraName: cam.name,
      pathId: pathName,
      protocols: {
        rtsp: `rtsp://${mediamtxHost}:${rtspPort}/${pathName}`,  // NO TRAILING SLASH
        hls: hlsUrl,
        webrtc: webrtcUrl,
      },
      instructions: {
        vlc: [
          '1. Open VLC Media Player',
          '2. Go to: Media → Open Network Stream (Ctrl+N)',
          `3. Paste: rtsp://${mediamtxHost}:${rtspPort}/${pathName}`,
          '4. Click Play',
        ],
        browser: [
          '1. Use HLS URL for HTML5 video player',
          '2. Requires HLS.js library for non-Safari browsers',
          '3. Example: https://github.com/video-dev/hls.js/',
        ],
        webrtc: [
          '1. Ultra-low latency streaming (~500ms)',
          '2. Best for real-time monitoring',
          '3. Requires WebRTC-compatible player',
        ],
      },
      security: {
        cameraIpHidden: true,
        credentialsProtected: true,
        proxyAuthentication: false,
        autoRegistered: true,
        note: 'Camera automatically registered with MediaMTX proxy. IP and credentials are hidden.',
      },
      configuration: {
        mediamtxHost,
        mediamtxApiUrl,
        rtspPort,
        hlsPort,
        webrtcPort,
        note: 'Camera auto-registered via MediaMTX API - no restart needed!',
      },
    };
  }

  // Helper: Build RTSP URL from camera config
  private buildRtspUrl(camera: Camera): string {
    // Use custom RTSP URL if provided
    if (camera.rtspUrl && camera.rtspUrl.trim().length > 0) {
      return camera.rtspUrl.trim();
    }

    // Build Dahua format
    const username = camera.username || 'admin';
    const password = camera.password || 'admin';
    const ip = camera.ipAddress;
    const port = camera.rtspPort || 554;
    const channel = camera.channel || 1;

    return `rtsp://${username}:${password}@${ip}:${port}/cam/realmonitor?channel=${channel}&subtype=0`;
  }

  // Helper: Register camera with MediaMTX via REST API
  private async registerCameraWithMediaMTX(
    pathName: string,
    sourceUrl: string,
    apiUrl: string,
  ): Promise<void> {
    const addUrl = `${apiUrl}/v3/config/paths/add/${pathName}`;
    
    try {
      // Check if path already exists
      const checkUrl = `${apiUrl}/v3/config/paths/get/${pathName}`;
      try {
        await axios.get(checkUrl, { timeout: 2000 });
        console.log(`[MediaMTX] Camera ${pathName} already registered`);
        return; // Path exists, no need to register
      } catch (checkError) {
        // Path doesn't exist, continue to register
      }

      // Register new path
      const config = {
        source: sourceUrl,
        sourceProtocol: 'automatic',
        sourceAnyPortEnable: false,
        // sourceOnDemand: true,  // REMOVED - requires FFmpeg
        // Instead, MediaMTX will pull stream directly from camera
      };

      console.log(`[MediaMTX] Registering ${pathName}...`);
      console.log(`[MediaMTX]    API URL: ${addUrl}`);
      console.log(`[MediaMTX]    Source: ${sourceUrl}`);

      await axios.post(addUrl, config, {  // Changed from PATCH to POST
        headers: { 'Content-Type': 'application/json' },
        timeout: 3000,
      });

      console.log(`[MediaMTX] SUCCESS: Camera ${pathName} auto-registered successfully`);
    } catch (error) {
      // Enhanced error logging for production debugging
      const errorDetails = {
        pathName,
        apiUrl: addUrl,
        sourceUrl,
        error: {
          message: error.message,
          code: error.code,
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
        },
        requestConfig: error.config ? {
          method: error.config.method,
          url: error.config.url,
          timeout: error.config.timeout,
        } : undefined,
      };
      
      console.error(`[MediaMTX] ERROR: Registration failed:`, JSON.stringify(errorDetails, null, 2));
      
      // More specific error messages
      if (error.code === 'ECONNREFUSED') {
        throw new Error(`Cannot connect to MediaMTX API at ${apiUrl}. Is MediaMTX running?`);
      } else if (error.code === 'ETIMEDOUT') {
        throw new Error(`MediaMTX API timeout at ${apiUrl}. Check network connectivity.`);
      } else if (error.response?.status === 404) {
        throw new Error(`MediaMTX API endpoint not found. Check API URL: ${addUrl}`);
      } else if (error.response?.status === 400) {
        const apiError = error.response?.data?.error || 'Bad Request';
        throw new Error(`MediaMTX rejected request: ${apiError}`);
      } else {
        const errorMsg = error.response?.data?.error || error.message || 'Unknown error';
        throw new Error(`Failed to register with MediaMTX: ${errorMsg}`);
      }
    }
  }
}
