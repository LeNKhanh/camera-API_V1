import { Controller, Get, Param, Query, UseGuards, Logger } from '@nestjs/common';

import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { StreamService } from './stream.service';

// Controller cung cấp endpoint để lấy URL phát HLS/DASH hoặc proxy snapshot
@Controller('streams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StreamController {
  private readonly logger = new Logger(StreamController.name);
  
  constructor(private readonly svc: StreamService) {}

  // Lấy URL phát cho một camera (ví dụ HLS)
  @Get(':cameraId/url')
  @Roles('ADMIN')
  getUrl(
    @Param('cameraId') cameraId: string,
    @Query('protocol') protocol: 'HLS' | 'DASH' = 'HLS',
  ) {
    return this.svc.getPlaybackUrl(cameraId, protocol);
  }

  // Lấy RTSP URL trực tiếp từ camera để test với VLC
  @Get(':cameraId/rtsp')
  @Roles('ADMIN')
  getRtspUrl(@Param('cameraId') cameraId: string) {
    return this.svc.getRtspUrl(cameraId);
  }

  // NEW: Lấy RTSP URL qua MediaMTX Proxy (ẩn IP camera)
  @Get(':cameraId/proxy')
  @Roles('ADMIN')
  async getProxyUrl(@Param('cameraId') cameraId: string) {
    this.logger.log(`[Frontend Request] GET /streams/${cameraId}/proxy`);
    const result = await this.svc.getProxyUrl(cameraId);
    
    // Log detailed info for debugging
    this.logger.log(`[Camera Found] ${result.cameraName} (${result.cameraId})`);
    this.logger.log(`[HLS URL] ${result.protocols.hls}`);
    this.logger.log(`[RTSP URL] ${result.protocols.rtsp}`);
    this.logger.log(`[WebRTC URL] ${result.protocols.webrtc}`);
    
    return result;
  }

  // NEW: Debug endpoint - Get stream diagnostics
  @Get(':cameraId/debug')
  @Roles('ADMIN')
  async getDebugInfo(@Param('cameraId') cameraId: string) {
    this.logger.warn(`[Debug Request] Diagnostic info requested for camera ${cameraId}`);
    return this.svc.getStreamDebugInfo(cameraId);
  }

  // NEW: Health check endpoint for stream
  @Get(':cameraId/health')
  @Roles('ADMIN')
  async checkStreamHealth(@Param('cameraId') cameraId: string) {
    this.logger.log(`[Health Check] Testing stream for camera ${cameraId}`);
    return this.svc.checkStreamHealth(cameraId);
  }
}
