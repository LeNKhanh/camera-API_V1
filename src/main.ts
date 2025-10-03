// Entry point: khởi động NestJS, bật CORS, cookie-parser, và ValidationPipe
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // 5) Swagger (có thể tắt qua ENV DISABLE_SWAGGER=1)
  if (process.env.DISABLE_SWAGGER !== '1') {
    const config = new DocumentBuilder()
      .setTitle('Camera API (Dahua-only)')
      .setDescription('REST API quản lý camera Dahua, snapshot, recording, event, PTZ')
      .setVersion('1.0.0')
      .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
      .build();
    const doc = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('docs', app, doc, { swaggerOptions: { persistAuthorization: true } });
  }

  const preferredPort = parseInt(process.env.PORT || '3000', 10);
  const autoPort = process.env.AUTO_PORT === '1';

  async function listenWithFallback(startPort: number): Promise<number> {
    if (!autoPort) {
      // Không bật fallback: thử port duy nhất
      await app.listen(startPort);
      return startPort;
    }
    const maxAttempts = 15; // thử tối đa 15 port liên tiếp
    let port = startPort;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await app.listen(port);
        if (port !== startPort) {
          console.warn(
            `PORT ${startPort} đã bận (EADDRINUSE) → tự động chuyển sang PORT ${port}. (Bật do AUTO_PORT=1)`,
          );
        }
        return port;
      } catch (err) {
        if ((err as any)?.code === 'EADDRINUSE') {
          port += 1; // thử port kế tiếp
          continue;
        }
        throw err; // lỗi khác: ném ra luôn
      }
    }
    throw new Error(
      `Không tìm được port trống sau khi thử từ ${startPort} đến ${startPort + maxAttempts - 1}`,
    );
  }

  const actualPort = await listenWithFallback(preferredPort);
  console.log(`Camera API listening on http://localhost:${actualPort}`);
}

bootstrap();
