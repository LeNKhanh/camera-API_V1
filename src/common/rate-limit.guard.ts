import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';

interface Counter { count: number; windowStart: number; }

@Injectable()
export class SimpleRateLimitGuard implements CanActivate {
  private readonly store = new Map<string, Counter>();
  constructor(private readonly windowMs: number, private readonly max: number) {}
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const ip = (req.ip || req.socket?.remoteAddress || 'unknown').replace(/^::ffff:/,'');
    const route = req.route?.path || req.originalUrl || 'unknown';
    const key = `${ip}:${route}`;
    const now = Date.now();
    const rec = this.store.get(key);
    if (!rec || now - rec.windowStart > this.windowMs) {
      this.store.set(key, { count: 1, windowStart: now });
      return true;
    }
    rec.count += 1;
    if (rec.count > this.max) throw new HttpException(`Rate limit exceeded (${this.max}/${this.windowMs}ms)`, HttpStatus.TOO_MANY_REQUESTS);
    return true;
  }
}

// Export instances cho decorator @UseGuards
export const RateLimitLoginGuard = new SimpleRateLimitGuard(60_000, 10);    // 10 lần / phút / IP
export const RateLimitRefreshGuard = new SimpleRateLimitGuard(60_000, 30);  // 30 lần / phút / IP
