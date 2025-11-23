# Middleware

## Rate Limiting

All API endpoints are rate-limited to **250 requests per day** per IP address.

### Headers

- `X-RateLimit-Limit`: Maximum requests allowed (250)
- `X-RateLimit-Remaining`: Requests remaining
- `X-RateLimit-Reset`: When the limit resets (ISO 8601)
- `Retry-After`: Seconds until limit resets (429 responses only)

### Response Codes

- `200 OK`: Request successful
- `429 Too Many Requests`: Rate limit exceeded

### Example

```typescript
import { withRateLimit } from '@/src/middleware/apply-rate-limit';

export async function POST(req: NextRequest) {
  return withRateLimit(req, async (req) => {
    // Your handler logic
    return NextResponse.json({ success: true });
  });
}
```
