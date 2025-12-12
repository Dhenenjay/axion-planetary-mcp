# Claude Earth Engine MCP - Consolidated Tools Quick Reference

## Overview
Your Earth Engine MCP now uses 4 consolidated super tools instead of 30+ individual tools. This prevents Claude Desktop crashes and improves stability.

## The 4 Super Tools

### 1. 🗂️ earth_engine_data
**Purpose:** Handle all data-related operations

**Operations:**
- `search` - Search the Earth Engine catalog
- `filter` - Filter image collections by date/region
- `geometry` - Convert place names to boundaries
- `info` - Get dataset information
- `boundaries` - List available administrative boundaries

**Example Usage in Claude:**
```
Use earth_engine_data with operation "search" and query "Sentinel-2"
Use earth_engine_data with operation "geometry" and placeName "San Francisco, CA"
```

### 2. ⚙️ earth_engine_process
**Purpose:** Process and analyze Earth Engine data

**Operations:**
- `index` - Calculate spectral indices (NDVI, EVI, etc.)
- `analyze` - Statistical analysis
- `composite` - Create composites (median, mean, mosaic)
- `terrain` - Generate terrain products
- `clip` - Clip images to regions
- `mask` - Apply masks (clouds, water, etc.)
- `resample` - Resample images

**Example Usage in Claude:**
```
Use earth_engine_process with operation "index", index "NDVI", collectionId "COPERNICUS/S2_SR_HARMONIZED", startDate "2024-01-01", endDate "2024-01-31", and region "San Francisco"
```

### 3. 📤 earth_engine_export
**Purpose:** Export and visualize Earth Engine data

**Operations:**
- `thumbnail` - Generate thumbnail images
- `export` - Export to Google Cloud Storage
- `tiles` - Create map tiles
- `status` - Check export status
- `download` - Get download URLs

**Example Usage in Claude:**
```
Use earth_engine_export with operation "thumbnail", collectionId "LANDSAT/LC08/C02/T1_TOA", bands ["B4", "B3", "B2"], min [0,0,0], max [3000,3000,3000]
```

### 4. 🔧 earth_engine_system
**Purpose:** System and utility operations

**Operations:**
- `auth` - Check authentication status
- `execute` - Run custom Earth Engine code
- `setup` - Setup and configuration
- `load` - Load external data
- `system` - System information

**Example Usage in Claude:**
```
Use earth_engine_system with operation "auth" to check Earth Engine authentication
```

## Common Workflows

### Get Sentinel-2 imagery for a location:
1. Search for dataset: `earth_engine_data` with operation "search", query "Sentinel-2"
2. Convert location to geometry: `earth_engine_data` with operation "geometry", placeName "Your City"
3. Filter collection: `earth_engine_data` with operation "filter", collectionId, startDate, endDate, region
4. Generate thumbnail: `earth_engine_export` with operation "thumbnail"

### Calculate NDVI:
1. Use `earth_engine_process` with operation "index", index "NDVI", and your collection parameters

### Export to Cloud Storage:
1. Use `earth_engine_export` with operation "export" and specify bucket, folder, format

## Important Notes

- **Always specify the `operation` parameter** - this tells the tool what to do
- **Use camelCase for parameters** (e.g., `startDate` not `start_date`)
- **Dates should be in YYYY-MM-DD format**
- **Regions can be place names or GeoJSON**

## Troubleshooting

If you see authentication errors:
- Ensure your Google Cloud service account key is properly configured
- Check that the GOOGLE_APPLICATION_CREDENTIALS environment variable is set

If tools aren't appearing in Claude:
1. Restart Claude Desktop completely
2. Check the logs at: C:\Users\Dhenenjay\AppData\Roaming\Claude\logs

## Benefits of Consolidation

- ✅ 87% reduction in tool count (30+ → 4)
- ✅ Prevents MCP client crashes
- ✅ Faster loading in Claude
- ✅ Easier to understand and use
- ✅ All functionality preserved
