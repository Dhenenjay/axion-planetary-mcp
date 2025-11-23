// Rate limit response utilities
export interface RateLimitHeaders {
  'X-RateLimit-Limit': string;
  'X-RateLimit-Remaining': string;
  'X-RateLimit-Reset': string;
  'Retry-After'?: string;
}

export function getRateLimitHeaders(
  limit: number,
  remaining: number,
  resetAt: number,
  isExceeded: boolean = false
): RateLimitHeaders {
  const headers: RateLimitHeaders = {
    'X-RateLimit-Limit': limit.toString(),
    'X-RateLimit-Remaining': remaining.toString(),
    'X-RateLimit-Reset': new Date(resetAt).toISOString(),
  };

  if (isExceeded) {
    const retryAfterSeconds = Math.ceil((resetAt - Date.now()) / 1000);
    headers['Retry-After'] = retryAfterSeconds.toString();
  }

  return headers;
}

export function createRateLimitError(resetAt: number) {
  return {
    error: 'Rate limit exceeded',
    message: 'You have exceeded the 250 requests per day limit',
    resetAt: new Date(resetAt).toISOString(),
    retryAfter: Math.ceil((resetAt - Date.now()) / 1000)
  };
}
