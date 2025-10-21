import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';

import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { StreamService } from './stream.service';

// Controller cung cấp endpoint để lấy URL phát HLS/DASH hoặc proxy snapshot
@Controller('streams')
@UseGuards(JwtAuthGuard, RolesGuard)
export class StreamController {
  constructor(private readonly svc: StreamService) {}

  // Lấy URL phát cho một camera (ví dụ HLS)
  @Get(':cameraId/url')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  getUrl(
    @Param('cameraId') cameraId: string,
    @Query('protocol') protocol: 'HLS' | 'DASH' = 'HLS',
  ) {
    return this.svc.getPlaybackUrl(cameraId, protocol);
  }

  // Lấy RTSP URL trực tiếp từ camera để test với VLC
  @Get(':cameraId/rtsp')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  getRtspUrl(@Param('cameraId') cameraId: string) {
    return this.svc.getRtspUrl(cameraId);
  }

  // ✨ NEW: Lấy RTSP URL qua MediaMTX Proxy (ẩn IP camera)
  @Get(':cameraId/proxy')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  getProxyUrl(@Param('cameraId') cameraId: string) {
    return this.svc.getProxyUrl(cameraId);
  }
}
