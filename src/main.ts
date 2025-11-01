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
  // Parse CORS origins from env (comma-separated) or use defaults
  const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map(o => o.trim())
    : [
        'http://localhost:3000',
        'http://localhost:3333',
        'http://localhost:5173',
        'https://watcher-fe-self.vercel.app',
        'https://watcher-test.vercel.app',
        'https://watcher-gateway.blocktrend.xyz',
        'https://camera-api.teknix.services',
      ];

  app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) return callback(null, true);
      
      // Check if origin matches any allowed origin or regex pattern
      const isAllowed = corsOrigins.some(allowedOrigin => {
        if (allowedOrigin === '*') return true;
        if (allowedOrigin.startsWith('/') && allowedOrigin.endsWith('/')) {
          // Regex pattern (e.g., "/https:\/\/.*\.vercel\.app$/")
          const regex = new RegExp(allowedOrigin.slice(1, -1));
          return regex.test(origin);
        }
        return allowedOrigin === origin;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        console.warn(`CORS blocked origin: ${origin}`);
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-refresh-token'],
  });

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
  const host = process.env.HOST || '0.0.0.0'; // Bind to all interfaces for deployment

  async function listenWithFallback(startPort: number): Promise<number> {
    if (!autoPort) {
      // Không bật fallback: thử port duy nhất
      await app.listen(startPort, host);
      return startPort;
    }
    const maxAttempts = 15; // thử tối đa 15 port liên tiếp
    let port = startPort;
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        await app.listen(port, host);
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
  const displayHost = host === '0.0.0.0' ? 'localhost' : host;
  console.log(`Camera API listening on http://${displayHost}:${actualPort}`);
  console.log(`Server running on ${host}:${actualPort}`);
  if (process.env.DISABLE_SWAGGER !== '1') {
    console.log(`API Documentation: http://${displayHost}:${actualPort}/docs`);
  }
}bootstrap();
