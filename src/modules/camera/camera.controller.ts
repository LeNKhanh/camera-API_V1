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

  @IsOptional()
  @IsString()
  rtspUrl?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  rtspPort?: number = 554;

  @IsOptional()
  @IsString()
  onvifUrl?: string;

  @IsOptional()
  @IsString()
  username?: string;

  @IsOptional()
  @IsString()
  password?: string;

  @IsOptional()
  @IsString()
  codec?: string = 'H.264';

  @IsOptional()
  @IsString()
  resolution?: string = '1080p';

  @IsOptional()
  @IsBoolean()
  enabled?: boolean = true;
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

  // Danh sách camera (filter optional: enabled=true|false, name chứa, vendor)
  @Get()
  @Roles('ADMIN', 'OPERATOR', 'VIEWER')
  findAll(
    @Query('enabled') enabled?: string,
    @Query('name') name?: string,
    @Query('vendor') vendor?: string,
    @Query('vendors') vendorsMulti?: string, // alias cho nhiều vendor cách nhau dấu phẩy
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

    // Ưu tiên vendorsMulti nếu có, fallback vendor đơn
    const vendorParam = vendorsMulti && vendorsMulti.trim().length > 0 ? vendorsMulti : vendor;

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

    const sortByKey = (['createdAt','name','vendor'].includes(sortBy || '') ? sortBy : undefined) as any;
    const sortDirKey = (sortDir === 'ASC' || sortDir === 'DESC') ? sortDir : undefined;

    return this.cameraService.findAll({
      enabled: enabledBool,
      name,
      vendor: vendorParam,
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
