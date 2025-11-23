// System health monitoring
import { rateLimiter } from '@/src/middleware/rate-limiter';
import { queryCache } from '@/src/integration/cache/query-cache';
import { modelCache } from '@/src/integration/cache/model-cache';
import { metricsCollector } from './metrics';

export async function getSystemHealth() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    components: {
      rateLimit: {
        active: true,
        limit: 250,
        window: '24h'
      },
      cache: {
        queryCache: {
          size: queryCache.size(),
          ttl: '5m'
        },
        modelCache: {
          active: true
        }
      },
      metrics: {
        collected: metricsCollector.getStats() !== null
      }
    }
  };
}
