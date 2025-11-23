// Unified integration tests
import { describe, it, expect } from 'vitest';
import { handleIntegratedTool } from '@/src/integration/mcp/unified-handler';

describe('Unified Integration', () => {
  it('should handle duckdb_query tool', async () => {
    const result = await handleIntegratedTool('duckdb_query', {
      query: 'SELECT 1'
    });
    expect(result.success).toBe(true);
  });

  it('should handle terratorch_inference tool', async () => {
    const result = await handleIntegratedTool('terratorch_inference', {
      model: 'prithvi',
      data: {}
    });
    expect(result.success).toBe(true);
  });

  it('should handle integrated_analysis tool', async () => {
    const result = await handleIntegratedTool('integrated_analysis', {
      dataset: 'test',
      region: {},
      model: 'prithvi'
    });
    expect(result.success).toBe(true);
  });
});
