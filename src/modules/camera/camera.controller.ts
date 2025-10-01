// CameraController: Quản lý CRUD cho thiết bị camera
// Luồng:
// - POST /cameras: tạo mới (ADMIN/OPERATOR)
// - GET /cameras: danh sách (tất cả vai trò đã đăng nhập)
// - GET /cameras/:id: chi tiết
// - PATCH /cameras/:id: cập nhật (ADMIN/OPERATOR)
// - DELETE /cameras/:id: xóa (ADMIN)
import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Query,
  Post as HttpPost,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsBoolean, IsInt, IsOptional, IsString, Min } from 'class-validator';
import { JwtAuthGuard } from '../guards/jwt.guard';
import { Roles } from '../../common/roles.decorator';
import { RolesGuard } from '../../common/roles.guard';

import { CameraService } from './camera.service';

// DTO tạo/cập nhật camera
class CreateCameraDto {
  @IsString()
  name: string;
  @IsString()
  ipAddress: string;
  @IsInt() @Min(1)
  port: number; // Dahua SDK port
  @IsOptional() @IsInt() @Min(1)
  channel?: number = 1;
  @IsString()
  username: string;
  @IsString()
  password: string;
  @IsOptional() @IsInt() @Min(1)
  rtspPort?: number = 554;
  @IsOptional() @IsBoolean()
  enabled?: boolean = true;
  @IsOptional() @IsString()
  rtspUrl?: string;
  @IsOptional() @IsString()
  codec?: string = 'H.264';
  @IsOptional() @IsString()
  resolution?: string = '1080p';
}

class UpdateCameraDto extends CreateCameraDto {}

@Controller('cameras')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CameraController {
  constructor(private readonly cameraService: CameraService) {}

  // Tạo camera (chỉ admin/operator)
  @Post()
  @Roles('ADMIN', 'OPERATOR')
  create(@Body() dto: CreateCameraDto) {
    return this.cameraService.create(dto);
  }

  // Bulk create channels for one device: POST /cameras/bulk-channels { ipAddress, port, username, password, channels }
  @HttpPost('bulk-channels')
  @Roles('ADMIN', 'OPERATOR')
  createMultiple(@Body() dto: any) {
    // dto.channels: number of channels
    return this.cameraService.createMulti(dto);
  }

  // Danh sách camera (filter optional: enabled=true|false, name chứa) – Dahua only
  @Get()
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  findAll(
    @Query('enabled') enabled?: string,
    @Query('name') name?: string,
    @Query('ipAddress') ipAddress?: string,
  @Query('channel') channel?: string,
    @Query('createdFrom') createdFrom?: string,
    @Query('createdTo') createdTo?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortDir') sortDir?: string,
  ) {
    let enabledBool: boolean | undefined;
    if (enabled === 'true') enabledBool = true;
    else if (enabled === 'false') enabledBool = false;

    // Parse date range (ISO hoặc yyyy-mm-dd)
    let createdFromDate: Date | undefined;
    if (createdFrom) {
      const d = new Date(createdFrom);
      if (!isNaN(d.getTime())) createdFromDate = d;
    }
    let createdToDate: Date | undefined;
    if (createdTo) {
      const d = new Date(createdTo);
      if (!isNaN(d.getTime())) createdToDate = d;
    }

    const pageNum = page ? parseInt(page, 10) : undefined;
    const pageSizeNum = pageSize ? parseInt(pageSize, 10) : undefined;

  const sortByKey = (['createdAt','name'].includes(sortBy || '') ? sortBy : undefined) as any;
    const sortDirKey = (sortDir === 'ASC' || sortDir === 'DESC') ? sortDir : undefined;

    return this.cameraService.findAll({
      enabled: enabledBool,
  name,
  ipAddress: ipAddress && ipAddress.trim().length > 0 ? ipAddress.trim() : undefined,
  channel: channel ? parseInt(channel, 10) : undefined,
  // vendor fixed 'dahua'
      createdFrom: createdFromDate,
      createdTo: createdToDate,
      page: pageNum,
      pageSize: pageSizeNum,
      sortBy: sortByKey,
      sortDir: sortDirKey,
    });
  }

  // Chi tiết camera
  @Get(':id')
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  findOne(@Param('id') id: string) {
    return this.cameraService.findOne(id);
  }

  // Sửa camera
  @Patch(':id')
  @Roles('ADMIN', 'OPERATOR')
  update(@Param('id') id: string, @Body() dto: UpdateCameraDto) {
    return this.cameraService.update(id, dto);
  }

  // Xóa camera
  @Delete(':id')
  @Roles('ADMIN')
  remove(@Param('id') id: string) {
    return this.cameraService.remove(id);
  }

  // Xác minh kết nối RTSP (ping nhanh) -> /cameras/:id/verify
  @Get(':id/verify')
  @Roles('ADMIN', 'OPERATOR')
  verify(@Param('id') id: string) {
    return this.cameraService.verify(id);
  }
}
