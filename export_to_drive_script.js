// Earth Engine Code Editor Script
// Export large area to Google Drive

// Define the area of interest
var region = ee.Geometry.Polygon([[[[-122.55,37.65],[-122.3,37.65],[-122.3,37.9],[-122.55,37.9],[-122.55,37.65]]]]);

// Load and process the image collection
var collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate('2024-08-01', '2024-09-01')
  .filterBounds(region);

// Apply cloud masking for Sentinel-2
collection = collection.map(function(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask)
    .select('B.*')
    .divide(10000);
});

// Create median composite
var image = collection.median().select(["B4","B3","B2","B8"]);

// Scale to 16-bit
var exportImage = image.multiply(10000).toInt16();

// Export to Drive
Export.image.toDrive({
  image: exportImage,
  description: 'sf_bay_area_sentinel2_10m',
  folder: 'EarthEngine_Exports',
  fileNamePrefix: 'sf_bay_area_sentinel2_10m',
  region: region,
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e10,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    cloudOptimized: true
  }
});

print('Export task created. Click Run in the Tasks tab to start the export.');
Map.centerObject(region, 10);
Map.addLayer(region, {color: 'red'}, 'Export Region');
Map.addLayer(image.select(['B4', 'B3', 'B2']), {min: 0, max: 0.3}, 'Image');