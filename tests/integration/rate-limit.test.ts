// Rate limit tests
import { describe, it, expect } from 'vitest';
import { rateLimiter } from '@/src/middleware/rate-limiter';

describe('Rate Limiter', () => {
  it('should allow requests under limit', () => {
    const result = rateLimiter.check('test-ip');
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(249);
  });

  it('should block requests over limit', () => {
    for (let i = 0; i < 251; i++) {
      rateLimiter.check('test-ip-2');
    }
    const result = rateLimiter.check('test-ip-2');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('should reset after window', () => {
    rateLimiter.reset('test-ip-3');
    const result = rateLimiter.check('test-ip-3');
    expect(result.allowed).toBe(true);
  });
});
