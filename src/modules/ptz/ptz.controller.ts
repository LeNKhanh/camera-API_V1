import { Body, Controller, Get, Param, Post, UseGuards, Query } from '@nestjs/common';
import { IsEnum, IsInt, IsOptional, IsPositive } from 'class-validator';
import { PtzService, PtzAction, PtzActions } from './ptz.service';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { RolesGuard } from '../../common/roles.guard';
import { Roles } from '../../common/roles.decorator';

class PtzCommandDto {
  @IsEnum(PtzActions)
  action: PtzAction;

  @IsOptional()
  @IsInt()
  @IsPositive()
  speed?: number = 1;

  @IsOptional()
  @IsInt()
  durationMs?: number; // auto stop
}

@Controller('cameras/:id/ptz')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PtzController {
  constructor(private readonly svc: PtzService) {}

  @Post()
  @Roles('ADMIN','OPERATOR')
  move(@Param('id') id: string, @Body() dto: PtzCommandDto) {
    return this.svc.execute(id, dto.action, dto.speed, dto.durationMs);
  }

  @Get('status')
  @Roles('ADMIN','OPERATOR','VIEWER')
  status(@Param('id') id: string) {
    return this.svc.status(id);
  }

  // Lấy lịch sử log PTZ gần nhất (giới hạn đã cấu hình trong service – PTZ_LOG_MAX)
  @Get('logs')
  @Roles('ADMIN','OPERATOR','VIEWER')
  logs(@Param('id') id: string) {
    return this.svc.logs(id);
  }
}
