# Earth Engine MCP Tools - Complete Documentation
## For Claude Desktop, Cursor Agent, and other MCP Clients

This documentation provides complete usage instructions for all Earth Engine MCP tools. Each tool includes parameter details, examples, and expected outputs.

---

## 🔍 Tool 1: earth_engine_data
**Purpose**: Search datasets, get geometries, filter collections, and access dataset information.

### Operations:

#### 1.1 Search Datasets
```json
{
  "operation": "search",
  "query": "sentinel",  // or "landsat", "modis", "climate", "precipitation"
  "limit": 5
}
```
**Returns**: List of matching dataset IDs

#### 1.2 Get Geometry
```json
{
  "operation": "geometry",
  "placeName": "California"  // Any US state or major region
}
```
**Returns**: Geometry object for use in other operations

#### 1.3 Filter Collection
```json
{
  "operation": "filter",
  "datasetId": "COPERNICUS/S2_SR_HARMONIZED",
  "startDate": "2024-06-01",
  "endDate": "2024-06-30",
  "region": "Iowa",
  "cloudCoverMax": 20  // Optional: max cloud percentage
}
```
**Returns**: Filtered collection info with image count and band names

#### 1.4 Get Dataset Info
```json
{
  "operation": "info",
  "datasetId": "LANDSAT/LC08/C02/T1_L2"
}
```
**Returns**: Dataset metadata, bands, and description

---

## ⚙️ Tool 2: earth_engine_process
**Purpose**: Process imagery - calculate indices, create composites, analyze terrain, perform statistics.

### Operations:

#### 2.1 Calculate Vegetation Index
```json
{
  "operation": "index",
  "indexType": "NDVI",  // Options: NDVI, NDWI, EVI, SAVI, NBR, NDBI, MNDWI
  "datasetId": "COPERNICUS/S2_SR_HARMONIZED",
  "startDate": "2024-07-01",
  "endDate": "2024-07-31",
  "region": "Iowa",
  "scale": 30  // Resolution in meters
}
```
**Returns**: Index calculation result with visualization parameters

#### 2.2 Create Composite
```json
{
  "operation": "composite",
  "compositeType": "median",  // Options: median, mean, max, min, mosaic, greenest
  "datasetId": "COPERNICUS/S2_SR_HARMONIZED",
  "startDate": "2024-06-01",
  "endDate": "2024-06-30",
  "region": "California"
}
```
**Returns**: Composite key for use in mapping or export

#### 2.3 Cloud Masking
```json
{
  "operation": "mask",
  "maskType": "clouds",  // Options: clouds, water, quality, shadow
  "datasetId": "COPERNICUS/S2_SR_HARMONIZED",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "region": "Texas"
}
```

#### 2.4 Terrain Analysis
```json
{
  "operation": "terrain",
  "terrainType": "slope",  // Options: elevation, slope, aspect, hillshade
  "region": "Colorado"
}
```

#### 2.5 Statistical Analysis
```json
{
  "operation": "analyze",
  "analysisType": "statistics",  // or "timeseries", "histogram", "zonal"
  "datasetId": "COPERNICUS/S2_SR_HARMONIZED",
  "region": "Nebraska",
  "startDate": "2024-06-01",
  "endDate": "2024-06-30",
  "reducer": "mean",  // Options: mean, median, max, min, stdDev, sum
  "scale": 100
}
```

#### 2.6 Time Series
```json
{
  "operation": "analyze",
  "analysisType": "timeseries",
  "datasetId": "MODIS/006/MOD13Q1",
  "band": "NDVI",
  "startDate": "2024-01-01",
  "endDate": "2024-06-30",
  "region": "Kansas",
  "scale": 250
}
```

---

## 📤 Tool 3: earth_engine_export
**Purpose**: Export data, generate thumbnails, create tiles, check export status.

### Operations:

#### 3.1 Generate Thumbnail
```json
{
  "operation": "thumbnail",
  "datasetId": "COPERNICUS/S2_SR_HARMONIZED",
  "startDate": "2024-06-01",
  "endDate": "2024-06-30",
  "region": "Nebraska",
  "dimensions": 800,  // Size in pixels
  "visParams": {
    "bands": ["B4", "B3", "B2"],  // RGB bands
    "min": 0,
    "max": 3000,
    "gamma": 1.4
  }
}
```
**Returns**: URL to thumbnail image

#### 3.2 Export to Cloud Storage
```json
{
  "operation": "export",
  "destination": "auto",  // or "gcs", "drive"
  "datasetId": "LANDSAT/LC08/C02/T1_L2",
  "startDate": "2024-01-01",
  "endDate": "2024-01-31",
  "region": "Wyoming",
  "scale": 30,
  "format": "GeoTIFF"  // or "COG", "TFRecord"
}
```
**Returns**: Task ID for monitoring export progress

#### 3.3 Check Export Status
```json
{
  "operation": "status",
  "taskId": "YOUR_TASK_ID_HERE"
}
```

---

## 🗺️ Tool 4: earth_engine_map
**Purpose**: Create interactive web maps with tile services.

### Operations:

#### 4.1 Create Map
```json
{
  "operation": "create",
  "input": "composite_key_here",  // From earth_engine_process composite operation
  "region": "California",
  "visParams": {
    "bands": ["B4", "B3", "B2"],
    "min": 0,
    "max": 3000,
    "gamma": 1.4
  },
  "basemap": "satellite",  // Options: satellite, terrain, roadmap, dark
  "zoom": 8
}
```
**Returns**: Map URL and tile service URL

#### 4.2 List Maps
```json
{
  "operation": "list"
}
```
**Returns**: List of active map sessions

#### 4.3 Delete Map
```json
{
  "operation": "delete",
  "mapId": "map_id_here"
}
```

---

## 🌾 Tool 5: crop_classification
**Purpose**: Machine learning classification for agriculture and land cover.

### Operations:

#### 5.1 Classify Crops (Quick - Use Defaults)
```json
{
  "operation": "classify",
  "region": "Iowa",  // Supported: Iowa, California, Texas, Kansas, Nebraska, Illinois
  "startDate": "2024-05-01",
  "endDate": "2024-09-30",
  "classifier": "randomForest",
  "numberOfTrees": 50,
  "includeIndices": true,
  "createMap": false  // Set to true for map (slower)
}
```

#### 5.2 Classify with Custom Training Data
```json
{
  "operation": "classify",
  "region": "California",
  "startDate": "2024-01-01",
  "endDate": "2024-12-31",
  "classifier": "svm",
  "trainingData": [
    {"lat": 36.5370, "lon": -119.5217, "label": 1, "class_name": "almonds"},
    {"lat": 38.5049, "lon": -122.4694, "label": 2, "class_name": "grapes"},
    {"lat": 39.3600, "lon": -121.5900, "label": 3, "class_name": "rice"}
  ],
  "includeIndices": true,
  "scale": 30,
  "spatialFiltering": true,
  "kernelSize": 3
}
```

#### 5.3 Train Model Only
```json
{
  "operation": "train",
  "region": "Kansas",
  "startDate": "2024-05-01",
  "endDate": "2024-09-30",
  "classifier": "cart",  // Options: randomForest, svm, cart, naiveBayes
  "includeIndices": true
}
```

**Default Classes by Region**:
- **Iowa**: corn, soybean, wheat, urban, water
- **California**: almonds, grapes, citrus, rice, forest, urban, desert, water
- **Texas**: cotton, wheat, corn, sorghum, grassland, urban
- **Kansas**: wheat, corn, sorghum, soybean, grassland, urban
- **Nebraska**: corn, soybean, wheat, grassland, urban
- **Illinois**: corn, soybean, wheat, urban, water

---

## 🔧 Tool 6: earth_engine_system
**Purpose**: System operations, authentication, custom code execution.

### Operations:

#### 6.1 Check Authentication
```json
{
  "operation": "auth",
  "checkType": "status"  // or "projects", "permissions"
}
```

#### 6.2 System Health
```json
{
  "operation": "health"
}
```

#### 6.3 System Info
```json
{
  "operation": "info",
  "infoType": "system"  // or "quotas", "assets", "tasks"
}
```

#### 6.4 Execute Custom Code
```json
{
  "operation": "execute",
  "code": "var dataset = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED').filterDate('2024-06-01', '2024-06-30'); print('Count:', dataset.size());",
  "language": "javascript"
}
```

---

## 📊 Common Workflows

### Workflow 1: Agricultural Analysis
1. Search for datasets: `earth_engine_data` with operation "search"
2. Filter collection: `earth_engine_data` with operation "filter"
3. Calculate NDVI: `earth_engine_process` with operation "index"
4. Classify crops: `crop_classification` with operation "classify"
5. Create map: `earth_engine_map` with operation "create"

### Workflow 2: Environmental Monitoring
1. Get region geometry: `earth_engine_data` with operation "geometry"
2. Create composite: `earth_engine_process` with operation "composite"
3. Calculate indices: `earth_engine_process` with operation "index"
4. Generate thumbnail: `earth_engine_export` with operation "thumbnail"
5. Export results: `earth_engine_export` with operation "export"

### Workflow 3: Time Series Analysis
1. Filter data: `earth_engine_data` with operation "filter"
2. Run time series: `earth_engine_process` with operation "analyze", analysisType "timeseries"
3. Export results: `earth_engine_export` with operation "export"

---

## 🎯 Best Practices

1. **Start Small**: Test with smaller regions before processing large areas
2. **Use Appropriate Scale**: 
   - Sentinel-2: 10-30m
   - Landsat: 30m
   - MODIS: 250-500m
3. **Date Ranges**: Keep to 1-6 months for faster processing
4. **Cloud Cover**: Use cloudCoverMax parameter to filter cloudy images
5. **Classifiers**:
   - Random Forest: Best overall accuracy
   - SVM: Good for smaller datasets
   - CART: Fast, interpretable
   - Naive Bayes: Simple, fast

---

## ⚠️ Troubleshooting

### Timeout Issues
- Reduce region size
- Increase scale parameter
- Disable createMap for classification
- Use fewer training points

### Memory Issues
- Process smaller areas
- Use coarser resolution (higher scale value)
- Reduce date range

### No Results
- Check date range has data
- Verify region name is correct
- Ensure dataset ID is valid

---

## 📝 Dataset IDs Reference

### Optical Imagery
- `COPERNICUS/S2_SR_HARMONIZED` - Sentinel-2 (10m)
- `LANDSAT/LC08/C02/T1_L2` - Landsat 8 (30m)
- `LANDSAT/LC09/C02/T1_L2` - Landsat 9 (30m)
- `MODIS/006/MOD13Q1` - MODIS Vegetation Indices (250m)

### Climate Data
- `NASA/GDDP-CMIP6` - Climate projections
- `ECMWF/ERA5/DAILY` - ERA5 reanalysis
- `NASA/GPM_L3/IMERG_V06` - Precipitation

### Elevation
- `NASA/SRTM_V3` - SRTM 30m
- `COPERNICUS/DEM/GLO30` - Copernicus DEM 30m

### Land Cover
- `ESA/WorldCover/v200` - ESA WorldCover 10m
- `GOOGLE/DYNAMICWORLD/V1` - Dynamic World 10m

---

## 💡 Tips for MCP Clients

1. **Always specify operation** parameter for multi-operation tools
2. **Use ISO date format** (YYYY-MM-DD) for dates
3. **Region names** are case-insensitive
4. **Composite keys** from processing can be reused in mapping
5. **Task IDs** from exports can be monitored for progress

---

## 📧 Support

For issues or questions about these tools, ensure:
1. The Next.js server is running on port 3000
2. Earth Engine authentication is configured
3. Region names are valid US states or recognized areas
4. Date ranges have available imagery