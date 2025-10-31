import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { PtzService } from './ptz.service';

// Expose advanced logs at GET /cameras/ptz/logs/advanced
@Controller('cameras/ptz/logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PtzLogsAdvancedController {
  constructor(private readonly svc: PtzService) {}

  /**
   * GET /cameras/ptz/logs/advanced?ILoginID=<uuid>&nChannelID=2&page=1&pageSize=20
   * ILoginID: required camera identity (camera.id as current mapping)
   */
  @Get('advanced')
  @Roles('ADMIN')
  advanced(
    @Query('ILoginID') ILoginID?: string,
    @Query('nChannelID') nChannelID?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    return this.svc.advancedLogs({
      ILoginID,
      nChannelID: nChannelID ? parseInt(nChannelID, 10) : undefined,
      page: page ? parseInt(page, 10) : undefined,
      pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
    });
  }
}