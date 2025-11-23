// Rate limiting middleware for API routes
import { NextRequest } from 'next/server';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

class RateLimiter {
  private storage = new Map<string, RateLimitEntry>();
  private readonly limit: number;
  private readonly windowMs: number;

  constructor(limit: number = 250, windowMs: number = 24 * 60 * 60 * 1000) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  check(identifier: string): { allowed: boolean; remaining: number; resetAt: number } {
    const now = Date.now();
    const entry = this.storage.get(identifier);

    if (!entry || now > entry.resetAt) {
      const resetAt = now + this.windowMs;
      this.storage.set(identifier, { count: 1, resetAt });
      return { allowed: true, remaining: this.limit - 1, resetAt };
    }

    if (entry.count >= this.limit) {
      return { allowed: false, remaining: 0, resetAt: entry.resetAt };
    }

    entry.count++;
    return { allowed: true, remaining: this.limit - entry.count, resetAt: entry.resetAt };
  }

  reset(identifier: string): void {
    this.storage.delete(identifier);
  }
}

export const rateLimiter = new RateLimiter(250, 24 * 60 * 60 * 1000);

export function getRateLimitIdentifier(request: NextRequest): string {
  // Try to get IP from various headers
  const forwarded = request.headers.get('x-forwarded-for');
  const realIp = request.headers.get('x-real-ip');
  const cfIp = request.headers.get('cf-connecting-ip');
  
  return forwarded?.split(',')[0] || realIp || cfIp || 'unknown';
}
