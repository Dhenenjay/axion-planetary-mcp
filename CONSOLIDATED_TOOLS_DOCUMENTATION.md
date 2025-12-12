# Earth Engine MCP - Consolidated Tools Documentation

## ⚡ CRITICAL UPDATE: Tool Consolidation for Stability

**We have consolidated 30 individual tools into 4 super tools to prevent MCP client crashes.**

### 🎯 The Problem Solved
- **Before**: 30+ tools causing MCP client crashes and instability
- **After**: 4 powerful super tools with multiple operations
- **Result**: 87% reduction in tool count, 100% functionality retained

## 📦 The 4 Super Tools

### 1. `earth_engine_data` - Data Discovery & Access

**Purpose**: Handle all data-related operations including search, filtering, and geometry management.

**Operations**:

#### `search` - Find datasets
```json
{
  "operation": "search",
  "query": "sentinel",  // Search term
  "limit": 10           // Max results
}
```

#### `filter` - Filter collections
```json
{
  "operation": "filter",
  "datasetId": "COPERNICUS/S2_SR_HARMONIZED",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "region": "San Francisco"  // Can be place name or geometry
}
```

#### `geometry` - Get boundaries
```json
{
  "operation": "geometry",
  "placeName": "Ludhiana"  // Returns shapefile boundary
}
```

#### `info` - Dataset information
```json
{
  "operation": "info",
  "datasetId": "COPERNICUS/S2_SR_HARMONIZED"
}
```

#### `boundaries` - List available boundaries
```json
{
  "operation": "boundaries"
}
```

---

### 2. `earth_engine_process` - Processing & Analysis

**Purpose**: All image processing, analysis, and computation operations.

**Operations**:

#### `clip` - Clip to region
```json
{
  "operation": "clip",
  "input": "COPERNICUS/S2_SR_HARMONIZED",
  "region": "San Francisco"
}
```

#### `mask` - Apply masks
```json
{
  "operation": "mask",
  "input": "COPERNICUS/S2_SR_HARMONIZED",
  "maskType": "clouds"  // clouds, water, quality, shadow
}
```

#### `index` - Calculate indices
```json
{
  "operation": "index",
  "input": "COPERNICUS/S2_SR_HARMONIZED",
  "indexType": "NDVI"  // NDVI, NDWI, NDBI, EVI, SAVI, MNDWI, custom
}
```

#### `analyze` - Statistical analysis
```json
{
  "operation": "analyze",
  "input": "COPERNICUS/S2_SR_HARMONIZED",
  "analysisType": "statistics",  // statistics, timeseries, change, zonal
  "reducer": "mean",  // mean, median, max, min, stdDev, sum
  "region": "Ludhiana"
}
```

#### `composite` - Create composites
```json
{
  "operation": "composite",
  "input": "COPERNICUS/S2_SR_HARMONIZED",
  "compositeType": "median",  // median, mean, max, min, mosaic, greenest
  "startDate": "2024-01-01",
  "endDate": "2024-12-31"
}
```

#### `terrain` - Elevation analysis
```json
{
  "operation": "terrain",
  "terrainType": "slope",  // elevation, slope, aspect, hillshade
  "region": "San Francisco"
}
```

#### `resample` - Change resolution
```json
{
  "operation": "resample",
  "input": "COPERNICUS/S2_SR_HARMONIZED",
  "targetScale": 30,
  "resampleMethod": "bilinear"  // bilinear, bicubic, nearest
}
```

---

### 3. `earth_engine_export` - Export & Visualization

**Purpose**: Handle all exports, thumbnails, tiles, and download operations.

**Operations**:

#### `export` - Export images
```json
{
  "operation": "export",
  "input": "COPERNICUS/S2_SR_HARMONIZED",
  "region": "Ludhiana",
  "destination": "gcs",  // gcs, drive, auto
  "bucket": "my-earth-engine-exports",
  "scale": 10,
  "format": "GeoTIFF"  // GeoTIFF, COG, TFRecord
}
```

#### `thumbnail` - Quick preview
```json
{
  "operation": "thumbnail",
  "input": "COPERNICUS/S2_SR_HARMONIZED",
  "region": "San Francisco",
  "dimensions": 512,
  "visParams": {
    "bands": ["B4", "B3", "B2"],
    "min": 0,
    "max": 3000
  }
}
```

#### `tiles` - Map tiles
```json
{
  "operation": "tiles",
  "input": "COPERNICUS/S2_SR_HARMONIZED",
  "region": "Ludhiana",
  "zoomLevel": 10
}
```

#### `status` - Check export status
```json
{
  "operation": "status",
  "taskId": "ABCD1234"
}
```

#### `download` - Get download links
```json
{
  "operation": "download",
  "bucket": "my-earth-engine-exports",
  "fileNamePrefix": "export_1234"
}
```

---

### 4. `earth_engine_system` - System & Advanced

**Purpose**: System operations, authentication, custom code execution, and external data loading.

**Operations**:

#### `auth` - Check authentication
```json
{
  "operation": "auth",
  "checkType": "status"  // status, projects, permissions
}
```

#### `execute` - Run custom code
```json
{
  "operation": "execute",
  "code": "return ee.Number(1).add(2).getInfo();",
  "language": "javascript"
}
```

#### `setup` - Configure system
```json
{
  "operation": "setup",
  "setupType": "gcs",  // gcs, auth, project
  "bucket": "my-earth-engine-exports"
}
```

#### `load` - Load external data
```json
{
  "operation": "load",
  "source": "gs://my-bucket/data.tif",
  "dataType": "cog"  // cog, geotiff, json
}
```

#### `info` - System information
```json
{
  "operation": "info",
  "infoType": "system"  // system, quotas, assets, tasks
}
```

## 🚀 Quick Start Examples

### Example 1: Search and Filter Sentinel-2 Data
```javascript
// Step 1: Search for Sentinel-2 datasets
earth_engine_data({
  operation: "search",
  query: "sentinel-2"
})

// Step 2: Get geometry for your area
earth_engine_data({
  operation: "geometry",
  placeName: "San Francisco"
})

// Step 3: Filter the collection
earth_engine_data({
  operation: "filter",
  datasetId: "COPERNICUS/S2_SR_HARMONIZED",
  startDate: "2024-01-01",
  endDate: "2024-12-31",
  region: "San Francisco"
})
```

### Example 2: Process and Export NDVI
```javascript
// Step 1: Calculate NDVI
earth_engine_process({
  operation: "index",
  input: "COPERNICUS/S2_SR_HARMONIZED",
  indexType: "NDVI"
})

// Step 2: Export to GCS
earth_engine_export({
  operation: "export",
  input: <ndvi_result>,
  region: "Ludhiana",
  destination: "gcs",
  bucket: "my-exports"
})

// Step 3: Check status
earth_engine_export({
  operation: "status",
  taskId: <task_id>
})
```

### Example 3: Create Cloud-Free Composite
```javascript
// Step 1: Mask clouds
earth_engine_process({
  operation: "mask",
  input: "COPERNICUS/S2_SR_HARMONIZED",
  maskType: "clouds"
})

// Step 2: Create median composite
earth_engine_process({
  operation: "composite",
  input: <masked_result>,
  compositeType: "median",
  startDate: "2024-01-01",
  endDate: "2024-12-31"
})

// Step 3: Generate thumbnail
earth_engine_export({
  operation: "thumbnail",
  input: <composite_result>,
  dimensions: 1024
})
```

## 🔧 Migration Guide

### Old Way (30 tools):
```javascript
// Multiple separate tools
search_gee_catalog({ query: "sentinel" })
filter_collection({ datasetId: "...", dates: "..." })
calculate_ndvi({ image: "..." })
export_to_gcs({ image: "..." })
```

### New Way (4 tools):
```javascript
// Consolidated tools with operations
earth_engine_data({ operation: "search", query: "sentinel" })
earth_engine_data({ operation: "filter", datasetId: "..." })
earth_engine_process({ operation: "index", indexType: "NDVI" })
earth_engine_export({ operation: "export", destination: "gcs" })
```

## 📊 Benefits of Consolidation

1. **Stability**: No more MCP client crashes from tool overload
2. **Simplicity**: Only 4 tools to remember instead of 30
3. **Flexibility**: Same functionality through operation parameters
4. **Performance**: Reduced overhead and faster tool discovery
5. **Maintainability**: Easier to update and extend

## 🆘 Troubleshooting

### Issue: Tool not found
**Solution**: Make sure you're using the new tool names (earth_engine_data, earth_engine_process, earth_engine_export, earth_engine_system)

### Issue: Operation not working
**Solution**: Check that you're including the `operation` parameter and it matches one of the valid operations for that tool

### Issue: Missing parameters
**Solution**: Each operation has different required parameters. Refer to the operation documentation above

## 📝 Notes

- All previous functionality is preserved
- The consolidation is backward-compatible in functionality
- Each super tool is self-contained and independent
- Operations within each tool are logically grouped
- Error messages include helpful context

## 🎯 Summary

**From 30 tools → 4 super tools**
- `earth_engine_data`: All data operations
- `earth_engine_process`: All processing operations
- `earth_engine_export`: All export/visualization operations
- `earth_engine_system`: All system/advanced operations

This consolidation ensures MCP client stability while maintaining full Earth Engine functionality.
