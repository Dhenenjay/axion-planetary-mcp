// DuckDB integration tests
import { describe, it, expect } from 'vitest';
import { handleDuckDBQuery } from '@/src/integration/mcp/duckdb-handler';

describe('DuckDB Integration', () => {
  it('should execute simple query', async () => {
    const result = await handleDuckDBQuery({
      query: 'SELECT 1 as test'
    });
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
  });

  it('should handle spatial queries', async () => {
    const result = await handleDuckDBQuery({
      query: "SELECT ST_Area(ST_GeomFromText('POINT(0 0)')) as area"
    });
    expect(result.success).toBe(true);
  });
});
