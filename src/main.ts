// Entry point: khởi động NestJS, bật CORS, cookie-parser, và ValidationPipe
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';

import { AppModule } from './modules/app.module';

async function bootstrap() {
  // 1) Khởi tạo ứng dụng Nest với nền tảng Express
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // 2) Bật CORS để frontend khác domain/port gọi API
  app.enableCors({ origin: true, credentials: true });

  // 3) Parse cookie (nếu dùng refresh token lưu trong cookie)
  app.use(cookieParser());

  // 4) Tự động validate DTO bằng class-validator
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port);
  // Log URL để tiện truy cập nhanh
  console.log(`Camera API listening on http://localhost:${port}`);
}

bootstrap();
