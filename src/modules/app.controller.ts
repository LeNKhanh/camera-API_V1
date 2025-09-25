// AppController: cung cấp endpoint /health cho health check
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  // Healthcheck đơn giản
  @Get('health')
  health() {
    return { ok: true, time: new Date().toISOString() };
  }
}
