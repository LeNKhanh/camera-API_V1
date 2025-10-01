import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';
import { PtzService } from './ptz.service';

@Controller('ptz/logs')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PtzAdvancedController {
  constructor(private readonly svc: PtzService) {}

  // GET /ptz/logs/advanced?ILoginID=...&nChannelID=1&page=1&pageSize=20
  @Get('advanced')
  @Roles('ADMIN','OPERATOR','VIEWER')
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