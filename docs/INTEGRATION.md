# Integration Guide

## DuckDB Integration

Query geospatial data with SQL:

```typescript
{
  "tool": "duckdb_query",
  "arguments": {
    "query": "SELECT * FROM satellite_data WHERE date > '2024-01-01'"
  }
}
```

## TerraTorch Integration

Run foundation model inference:

```typescript
{
  "tool": "terratorch_inference",
  "arguments": {
    "model": "prithvi",
    "data": { /* satellite imagery */ }
  }
}
```

## Integrated Analysis

Combine all components:

```typescript
{
  "tool": "integrated_analysis",
  "arguments": {
    "dataset": "LANDSAT/LC08/C02/T1_L2",
    "region": { /* geometry */ },
    "model": "prithvi",
    "analysisType": "classification"
  }
}
```

This will:
1. Query Earth Engine for data
2. Store in DuckDB for analysis
3. Run TerraTorch inference
4. Return integrated results
