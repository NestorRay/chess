import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from "@nestjs/common";
import type { Request } from "express";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = 20;
const MAX_ENTRIES = 10_000;

/**
 * 内存滑动窗口限流，用于登录/注册等口令相关端点，按来源 IP 计数。
 * 生产部署信任一层外部反代（main.ts 中 trust proxy = 1），req.ip 取真实客户端地址；
 * 多副本/多网关部署应由负载均衡或网关层统一限流。
 */
@Injectable()
export class AuthThrottleGuard implements CanActivate {
  private readonly attempts = new Map<string, number[]>();

  constructor() {
    const timer = setInterval(() => this.prune(), WINDOW_MS);
    timer.unref?.();
  }

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip ?? "unknown";
    const now = Date.now();
    const windowed = (this.attempts.get(key) ?? []).filter((timestamp) => now - timestamp < WINDOW_MS);
    if (windowed.length >= MAX_ATTEMPTS) {
      throw new HttpException("尝试过于频繁，请稍后再试", HttpStatus.TOO_MANY_REQUESTS);
    }
    windowed.push(now);
    this.attempts.set(key, windowed);
    return true;
  }

  private prune() {
    const now = Date.now();
    for (const [key, timestamps] of this.attempts) {
      const remaining = timestamps.filter((timestamp) => now - timestamp < WINDOW_MS);
      if (remaining.length === 0) this.attempts.delete(key);
      else this.attempts.set(key, remaining);
    }
    if (this.attempts.size > MAX_ENTRIES) {
      this.attempts.clear();
    }
  }
}
