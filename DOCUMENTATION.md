# Earth Engine MCP Server - Professional Documentation

## Overview
The Earth Engine MCP Server is a production-ready Model Context Protocol server that provides seamless integration with Google Earth Engine for satellite imagery analysis and geospatial operations.

## Features
- **High-Resolution Thumbnails**: Generate 1024x1024 satellite imagery thumbnails clipped to exact shapefile boundaries
- **Geometry Caching**: Smart caching system for frequently used place boundaries
- **Shapefile Support**: Convert any place name to exact administrative boundaries
- **Spectral Analysis**: Calculate NDVI, EVI, NDWI, and other vegetation indices
- **Cloud-Free Mosaics**: Create cloud-free composites from satellite imagery
- **Smart Parameter Mapping**: Automatic parameter normalization for all tools

## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/earth-engine-mcp.git
cd earth-engine-mcp

# Install dependencies
npm install

# Start the server
npm run dev
```

## Configuration

### Claude Desktop Integration
Add to your Claude Desktop configuration file:

```json
{
  "mcpServers": {
    "earth-engine": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\earth-engine-mcp\\build\\index.js"],
      "env": {
        "GEE_SERVICE_ACCOUNT": "your-service-account@project.iam.gserviceaccount.com",
        "GEE_PRIVATE_KEY": "path/to/private-key.json"
      }
    }
  }
}
```

## Available Tools

### 1. Search Earth Engine Catalog
Search for satellite datasets in the Earth Engine catalog.

```javascript
{
  "tool": "search_gee_catalog",
  "arguments": {
    "query": "Sentinel-2"  // Search term
  }
}
```

### 2. Get High-Resolution Thumbnail
Generate high-resolution satellite imagery thumbnails with exact shapefile boundaries.

```javascript
{
  "tool": "get_thumbnail_image",
  "arguments": {
    "datasetId": "COPERNICUS/S2_SR",
    "start": "2024-01-01",
    "end": "2024-01-31",
    "aoi": "Los Angeles",  // Can be place name or GeoJSON
    "visParams": {         // Optional
      "min": 0,
      "max": 3000,
      "gamma": 1.4,
      "bands": ["B4", "B3", "B2"]
    },
    "size": {              // Optional, defaults to 1024x1024
      "width": 1024,
      "height": 1024
    }
  }
}
```

**Features:**
- Automatically clips to exact shapefile boundaries
- Maintains aspect ratio of the region
- Falls back gracefully for large regions
- Returns PNG format for best quality

### 3. Convert Place to Shapefile Geometry
Convert any place name to exact administrative boundaries from official datasets.

```javascript
{
  "tool": "convert_place_to_shapefile_geometry",
  "arguments": {
    "place_name": "San Francisco",  // City, county, state, or country
    "simplify": false,               // Optional: simplify geometry
    "maxError": 100                  // Optional: max error in meters
  }
}
```

**Supported Place Types:**
- US Counties (Census TIGER 2016)
- US States
- Global Districts (FAO GAUL 2015)
- Global States/Provinces
- Countries

**Cached Places:**
The server caches frequently used geometries for performance. Common aliases are automatically resolved:
- "LA" → "Los Angeles"
- "SF" → "San Francisco"
- "NYC" → "New York"

### 4. Calculate Spectral Indices
Calculate vegetation and water indices from satellite imagery.

```javascript
{
  "tool": "calculate_spectral_index",
  "arguments": {
    "imageId": "COPERNICUS/S2_SR/20240115T183919_20240115T184337_T11SLT",
    "index": "NDVI"  // NDVI, EVI, or NDWI
  }
}
```

**Supported Indices:**
- **NDVI**: Normalized Difference Vegetation Index
- **EVI**: Enhanced Vegetation Index
- **NDWI**: Normalized Difference Water Index

### 5. Filter Image Collection
Filter satellite imagery by date range and geographic region.

```javascript
{
  "tool": "filter_collection_by_date_and_region",
  "arguments": {
    "collection_id": "LANDSAT/LC08/C02/T1_L2",
    "start_date": "2024-01-01",
    "end_date": "2024-01-31",
    "region": "New York"  // Place name or GeoJSON
  }
}
```

### 6. Create Cloud-Free Mosaic
Generate cloud-free composite images from satellite collections.

```javascript
{
  "tool": "create_clean_mosaic",
  "arguments": {
    "collection": "COPERNICUS/S2_SR",
    "dateStart": "2024-01-01",
    "dateEnd": "2024-01-31",
    "region": "Miami"
  }
}
```

### 7. Export Image to Cloud Storage
Export processed images to Google Cloud Storage.

```javascript
{
  "tool": "export_image_to_cloud_storage",
  "arguments": {
    "imageId": "processed_image_id",
    "region": "California",
    "bucket": "your-gcs-bucket",
    "fileNamePrefix": "export",
    "scale": 30,  // Resolution in meters
    "maxPixels": 1e9
  }
}
```

## Performance Optimizations

### Geometry Caching
- **LRU Cache**: Up to 100 geometries cached with least-recently-used eviction
- **TTL**: 1-hour time-to-live for cached entries
- **Hit Tracking**: Monitors cache performance and usage patterns

### Image Processing
- **Smart Clipping**: Images are clipped to exact shapefile boundaries
- **Progressive Loading**: Falls back to lower resolutions for large regions
- **Bounds Optimization**: Uses bounding boxes for URL generation to avoid size limits

## Error Handling

The server provides graceful error handling with detailed messages:

```javascript
// Example error response
{
  "error": "No shapefile boundary found for 'InvalidPlace'. Try a more specific name or check spelling.",
  "suggestions": ["Los Angeles", "San Francisco", "New York"]
}
```

## Testing

Run the comprehensive test suite:

```powershell
# PowerShell
.\test-earth-engine.ps1

# Bash
./test-earth-engine.sh
```

## API Endpoints

### Health Check
```
GET /health
```

Returns server status and available tools count.

### MCP Tool Execution
```
POST /api/mcp/sse
Content-Type: application/json

{
  "tool": "tool_name",
  "arguments": { ... }
}
```

## Common Use Cases

### 1. Vegetation Monitoring
Monitor vegetation health over agricultural areas:

```javascript
// Get NDVI for farmland
{
  "tool": "calculate_spectral_index",
  "arguments": {
    "imageId": "COPERNICUS/S2_SR/...",
    "index": "NDVI"
  }
}
```

### 2. Urban Analysis
Analyze urban growth and development:

```javascript
// Get high-res imagery of a city
{
  "tool": "get_thumbnail_image",
  "arguments": {
    "datasetId": "COPERNICUS/S2_SR",
    "start": "2024-01-01",
    "end": "2024-01-31",
    "aoi": "Los Angeles",
    "size": { "width": 2048, "height": 2048 }
  }
}
```

### 3. Water Resource Management
Monitor water bodies and drought conditions:

```javascript
// Calculate water index
{
  "tool": "calculate_spectral_index",
  "arguments": {
    "imageId": "LANDSAT/LC08/...",
    "index": "NDWI"
  }
}
```

## Troubleshooting

### Issue: Thumbnail returns low resolution
**Solution**: Ensure you're specifying the size parameter. Default is 1024x1024.

### Issue: Place name not found
**Solution**: Try more specific names or check the COMMON_PLACES list for supported aliases.

### Issue: Export fails with geometry error
**Solution**: The server automatically converts Earth Engine geometries to GeoJSON for export.

## Best Practices

1. **Use Place Names**: Leverage the built-in place name resolution instead of manual coordinates
2. **Cache Warming**: Frequently used places are automatically cached
3. **Batch Operations**: Combine multiple operations when possible
4. **Resolution Selection**: Use appropriate resolution for your use case (higher isn't always better)

## Support

For issues or questions:
- GitHub Issues: [your-repo/issues]
- Documentation: [your-docs-site]
- Email: support@your-domain.com

## License

MIT License - See LICENSE file for details.

## Acknowledgments

- Google Earth Engine for satellite imagery access
- Census TIGER for US administrative boundaries
- FAO GAUL for global administrative boundaries
