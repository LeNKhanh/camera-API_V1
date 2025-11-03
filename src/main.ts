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
        '/^http:\\/\\/localhost:\\d+$/',  // Allow all localhost ports (development)
        '/^http:\\/\\/127\\.0\\.0\\.1:\\d+$/',  // Allow all 127.0.0.1 ports
        'https://watcher-fe-self.vercel.app',
        'https://watcher-test.vercel.app',
        'https://watcher-gateway.blocktrend.xyz',
        'https://camera-api.teknix.services',
        '/https:\\/\\/.*\\.vercel\\.app$/',  // Allow all Vercel deployments
      ];

  // Log CORS configuration on startup
  console.log('[CORS] Configured origins:', corsOrigins);
  console.log('[CORS] Environment CORS_ORIGINS:', process.env.CORS_ORIGINS ? 'SET' : 'NOT SET (using defaults)');

  // Only enable CORS if not handled by proxy/gateway
  // Check if DISABLE_NEST_CORS is set (when gateway already handles CORS)
  if (process.env.DISABLE_NEST_CORS !== '1') {
    console.log('[CORS] NestJS CORS enabled');
    app.enableCors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, Postman, curl)
      if (!origin) {
        console.log('[CORS] ✓ Request with no origin (allowed)');
        return callback(null, true);
      }
      
      console.log('[CORS] Checking origin:', origin);
      
      // Check if origin matches any allowed origin or regex pattern
      const isAllowed = corsOrigins.some((allowedOrigin, index) => {
        if (allowedOrigin === '*') {
          console.log(`[CORS]   [${index}] Wildcard match: *`);
          return true;
        }
        
        if (allowedOrigin.startsWith('/') && allowedOrigin.endsWith('/')) {
          // Regex pattern (e.g., "/https:\/\/.*\.vercel\.app$/")
          try {
            const regexStr = allowedOrigin.slice(1, -1);
            const regex = new RegExp(regexStr);
            const matches = regex.test(origin);
            console.log(`[CORS]   [${index}] Regex: ${regexStr} → ${matches ? '✓ MATCH' : '✗ no match'}`);
            return matches;
          } catch (err) {
            console.error(`[CORS]   [${index}] Invalid regex: ${allowedOrigin}`, err.message);
            return false;
          }
        }
        
        const matches = allowedOrigin === origin;
        console.log(`[CORS]   [${index}] Exact: "${allowedOrigin}" → ${matches ? '✓ MATCH' : '✗ no match'}`);
        return matches;
      });

      if (isAllowed) {
        console.log('[CORS] ✓ Origin ALLOWED');
        callback(null, true);
      } else {
        console.warn('[CORS] ✗ Origin BLOCKED');
        console.warn('[CORS] Blocked origin:', origin);
        console.warn('[CORS] Allowed origins:', corsOrigins);
        // Return false instead of throwing error to prevent breaking error responses
        callback(null, false);
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'x-api-key', 'x-refresh-token'],
  });
  } else {
    console.log('[CORS] NestJS CORS disabled (handled by proxy/gateway)');
  }

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
