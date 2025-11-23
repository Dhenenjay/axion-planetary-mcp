// TerraTorch integration tests
import { describe, it, expect } from 'vitest';
import { handleTerraTorchInference } from '@/src/integration/mcp/terratorch-handler';

describe('TerraTorch Integration', () => {
  it('should load Prithvi model', async () => {
    const result = await handleTerraTorchInference({
      model: 'prithvi',
      data: { test: 'data' }
    });
    expect(result.success).toBe(true);
    expect(result.model).toBe('prithvi');
  });

  it('should load SatMAE model', async () => {
    const result = await handleTerraTorchInference({
      model: 'satmae',
      data: { test: 'data' }
    });
    expect(result.success).toBe(true);
    expect(result.model).toBe('satmae');
  });
});
