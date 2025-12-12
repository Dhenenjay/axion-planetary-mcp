# Tool Consolidation Plan

## Current State: 30 Tools
We have 30 individual tools causing MCP client crashes due to overload.

## Tool Categories Analysis

### 1. Data Access & Search (7 tools)
- search_gee_catalog.ts - Search for datasets
- filter_collection.ts - Filter by date/region
- get_band_names.ts - Get band information
- get_shapefile_boundary.ts - Get boundary geometries
- shapefile_to_geometry.ts - Convert place names to geometry
- use_shapefile_instead.ts - Use shapefile boundaries
- smart_filter.ts - Smart filtering with defaults

### 2. Processing & Analysis (10 tools)
- clip_image.ts - Clip images to regions
- mask_clouds.ts - Cloud masking
- spectral_index.ts - Calculate indices (NDVI, etc.)
- change_detect.ts - Change detection
- time_series.ts - Time series analysis
- reduce_stats.ts - Statistical reduction
- zonal_stats.ts - Zonal statistics
- terrain.ts - Terrain analysis
- create_mosaic.ts - Create mosaics
- resample_image.ts - Resample images

### 3. Export & Output (8 tools)
- export_image.ts - Basic export
- export_to_drive.ts - Export to Google Drive
- export_to_gcs.ts - Export to Cloud Storage
- export_composite.ts - Export composites
- export_status.ts - Check export status
- setup_gcs.ts - Setup GCS bucket
- get_thumbnail.ts - Generate thumbnails
- get_tiles.ts - Get map tiles

### 4. Utility & System (5 tools)
- auth_check.ts - Check authentication
- gee_script_js.ts - Run GEE JavaScript
- gee_sdk_call.ts - Direct SDK calls
- load_cog_from_gcs.ts - Load COG files
- index.ts - Tool registry

## Proposed Consolidation: 4 Super Tools

### 1. `earth_engine_data` - Data Discovery & Access
Combines:
- search_gee_catalog
- filter_collection
- get_band_names
- get_shapefile_boundary
- shapefile_to_geometry
- use_shapefile_instead
- smart_filter

Operations:
- search: Find datasets
- filter: Filter by date/region/properties
- info: Get dataset/band information
- geometry: Handle all geometry operations

### 2. `earth_engine_process` - Processing & Analysis
Combines:
- clip_image
- mask_clouds
- spectral_index
- change_detect
- time_series
- reduce_stats
- zonal_stats
- terrain
- create_mosaic
- resample_image

Operations:
- clip: Clip to region
- mask: Cloud/quality masking
- index: Calculate any spectral index
- analyze: Statistics, time series, change detection
- composite: Create composites/mosaics
- terrain: Elevation analysis

### 3. `earth_engine_export` - Export & Visualization
Combines:
- export_image
- export_to_drive
- export_to_gcs
- export_composite
- export_status
- get_thumbnail
- get_tiles

Operations:
- export: To GCS/Drive with auto-detection
- visualize: Thumbnails and tiles
- status: Check export status

### 4. `earth_engine_system` - System & Advanced
Combines:
- auth_check
- gee_script_js
- gee_sdk_call
- setup_gcs
- load_cog_from_gcs

Operations:
- setup: Configure GCS, auth
- execute: Run custom GEE code
- load: Load external data

## Benefits
1. **Reduced from 30 to 4 tools** - No more MCP crashes
2. **Logical grouping** - Easier to understand
3. **Flexible operations** - Each tool has multiple operations
4. **Backward compatible** - Same functionality, better organization
5. **Future-proof** - Easy to add new operations to existing tools

## Implementation Strategy
1. Create new consolidated tool files
2. Use `operation` parameter to select functionality
3. Maintain all existing logic
4. Test thoroughly
5. Update MCP configuration
