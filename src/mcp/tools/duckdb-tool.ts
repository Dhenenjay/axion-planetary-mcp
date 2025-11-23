// DuckDB MCP tool definition
export const duckdbQueryTool = {
  name: 'duckdb_query',
  description: 'Execute SQL queries on geospatial data using DuckDB with spatial extensions',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'SQL query to execute'
      },
      options: {
        type: 'object',
        description: 'Query options',
        properties: {
          timeout: { type: 'number', description: 'Query timeout in ms' },
          maxRows: { type: 'number', description: 'Maximum rows to return' }
        }
      }
    },
    required: ['query']
  }
};
