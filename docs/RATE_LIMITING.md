# Rate Limiting

## Overview

All API endpoints are rate-limited to prevent abuse and ensure fair usage.

## Limits

- **250 requests per day** per IP address
- Resets every 24 hours
- Applies to all `/api/mcp/*` endpoints

## Headers

Every response includes rate limit information:

```
X-RateLimit-Limit: 250
X-RateLimit-Remaining: 245
X-RateLimit-Reset: 2025-01-24T00:00:00.000Z
```

## Rate Limit Exceeded

When you exceed the limit, you'll receive a `429 Too Many Requests` response:

```json
{
  "error": "Rate limit exceeded",
  "message": "You have exceeded the 250 requests per day limit",
  "resetAt": "2025-01-24T00:00:00.000Z",
  "retryAfter": 43200
}
```

## Best Practices

1. **Cache responses** - Don't make repeated identical requests
2. **Batch operations** - Use integrated_analysis for multiple operations
3. **Monitor headers** - Check `X-RateLimit-Remaining` to avoid hitting limits
4. **Handle 429s** - Implement exponential backoff

## Self-Hosting

To remove rate limits, self-host the MCP server. See [Installation Guide](../README.md#installation).
