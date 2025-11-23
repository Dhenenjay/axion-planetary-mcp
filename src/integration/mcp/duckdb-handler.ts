// DuckDB handler for MCP
import { DuckDBClient } from '@/src/duckdb';

export async function handleDuckDBQuery(args: any) {
  const { query, options = {} } = args;
  
  if (!query) {
    throw new Error('Query is required');
  }

  const client = new DuckDBClient();
  await client.loadExtensions();
  
  const result = await client.query(query);
  
  return {
    success: true,
    data: result,
    rowCount: result.rows.length,
    timestamp: new Date().toISOString()
  };
}
