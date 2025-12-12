# Google Earth Engine MCP Tools

This directory contains Model Context Protocol (MCP) tools for interacting with Google Earth Engine from AI assistants.

## Overview

[Google Earth Engine](https://earthengine.google.com/) is a cloud-based platform for planetary-scale geospatial analysis that brings Google's computing power to bear on scientific analysis and visualization of geospatial datasets. These MCP tools allow AI assistants to:

- Initialize and authenticate with Earth Engine
- Work with image collections and filter data by date, region, and metadata
- Create band indices like NDVI
- Apply cloud masks and create composites
- Run custom band math expressions
- Perform time series analysis
- Export data to Google Drive
- Monitor export tasks

## Authentication

Before using these tools, you need to:

1. [Sign up for Earth Engine](https://signup.earthengine.google.com/)
2. Create a service account in the [Google Cloud Console](https://console.cloud.google.com/)
3. Grant this service account Earth Engine access
4. Generate a private key for this service account (JSON format)

This private key is used with the `earthengine_initialize` tool to authenticate with Earth Engine.

> **IMPORTANT:** The service account key should be provided as a **JSON string**, not a file path. This allows the tool to be used directly in an AI assistant context without requiring local file access.

## Basic Tools

### 1. earthengine_initialize

Initialize and authenticate with Google Earth Engine.

**Parameters:**
- `privateKeyJson`: JSON string containing the service account private key (not a file path)

**Example:**
```javascript
// This is an example of how an AI assistant would call this tool
// with the actual service account JSON content as a string
earthengine_initialize({
  privateKeyJson: "{\"type\":\"service_account\",\"project_id\":\"your-project-id\",\"private_key_id\":\"...\",\"private_key\":\"...\"}"
})
```

### 2. earthengine_visualize_dataset

Generate a visualization (map) for an Earth Engine dataset.

**Parameters:**
- `datasetId`: Earth Engine dataset ID (e.g., "USGS/SRTMGL1_003")
- `visParams` (optional): Visualization parameters (min, max, palette, bands)

**Example:**
```javascript
earthengine_visualize_dataset({
  datasetId: "USGS/SRTMGL1_003",
  visParams: {
    min: 0,
    max: 3000,
    palette: ['blue', 'green', 'red']
  }
})
```

### 3. earthengine_get_image_info

Get metadata and information about an Earth Engine image dataset.

**Parameters:**
- `datasetId`: Earth Engine dataset ID

**Example:**
```javascript
earthengine_get_image_info({
  datasetId: "USGS/SRTMGL1_003"
})
```

### 4. earthengine_compute_stats

Compute statistics for an Earth Engine image in a specified region.

**Parameters:**
- `datasetId`: Earth Engine dataset ID
- `geometry`: GeoJSON geometry object representing a region
- `scale` (optional): Scale in meters for computations (default: 1000)

**Example:**
```javascript
earthengine_compute_stats({
  datasetId: "USGS/SRTMGL1_003",
  geometry: {
    "type": "Polygon",
    "coordinates": [
      [
        [-122.51, 37.77],
        [-122.51, 37.78],
        [-122.50, 37.78],
        [-122.50, 37.77],
        [-122.51, 37.77]
      ]
    ]
  },
  scale: 90
})
```

### 5. earthengine_search_datasets

Search for Earth Engine datasets.

**Parameters:**
- `query`: Search query for datasets

**Example:**
```javascript
earthengine_search_datasets({
  query: "landsat"
})
```

## Advanced Tools

### 1. earthengine_get_collection

Get information about an Earth Engine image collection.

**Parameters:**
- `collectionId`: Earth Engine image collection ID (e.g., "COPERNICUS/S2")

**Example:**
```javascript
earthengine_get_collection({
  collectionId: "COPERNICUS/S2"
})
```

### 2. earthengine_filter_by_date

Filter an Earth Engine image collection by date range.

**Parameters:**
- `collectionId`: Earth Engine image collection ID
- `startDate`: Start date in YYYY-MM-DD format
- `endDate`: End date in YYYY-MM-DD format

**Example:**
```javascript
earthengine_filter_by_date({
  collectionId: "COPERNICUS/S2",
  startDate: "2022-06-01",
  endDate: "2022-06-30"
})
```

### 3. earthengine_filter_by_bounds

Filter an Earth Engine image collection by geographic bounds.

**Parameters:**
- `collectionId`: Earth Engine image collection ID
- `geometry`: GeoJSON geometry object representing a region

**Example:**
```javascript
earthengine_filter_by_bounds({
  collectionId: "COPERNICUS/S2",
  geometry: {
    "type": "Polygon",
    "coordinates": [
      [
        [-122.51, 37.77],
        [-122.51, 37.78],
        [-122.50, 37.78],
        [-122.50, 37.77],
        [-122.51, 37.77]
      ]
    ]
  }
})
```

### 4. earthengine_filter_by_metadata

Filter an Earth Engine image collection by a metadata property.

**Parameters:**
- `collectionId`: Earth Engine image collection ID
- `property`: Property name to filter by
- `operator`: Operator for comparison (e.g., "less_than", "equals")
- `value`: Value to compare against

**Example:**
```javascript
earthengine_filter_by_metadata({
  collectionId: "COPERNICUS/S2",
  property: "CLOUDY_PIXEL_PERCENTAGE",
  operator: "less_than",
  value: 10
})
```

### 5. earthengine_calculate_index

Calculate a normalized difference index (e.g., NDVI) for an image.

**Parameters:**
- `imageId`: Earth Engine image ID
- `bandA`: First band name
- `bandB`: Second band name
- `visParams` (optional): Visualization parameters

**Example:**
```javascript
// Calculate NDVI (Normalized Difference Vegetation Index)
earthengine_calculate_index({
  imageId: "LANDSAT/LC08/C02/T1_TOA/LC08_044034_20140318",
  bandA: "B5",  // NIR band
  bandB: "B4",  // Red band
  visParams: {
    min: -1,
    max: 1,
    palette: ['blue', 'white', 'green']
  }
})
```

### 6. earthengine_apply_cloud_mask

Apply a cloud mask to a Landsat image.

**Parameters:**
- `imageId`: Earth Engine Landsat image ID
- `cloudThreshold`: Cloud threshold (0-100)
- `visParams` (optional): Visualization parameters

**Example:**
```javascript
earthengine_apply_cloud_mask({
  imageId: "LANDSAT/LC08/C02/T1_TOA/LC08_044034_20140318",
  cloudThreshold: 20,
  visParams: {
    bands: ['B4', 'B3', 'B2'],
    min: 0,
    max: 0.3
  }
})
```

### 7. earthengine_create_composite

Create a composite image from a collection (median, mean, etc.).

**Parameters:**
- `collectionId`: Earth Engine image collection ID
- `method`: Composite method ('median', 'mean', 'min', 'max', 'mosaic')
- `startDate` (optional): Start date in YYYY-MM-DD format
- `endDate` (optional): End date in YYYY-MM-DD format
- `geometry` (optional): GeoJSON geometry object representing a region
- `cloudCoverMax` (optional): Maximum cloud cover percentage
- `visParams` (optional): Visualization parameters

**Example:**
```javascript
earthengine_create_composite({
  collectionId: "LANDSAT/LC08/C02/T1_TOA",
  method: "median",
  startDate: "2020-06-01",
  endDate: "2020-09-01",
  geometry: {
    "type": "Polygon",
    "coordinates": [
      [
        [-122.51, 37.77],
        [-122.51, 37.78],
        [-122.50, 37.78],
        [-122.50, 37.77],
        [-122.51, 37.77]
      ]
    ]
  },
  cloudCoverMax: 20,
  visParams: {
    bands: ['B4', 'B3', 'B2'],
    min: 0,
    max: 0.3
  }
})
```

### 8. earthengine_apply_expression

Apply a custom band math expression to an image.

**Parameters:**
- `imageId`: Earth Engine image ID
- `expression`: Math expression using band values
- `visParams` (optional): Visualization parameters

**Example:**
```javascript
// Example: Tasseled Cap transformation for Landsat 8
earthengine_apply_expression({
  imageId: "LANDSAT/LC08/C02/T1_TOA/LC08_044034_20140318",
  expression: "(0.3029 * b('B2')) + (0.2786 * b('B3')) + (0.4733 * b('B4')) + (0.5599 * b('B5')) + (0.508 * b('B6')) + (0.1872 * b('B7'))",
  visParams: {
    min: 0,
    max: 0.5
  }
})
```

### 9. earthengine_time_series

Run a time series analysis on an image collection for a region.

**Parameters:**
- `collectionId`: Earth Engine image collection ID
- `geometry`: GeoJSON geometry object representing a region
- `startDate`: Start date in YYYY-MM-DD format
- `endDate`: End date in YYYY-MM-DD format
- `bands`: List of band names to analyze

**Example:**
```javascript
earthengine_time_series({
  collectionId: "LANDSAT/LC08/C02/T1_TOA",
  geometry: {
    "type": "Polygon",
    "coordinates": [
      [
        [-122.51, 37.77],
        [-122.51, 37.78],
        [-122.50, 37.78],
        [-122.50, 37.77],
        [-122.51, 37.77]
      ]
    ]
  },
  startDate: "2020-01-01",
  endDate: "2020-12-31",
  bands: ["B4", "B5"]
})
```

### 10. earthengine_export_to_drive

Export an Earth Engine image to Google Drive.

**Parameters:**
- `imageId`: Earth Engine image ID
- `description`: Description for the export task
- `folder`: Google Drive folder name
- `geometry`: GeoJSON geometry object representing the export region
- `scale`: Scale in meters (e.g., 30 for Landsat)
- `maxPixels` (optional): Maximum number of pixels

**Example:**
```javascript
earthengine_export_to_drive({
  imageId: "LANDSAT/LC08/C02/T1_TOA/LC08_044034_20140318",
  description: "SF_Bay_Area_Landsat",
  folder: "Earth_Engine_Exports",
  geometry: {
    "type": "Polygon",
    "coordinates": [
      [
        [-122.51, 37.77],
        [-122.51, 37.78],
        [-122.50, 37.78],
        [-122.50, 37.77],
        [-122.51, 37.77]
      ]
    ]
  },
  scale: 30,
  maxPixels: 1e9
})
```

### 11. earthengine_task_status

Get the status of an Earth Engine export task.

**Parameters:**
- `taskId`: Earth Engine export task ID

**Example:**
```javascript
earthengine_task_status({
  taskId: "ABC123XYZ"
})
```

## Common Earth Engine Datasets

Here are some common Earth Engine datasets you can use with these tools:

- `USGS/SRTMGL1_003`: Shuttle Radar Topography Mission (SRTM) Digital Elevation Data
- `NASA/NASADEM_HGT/001`: NASA Digital Elevation Model
- `LANDSAT/LC08/C02/T1_L2`: Landsat 8 Collection 2 Level 2
- `LANDSAT/LC09/C02/T1_L2`: Landsat 9 Collection 2 Level 2
- `MODIS/006/MOD13Q1`: MODIS Vegetation Indices
- `COPERNICUS/S2`: Sentinel-2 MSI Level-1C
- `COPERNICUS/S2_SR`: Sentinel-2 MSI Level-2A (Surface Reflectance)
- `NOAA/GOES/16/FDCF`: GOES-16 Full Disk Cloud and Moisture 

## Resources

- [Earth Engine JavaScript API](https://developers.google.com/earth-engine/guides/javascript_install)
- [Earth Engine Data Catalog](https://developers.google.com/earth-engine/datasets)
- [Earth Engine Code Editor](https://code.earthengine.google.com/)
- [Earth Engine JavaScript API Reference](https://developers.google.com/earth-engine/apidocs) 