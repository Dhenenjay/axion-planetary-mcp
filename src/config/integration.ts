// Integration configuration
export const INTEGRATION_CONFIG = {
  duckdb: {
    enabled: true,
    memoryLimit: '4GB',
    threads: 4,
    extensions: ['spatial', 'parquet', 'json']
  },
  terratorch: {
    enabled: true,
    defaultModel: 'prithvi',
    device: 'cuda',
    models: {
      prithvi: {
        path: './models/prithvi-100m',
        inputShape: [3, 224, 224]
      },
      satmae: {
        path: './models/satmae',
        inputShape: [3, 224, 224]
      }
    }
  },
  cache: {
    enabled: true,
    queryTTL: 5 * 60 * 1000, // 5 minutes
    modelCache: true
  },
  monitoring: {
    enabled: true,
    metricsRetention: 1000
  },
  rateLimit: {
    enabled: true,
    limit: 250,
    window: 24 * 60 * 60 * 1000 // 24 hours
  }
};
