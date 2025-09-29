import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, ParseIntPipe, Post, Put, UseGuards } from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { NetSdkService } from './netsdk.service';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';

class LoginDto {
  @IsString() ip: string;
  @IsInt() @Min(1) port: number;
  @IsString() username: string;
  @IsString() password: string;
}

class PtzDto {
  @IsInt() handle: number;
  @IsInt() channel: number;
  @IsString() cmd: string; // ví dụ: DH_PTZ_UP_CONTROL, DH_PTZ_LEFT_CONTROL, DH_EXTPTZ_FASTGOTO
  @IsOptional() @IsInt() p1?: number;
  @IsOptional() @IsInt() p2?: number;
  @IsOptional() @IsInt() p3?: number;
  @IsOptional() @IsBoolean() stop?: boolean;
}

class SnapshotDto {
  @IsInt() handle: number;
  @IsInt() channel: number;
  @IsString() filePath: string;
}

@Controller('netsdk')
@UseGuards(JwtAuthGuard, RolesGuard)
export class NetSdkController {
  constructor(private readonly svc: NetSdkService) {}

  // POST /netsdk/sessions  -> login (tạo session)
  @Post('sessions')
  @Roles('ADMIN', 'OPERATOR')
  createSession(@Body() dto: LoginDto) {
    return this.svc.login(dto.ip, dto.port, dto.username, dto.password);
  }

  // GET /netsdk/sessions    -> danh sách session
  @Get('sessions')
  @Roles('ADMIN', 'OPERATOR')
  listSessions(): any {
    return { ok: true, sessions: this.svc.listSessions() };
  }

  // GET /netsdk/sessions/:handle -> chi tiết session
  @Get('sessions/:handle')
  @Roles('ADMIN', 'OPERATOR')
  getSession(@Param('handle', ParseIntPipe) handle: number): any {
    const s = this.svc.getSession(handle);
    if (!s) return { ok: false, error: 'NOT_FOUND' };
    return { ok: true, session: s };
  }

  // DELETE /netsdk/sessions/:handle -> logout
  @Delete('sessions/:handle')
  @HttpCode(HttpStatus.OK)
  @Roles('ADMIN', 'OPERATOR')
  deleteSession(@Param('handle', ParseIntPipe) handle: number) {
    return this.svc.logout(handle);
  }

  // PUT /netsdk/sessions/:handle/ptz -> PTZ control (idempotent-ish)
  @Put('sessions/:handle/ptz')
  @Roles('ADMIN', 'OPERATOR')
  ptz(@Param('handle', ParseIntPipe) handle: number, @Body() body: Omit<PtzDto, 'handle'>) {
    return this.svc.ptzControl(handle, body.channel, body.cmd, body.p1 ?? 0, body.p2 ?? 0, body.p3 ?? 0, body.stop ?? false);
  }

  // POST /netsdk/sessions/:handle/snapshots -> snapshot (hiện trả lỗi vì không có SDK thật)
  @Post('sessions/:handle/snapshots')
  @Roles('ADMIN', 'OPERATOR')
  snapshot(@Param('handle', ParseIntPipe) handle: number, @Body() body: Omit<SnapshotDto, 'handle'>) {
    return this.svc.snapshotDevice(handle, body.channel, body.filePath);
  }
}
