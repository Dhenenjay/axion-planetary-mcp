# Common Earth Engine Workflows

## 1. Basic Vegetation Analysis

### Workflow: Calculate NDVI for a Region
```javascript
// Step 1: Search for Sentinel-2 data
{
  "tool": "search_gee_catalog",
  "params": { "query": "sentinel-2" }
}

// Step 2: Filter collection by date and area
{
  "tool": "filter_collection_by_date_and_region",
  "params": {
    "datasetId": "COPERNICUS/S2_SR",
    "aoi": {
      "type": "Polygon",
      "coordinates": [[[-122.5, 37.5], [-122, 37.5], [-122, 38], [-122.5, 38], [-122.5, 37.5]]]
    },
    "start": "2024-06-01",
    "end": "2024-06-30"
  }
}

// Step 3: Calculate NDVI
{
  "tool": "calculate_spectral_index",
  "params": {
    "imageId": "COPERNICUS/S2_SR/20240615T183919_20240615T184851_T10SEG",
    "index": "NDVI",
    "mapping": { "nir": "B8", "red": "B4" }
  }
}

// Step 4: Get visualization URL
{
  "tool": "get_map_visualization_url",
  "params": {
    "imageId": "processed_ndvi_image_id",
    "visParams": {
      "bands": ["NDVI"],
      "min": 0,
      "max": 1,
      "palette": ["red", "yellow", "green"]
    }
  }
}
```

## 2. Cloud-Free Composite Creation

### Workflow: Generate Seasonal Composite
```javascript
// Step 1: Create cloud-free mosaic
{
  "tool": "create_clean_mosaic",
  "params": {
    "datasetId": "LANDSAT/LC09/C02/T1_L2",
    "start": "2024-03-01",
    "end": "2024-05-31"
  }
}

// Step 2: Mask remaining clouds
{
  "tool": "mask_clouds_from_image",
  "params": {
    "dataset": "L9",
    "datasetId": "LANDSAT/LC09/C02/T1_L2"
  }
}

// Step 3: Clip to study area
{
  "tool": "clip_image_to_region",
  "params": {
    "imageId": "mosaic_image_id",
    "aoi": {
      "type": "Feature",
      "geometry": { "type": "Polygon", "coordinates": [[...]] }
    }
  }
}
```

## 3. Change Detection Analysis

### Workflow: Forest Change Detection
```javascript
// Step 1: Get before image
{
  "tool": "create_clean_mosaic",
  "params": {
    "datasetId": "COPERNICUS/S2_SR",
    "start": "2023-06-01",
    "end": "2023-08-31"
  }
}

// Step 2: Get after image
{
  "tool": "create_clean_mosaic",
  "params": {
    "datasetId": "COPERNICUS/S2_SR",
    "start": "2024-06-01",
    "end": "2024-08-31"
  }
}

// Step 3: Detect changes
{
  "tool": "detect_change_between_images",
  "params": {
    "imageAId": "image_2024",
    "imageBId": "image_2023",
    "band": "NDVI"
  }
}

// Step 4: Calculate statistics
{
  "tool": "calculate_summary_statistics",
  "params": {
    "imageId": "change_image",
    "aoi": { "type": "Polygon", "coordinates": [[...]] },
    "scale": 30
  }
}
```

## 4. Time Series Analysis

### Workflow: Monthly NDVI Trend
```javascript
// Step 1: Create time series
{
  "tool": "create_time_series_chart_for_region",
  "params": {
    "datasetId": "MODIS/006/MOD13A2",
    "aoi": {
      "type": "Point",
      "coordinates": [-122.4194, 37.7749]
    },
    "band": "NDVI"
  }
}

// Step 2: Export results
{
  "tool": "export_image_to_cloud_storage",
  "params": {
    "imageId": "time_series_stack",
    "bucket": "my-earth-engine-exports",
    "fileNamePrefix": "ndvi_timeseries_2024",
    "aoi": { "type": "Polygon", "coordinates": [[...]] },
    "scale": 250
  }
}

// Step 3: Monitor export
{
  "tool": "get_export_task_status",
  "params": {
    "taskId": "export_task_id"
  }
}
```

## 5. Terrain Analysis

### Workflow: Slope and Watershed Analysis
```javascript
// Step 1: Calculate terrain
{
  "tool": "calculate_slope_and_aspect",
  "params": {
    "demAssetId": "USGS/SRTMGL1_003"
  }
}

// Step 2: Get statistics by zones
{
  "tool": "calculate_zonal_statistics",
  "params": {
    "imageId": "slope_image",
    "zonesAssetId": "users/myaccount/watersheds",
    "scale": 30
  }
}
```

## 6. Water Detection

### Workflow: Water Body Mapping
```javascript
// Step 1: Calculate water index
{
  "tool": "calculate_spectral_index",
  "params": {
    "imageId": "COPERNICUS/S2_SR/20240615T103031_20240615T103026_T32TQM",
    "index": "NDWI",
    "mapping": { 
      "nir": "B8", 
      "red": "B4",
      "green": "B3"
    }
  }
}

// Step 2: Get thumbnail
{
  "tool": "get_thumbnail_image",
  "params": {
    "imageId": "ndwi_image",
    "aoi": { "type": "Polygon", "coordinates": [[...]] },
    "visParams": {
      "bands": ["NDWI"],
      "min": -1,
      "max": 1,
      "palette": ["brown", "white", "blue"]
    },
    "size": { "width": 800, "height": 600 }
  }
}
```

## 7. Agricultural Monitoring

### Workflow: Crop Health Assessment
```javascript
// Step 1: Filter agricultural season
{
  "tool": "filter_collection_by_date_and_region",
  "params": {
    "datasetId": "COPERNICUS/S2_SR",
    "aoi": { "type": "Polygon", "coordinates": [[...]] },
    "start": "2024-04-01",
    "end": "2024-10-31"
  }
}

// Step 2: Calculate EVI
{
  "tool": "calculate_spectral_index",
  "params": {
    "imageId": "filtered_image",
    "index": "EVI",
    "mapping": {
      "nir": "B8",
      "red": "B4",
      "green": "B3"
    }
  }
}

// Step 3: Field-level statistics
{
  "tool": "calculate_zonal_statistics",
  "params": {
    "imageId": "evi_image",
    "zonesAssetId": "users/myaccount/field_boundaries",
    "scale": 10
  }
}
```

## 8. Custom Analysis with JavaScript

### Workflow: Advanced Processing
```javascript
// Use custom Earth Engine JavaScript
{
  "tool": "gee_script_js",
  "params": {
    "codeJs": `
      // Tasseled Cap transformation for Landsat
      const image = ee.Image('LANDSAT/LC09/C02/T1_L2/LC09_044034_20240601');
      const bands = ['SR_B2','SR_B3','SR_B4','SR_B5','SR_B6','SR_B7'];
      
      const coefficients = ee.Array([
        [0.3037, 0.2793, 0.4743, 0.5585, 0.5082, 0.1863],  // Brightness
        [-0.2848, -0.2435, -0.5436, 0.7243, 0.0840, -0.1800], // Greenness
        [0.1509, 0.1973, 0.3279, 0.3406, -0.7112, -0.4572]  // Wetness
      ]);
      
      const arrayImage = image.select(bands).toArray();
      const tc = ee.Image(coefficients)
        .matrixMultiply(arrayImage.toArray(1))
        .arrayProject([0])
        .arrayFlatten([['brightness', 'greenness', 'wetness']]);
      
      result = tc.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: ee.Geometry.Point([-122.4, 37.8]).buffer(1000),
        scale: 30
      }).getInfo();
    `
  }
}
```

## Quick Reference

### Essential Tools Chain
1. `auth_check` → Verify connection
2. `search_gee_catalog` → Find datasets
3. `filter_collection_by_date_and_region` → Subset data
4. `calculate_spectral_index` → Compute indices
5. `get_map_visualization_url` → Generate tiles
6. `export_image_to_cloud_storage` → Save results
7. `get_export_task_status` → Monitor progress

### Common Patterns
- **Always check auth first**: `auth_check`
- **Filter before processing**: Reduce data volume
- **Use appropriate scale**: Match native resolution
- **Monitor exports**: Check task status
- **Validate results**: Use `calculate_summary_statistics`

### Performance Tips
- Filter collections by date first, then by bounds
- Use median composites for cloud-free imagery
- Export large areas in tiles
- Cache frequently used datasets
- Use thumbnails for previews, tiles for interactive maps
