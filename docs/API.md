# API Documentation

## Authentication

No authentication required for the hosted version, but rate limits apply (250 requests/day).

## Endpoints

### POST /api/mcp/sse

Main endpoint for MCP tool execution.

**Rate Limit:** 250 requests/day

**Request:**
```json
{
  "tool": "tool_name",
  "arguments": { }
}
```

**Response:**
```json
{
  "success": true,
  "data": { },
  "timestamp": "2025-01-23T19:07:00.000Z"
}
```

**Rate Limit Headers:**
```
X-RateLimit-Limit: 250
X-RateLimit-Remaining: 245
X-RateLimit-Reset: 2025-01-24T00:00:00.000Z
```

## Tools

### DuckDB Query

Execute SQL queries on geospatial data.

```json
{
  "tool": "duckdb_query",
  "arguments": {
    "query": "SELECT * FROM satellite_data"
  }
}
```

### TerraTorch Inference

Run foundation model inference.

```json
{
  "tool": "terratorch_inference",
  "arguments": {
    "model": "prithvi",
    "data": { }
  }
}
```

### Integrated Analysis

Combined analysis pipeline.

```json
{
  "tool": "integrated_analysis",
  "arguments": {
    "dataset": "LANDSAT/LC08/C02/T1_L2",
    "region": { },
    "model": "prithvi",
    "analysisType": "classification"
  }
}
```

## Error Responses

### 429 Too Many Requests

```json
{
  "error": "Rate limit exceeded",
  "message": "You have exceeded the 250 requests per day limit",
  "resetAt": "2025-01-24T00:00:00.000Z",
  "retryAfter": 43200
}
```

### 400 Bad Request

```json
{
  "error": {
    "message": "Invalid tool: unknown_tool"
  }
}
```

### 500 Internal Server Error

```json
{
  "error": {
    "message": "Internal server error"
  }
}
```
