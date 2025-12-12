#!/usr/bin/env python
# Earth Engine Python API Script
# Export large area to Google Drive

import ee
import time

# Initialize Earth Engine
ee.Initialize()

# Define the area of interest
region = ee.Geometry.Polygon([[[[-122.55,37.65],[-122.3,37.65],[-122.3,37.9],[-122.55,37.9],[-122.55,37.65]]]])

# Load and process the image collection
collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED') \
  .filterDate('2024-08-01', '2024-09-01') \
  .filterBounds(region)

# Apply cloud masking for Sentinel-2
def mask_clouds(image):
    qa = image.select('QA60')
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0) \
        .And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
    return image.updateMask(mask) \
        .select('B.*') \
        .divide(10000)

collection = collection.map(mask_clouds)

# Create median composite
image = collection.median().select(["B4","B3","B2","B8"])

# Scale to 16-bit
export_image = image.multiply(10000).toInt16()

# Export to Drive
task = ee.batch.Export.image.toDrive(
    image=export_image,
    description='sf_bay_area_sentinel2_10m',
    folder='EarthEngine_Exports',
    fileNamePrefix='sf_bay_area_sentinel2_10m',
    region=region,
    scale=10,
    crs='EPSG:4326',
    maxPixels=1e10,
    fileFormat='GeoTIFF',
    formatOptions={'cloudOptimized': True}
)

# Start the export
task.start()
print(f'Export task started: {task.id}')
print('Check https://code.earthengine.google.com/tasks for progress')
print('File will appear in your Google Drive in the EarthEngine_Exports folder')