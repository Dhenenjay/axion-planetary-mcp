// Apply rate limiting to API routes
import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter, getRateLimitIdentifier } from './rate-limiter';
import { getRateLimitHeaders, createRateLimitError } from './rate-limit-response';

export async function withRateLimit(
  request: NextRequest,
  handler: (request: NextRequest) => Promise<NextResponse>
): Promise<NextResponse> {
  const identifier = getRateLimitIdentifier(request);
  const { allowed, remaining, resetAt } = rateLimiter.check(identifier);

  if (!allowed) {
    const headers = getRateLimitHeaders(250, 0, resetAt, true);
    return NextResponse.json(
      createRateLimitError(resetAt),
      { status: 429, headers }
    );
  }

  const response = await handler(request);
  
  // Add rate limit headers to successful response
  const headers = getRateLimitHeaders(250, remaining, resetAt);
  Object.entries(headers).forEach(([key, value]) => {
    response.headers.set(key, value);
  });

  return response;
}
