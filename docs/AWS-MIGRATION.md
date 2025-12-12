# Axion AWS Migration Guide

This document describes the AWS-native implementation of Axion MCP, replacing Google Earth Engine with AWS services.

## Architecture Overview

### Data Source
- **Element84 Earth Search STAC API** - Free, public STAC catalog with Sentinel-2, Landsat, and other satellite data
- Endpoint: `https://earth-search.aws.element84.com/v1`

### Storage
- **Amazon S3** - Three buckets for exports, tiles, and boundaries
- **Amazon DynamoDB** - Four tables for sessions, tasks, boundaries index, and cache

### Processing
- **TiTiler** - Dynamic tile server for COG visualization (external service or self-hosted)
- **AWS Lambda** (planned) - Serverless processing for indices and composites
- **AWS ECS Fargate** (planned) - Container-based ML classification

## Tools

### 1. axion_data
Data access tool using STAC API.

**Operations:**
- `search` - Search for satellite imagery
- `filter` - Filter collection with criteria
- `info` - Get collection information
- `collections` - List available collections
- `boundaries` - Get boundary data info

**Example:**
```json
{
  "operation": "search",
  "collectionId": "sentinel-2-l2a",
  "bbox": "-122.5,37.5,-122.0,38.0",
  "startDate": "2024-06-01",
  "endDate": "2024-06-30",
  "cloudCoverMax": 20,
  "limit": 10
}
```

### 2. axion_system
System health and configuration tool.

**Operations:**
- `health` - Check all AWS services connectivity
- `info` - System information
- `config` - View configuration
- `boundary` - Load boundary by place name
- `help` - Show help

**Example:**
```json
{
  "operation": "health"
}
```

### 3. axion_process
Image processing tool.

**Operations:**
- `composite` - Create temporal composite
- `ndvi` - Compute NDVI
- `indices` - Compute spectral indices (NDVI, EVI, NDWI, SAVI, NDBI, BSI)
- `stats` - Compute statistics for region
- `mosaic` - Create image mosaic

**Example:**
```json
{
  "operation": "ndvi",
  "collectionId": "sentinel-2-l2a",
  "bbox": "-122.5,37.5,-122.0,38.0",
  "startDate": "2024-06-01",
  "endDate": "2024-06-30"
}
```

### 4. axion_export
Export and visualization tool.

**Operations:**
- `thumbnail` - Generate preview image
- `tiles` - Get tile URL template
- `export` - Export to S3
- `status` - Check export status

**Example:**
```json
{
  "operation": "thumbnail",
  "collectionId": "sentinel-2-l2a",
  "bbox": "-122.5,37.5,-122.0,38.0",
  "width": 512,
  "height": 512
}
```

### 5. axion_map
Map session management tool.

**Operations:**
- `create` - Create new map session
- `addLayer` - Add imagery layer
- `getLayers` - Get all layers
- `getUrl` - Get map configuration and tile URLs
- `delete` - Delete session

**Example:**
```json
{
  "operation": "create",
  "sessionName": "My Analysis Map"
}
```

### 6. axion_classification
Land cover classification tool.

**Operations:**
- `threshold` - Threshold-based classification
- `landcover` - Multi-index land cover
- `indices` - List available indices and presets
- `status` - Check task status

**Example:**
```json
{
  "operation": "threshold",
  "indexType": "ndvi",
  "bbox": "-122.5,37.5,-122.0,38.0",
  "startDate": "2024-06-01",
  "endDate": "2024-06-30"
}
```

## Collection Mapping

GEE dataset IDs are automatically mapped to STAC collection IDs:

| GEE Dataset | STAC Collection |
|-------------|-----------------|
| COPERNICUS/S2_SR_HARMONIZED | sentinel-2-l2a |
| COPERNICUS/S2_SR | sentinel-2-l2a |
| LANDSAT/LC08/C02/T1_L2 | landsat-c2-l2 |
| LANDSAT/LC09/C02/T1_L2 | landsat-c2-l2 |
| COPERNICUS/S1_GRD | sentinel-1-grd |
| COPERNICUS/DEM/GLO30 | cop-dem-glo-30 |

## Environment Variables

```bash
# AWS Configuration
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=your-key
AWS_SECRET_ACCESS_KEY=your-secret

# STAC Endpoint
AXION_STAC_ENDPOINT=https://earth-search.aws.element84.com/v1

# S3 Buckets
AXION_S3_EXPORTS_BUCKET=axion-exports-xxx
AXION_S3_TILES_BUCKET=axion-tiles-xxx
AXION_S3_BOUNDARIES_BUCKET=axion-boundaries-xxx

# DynamoDB Tables
AXION_DYNAMODB_SESSIONS_TABLE=axion-sessions
AXION_DYNAMODB_TASKS_TABLE=axion-tasks
AXION_DYNAMODB_BOUNDARIES_TABLE=axion-boundaries
AXION_DYNAMODB_CACHE_TABLE=axion-cache

# Optional: TiTiler endpoint
TITILER_ENDPOINT=https://titiler.xyz
```

## Running the Server

```bash
# Development
npm run dev:aws

# Production
npm run start:aws

# Build
npm run build:aws
```

## Key Differences from GEE Version

| Feature | GEE Version | AWS Version |
|---------|-------------|-------------|
| Data Source | Google Earth Engine | Element84 STAC API |
| Auth | Service Account | AWS IAM |
| Processing | GEE Compute | TiTiler + Lambda |
| Storage | GCS | S3 |
| Tile Serving | ee.getMapId() | TiTiler COG tiles |
| Session State | In-memory | DynamoDB |

## Limitations

1. **Processing** - Complex processing (composites, mosaics) returns specifications rather than computed results. Use TiTiler or a processing service to execute.

2. **Boundaries** - Currently limited to known places. Full boundary data requires staging GeoJSON in S3.

3. **Classification** - ML classification requires deploying a processing service (Lambda or ECS).

## Future Enhancements

- [ ] Deploy TiTiler on AWS Lambda
- [ ] Add boundary data pipeline (Natural Earth, GADM)
- [ ] ML classification service on ECS Fargate
- [ ] CDK infrastructure stacks
- [ ] CloudFront distribution for tiles
