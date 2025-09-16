const { getEarthEngine } = require('./init');

/**
 * Export large areas with multiple options
 * @param {object} params - Export parameters
 * @returns {Promise<object>} Export options and instructions
 */
async function exportLargeArea(params) {
  const ee = getEarthEngine();
  const {
    datasetId,
    startDate,
    endDate,
    region,
    scale = 10,
    crs = 'EPSG:4326',
    bands = null,
    fileName = `large_export_${Date.now()}`,
    maxPixelsForDirect = 1e8, // 100 million pixels for direct download
    maxPixelsForDrive = 1e10  // 10 billion pixels for Drive export
  } = params;

  return new Promise((resolve, reject) => {
    try {
      // Create the image/composite
      let collection = ee.ImageCollection(datasetId)
        .filterDate(startDate, endDate);
      
      let exportRegion;
      if (region) {
        exportRegion = region.type === 'Point' 
          ? ee.Geometry.Point(region.coordinates).buffer(region.buffer || 5000)
          : ee.Geometry.Polygon(region.coordinates);
        collection = collection.filterBounds(exportRegion);
      }
      
      // Apply processing for Sentinel-2
      if (datasetId.includes('S2')) {
        collection = collection.map(function(img) {
          const qa = img.select('QA60');
          const cloudBitMask = 1 << 10;
          const cirrusBitMask = 1 << 11;
          const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
            .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
          return img.updateMask(mask)
            .select('B.*')
            .divide(10000)
            .copyProperties(img, ['system:time_start']);
        });
      }
      
      let image = collection.median();
      if (bands) {
        image = image.select(bands);
      }
      
      // Scale to 16-bit for export
      const exportImage = image.multiply(10000).toInt16();
      
      // Calculate area and pixel count
      const bounds = exportRegion.bounds();
      const coords = bounds.coordinates().getInfo()[0];
      const minLon = Math.min(...coords.map(c => c[0]));
      const maxLon = Math.max(...coords.map(c => c[0]));
      const minLat = Math.min(...coords.map(c => c[1]));
      const maxLat = Math.max(...coords.map(c => c[1]));
      
      const widthDegrees = maxLon - minLon;
      const heightDegrees = maxLat - minLat;
      const widthMeters = widthDegrees * 111320;
      const heightMeters = heightDegrees * 110540;
      const pixelWidth = Math.ceil(widthMeters / scale);
      const pixelHeight = Math.ceil(heightMeters / scale);
      const totalPixels = pixelWidth * pixelHeight;
      
      // Determine best export method based on size
      const exportMethods = [];
      
      // Method 1: Direct download (for smaller areas)
      if (totalPixels <= maxPixelsForDirect) {
        try {
          const downloadUrl = exportImage.getDownloadURL({
            name: fileName,
            region: exportRegion,
            scale: scale,
            crs: crs,
            format: 'GEO_TIFF',
            maxPixels: maxPixelsForDirect
          });
          
          exportMethods.push({
            method: 'Direct Download',
            available: true,
            url: downloadUrl,
            description: 'Download directly to your computer',
            estimatedSizeMB: Math.round((totalPixels * 2 * (bands ? bands.length : 12)) / (1024 * 1024)),
            limitations: 'Best for areas under 100 million pixels'
          });
        } catch (error) {
          exportMethods.push({
            method: 'Direct Download',
            available: false,
            reason: 'Area too large for direct download',
            error: error.message,
            description: 'Direct download not available for this area size'
          });
        }
      } else {
        exportMethods.push({
          method: 'Direct Download',
          available: false,
          reason: `Area has ${totalPixels.toLocaleString()} pixels, exceeds limit of ${maxPixelsForDirect.toLocaleString()}`,
          description: 'Use Code Editor or Python API for export to Google Drive'
        });
      }
      
      // Method 2: Tiled download (for medium areas)
      if (totalPixels > maxPixelsForDirect && totalPixels <= 1e9) {  // Limit tiling to 1 billion pixels
        // Calculate tiles needed
        const tileSize = Math.sqrt(maxPixelsForDirect) * scale; // meters per tile
        const tilesX = Math.ceil(widthMeters / tileSize);
        const tilesY = Math.ceil(heightMeters / tileSize);
        const totalTiles = tilesX * tilesY;
        
        const tiles = [];
        for (let x = 0; x < tilesX; x++) {
          for (let y = 0; y < tilesY; y++) {
            const tileMinLon = minLon + (x * tileSize / 111320);
            const tileMaxLon = Math.min(minLon + ((x + 1) * tileSize / 111320), maxLon);
            const tileMinLat = minLat + (y * tileSize / 110540);
            const tileMaxLat = Math.min(minLat + ((y + 1) * tileSize / 110540), maxLat);
            
            const tileRegion = ee.Geometry.Rectangle([tileMinLon, tileMinLat, tileMaxLon, tileMaxLat]);
            const tileUrl = exportImage.getDownloadURL({
              name: `${fileName}_tile_${x}_${y}`,
              region: tileRegion,
              scale: scale,
              crs: crs,
              format: 'GEO_TIFF',
              maxPixels: maxPixelsForDirect
            });
            
            tiles.push({
              tile: `${x}_${y}`,
              url: tileUrl,
              bounds: [tileMinLon, tileMinLat, tileMaxLon, tileMaxLat]
            });
          }
        }
        
        exportMethods.push({
          method: 'Tiled Download',
          available: true,
          totalTiles: totalTiles,
          tilesX: tilesX,
          tilesY: tilesY,
          tiles: tiles.slice(0, 5), // Show first 5 tiles as example
          description: `Download in ${totalTiles} tiles, then merge in GIS software`,
          instructions: 'Download each tile and use GDAL or QGIS to merge them',
          mergeCommand: `gdal_merge.py -o ${fileName}_merged.tif tile_*.tif`
        });
      }
      
      // Method 3: Generate Code Editor script
      const codeEditorScript = generateExportScript({
        datasetId: datasetId,
        startDate: startDate,
        endDate: endDate,
        region: region,
        bands: bands,
        scale: scale,
        crs: crs,
        fileName: fileName
      });
      
      exportMethods.push({
        method: 'Earth Engine Code Editor',
        available: true,
        description: 'Export to your personal Google Drive using Code Editor',
        script: codeEditorScript,
        instructions: [
          '1. Copy the script below',
          '2. Go to https://code.earthengine.google.com/',
          '3. Paste and run the script',
          '4. Click "Run" button in Tasks tab',
          '5. File will appear in your Google Drive'
        ]
      });
      
      // Method 4: Python API script
      const pythonScript = generatePythonScript({
        datasetId: datasetId,
        startDate: startDate,
        endDate: endDate,
        region: region,
        bands: bands,
        scale: scale,
        crs: crs,
        fileName: fileName
      });
      
      exportMethods.push({
        method: 'Python API',
        available: true,
        description: 'Use Earth Engine Python API for batch export',
        script: pythonScript,
        instructions: [
          '1. Install: pip install earthengine-api',
          '2. Authenticate: earthengine authenticate',
          '3. Run the Python script',
          '4. File will export to your Google Drive'
        ]
      });
      
      resolve({
        areaInfo: {
          bounds: [minLon, minLat, maxLon, maxLat],
          widthKm: Math.round(widthMeters / 1000),
          heightKm: Math.round(heightMeters / 1000),
          pixelDimensions: `${pixelWidth} x ${pixelHeight}`,
          totalPixels: totalPixels.toLocaleString(),
          estimatedSizeMB: Math.round((totalPixels * 2 * (bands ? bands.length : 12)) / (1024 * 1024))
        },
        exportMethods: exportMethods,
        recommendations: getRecommendations(totalPixels),
        parameters: {
          scale: scale,
          crs: crs,
          bands: bands || 'All bands',
          format: 'GeoTIFF (16-bit)'
        }
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Generate Earth Engine Code Editor script
 */
function generateExportScript(params) {
  const { datasetId, startDate, endDate, region, bands, scale, crs, fileName } = params;
  
  const regionStr = region.type === 'Point' 
    ? `ee.Geometry.Point([${region.coordinates.join(', ')}]).buffer(${region.buffer || 5000})`
    : `ee.Geometry.Polygon([${JSON.stringify(region.coordinates)}])`;
  
  const bandsStr = bands ? `.select(${JSON.stringify(bands)})` : '';
  
  return `// Earth Engine Code Editor Script
// Export large area to Google Drive

// Define the area of interest
var region = ${regionStr};

// Load and process the image collection
var collection = ee.ImageCollection('${datasetId}')
  .filterDate('${startDate}', '${endDate}')
  .filterBounds(region);

// Apply cloud masking for Sentinel-2
${datasetId.includes('S2') ? `collection = collection.map(function(image) {
  var qa = image.select('QA60');
  var cloudBitMask = 1 << 10;
  var cirrusBitMask = 1 << 11;
  var mask = qa.bitwiseAnd(cloudBitMask).eq(0)
    .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
  return image.updateMask(mask)
    .select('B.*')
    .divide(10000);
});` : ''}

// Create median composite
var image = collection.median()${bandsStr};

// Scale to 16-bit
var exportImage = image.multiply(10000).toInt16();

// Export to Drive
Export.image.toDrive({
  image: exportImage,
  description: '${fileName}',
  folder: 'EarthEngine_Exports',
  fileNamePrefix: '${fileName}',
  region: region,
  scale: ${scale},
  crs: '${crs}',
  maxPixels: 1e10,
  fileFormat: 'GeoTIFF',
  formatOptions: {
    cloudOptimized: true
  }
});

print('Export task created. Click Run in the Tasks tab to start the export.');
Map.centerObject(region, 10);
Map.addLayer(region, {color: 'red'}, 'Export Region');
Map.addLayer(image.select(['B4', 'B3', 'B2']), {min: 0, max: 0.3}, 'Image');`;
}

/**
 * Generate Python script for export
 */
function generatePythonScript(params) {
  const { datasetId, startDate, endDate, region, bands, scale, crs, fileName } = params;
  
  const regionStr = region.type === 'Point' 
    ? `ee.Geometry.Point([${region.coordinates.join(', ')}]).buffer(${region.buffer || 5000})`
    : `ee.Geometry.Polygon([${JSON.stringify(region.coordinates)}])`;
  
  const bandsStr = bands ? `.select(${JSON.stringify(bands)})` : '';
  
  return `#!/usr/bin/env python
# Earth Engine Python API Script
# Export large area to Google Drive

import ee
import time

# Initialize Earth Engine
ee.Initialize()

# Define the area of interest
region = ${regionStr}

# Load and process the image collection
collection = ee.ImageCollection('${datasetId}') \\
  .filterDate('${startDate}', '${endDate}') \\
  .filterBounds(region)

${datasetId.includes('S2') ? `# Apply cloud masking for Sentinel-2
def mask_clouds(image):
    qa = image.select('QA60')
    cloud_bit_mask = 1 << 10
    cirrus_bit_mask = 1 << 11
    mask = qa.bitwiseAnd(cloud_bit_mask).eq(0) \\
        .And(qa.bitwiseAnd(cirrus_bit_mask).eq(0))
    return image.updateMask(mask) \\
        .select('B.*') \\
        .divide(10000)

collection = collection.map(mask_clouds)` : ''}

# Create median composite
image = collection.median()${bandsStr}

# Scale to 16-bit
export_image = image.multiply(10000).toInt16()

# Export to Drive
task = ee.batch.Export.image.toDrive(
    image=export_image,
    description='${fileName}',
    folder='EarthEngine_Exports',
    fileNamePrefix='${fileName}',
    region=region,
    scale=${scale},
    crs='${crs}',
    maxPixels=1e10,
    fileFormat='GeoTIFF',
    formatOptions={'cloudOptimized': True}
)

# Start the export
task.start()
print(f'Export task started: {task.id}')
print('Check https://code.earthengine.google.com/tasks for progress')
print('File will appear in your Google Drive in the EarthEngine_Exports folder')`;
}

/**
 * Get recommendations based on pixel count
 */
function getRecommendations(pixelCount) {
  if (pixelCount < 1e8) {
    return 'Small area - Use direct download for immediate access';
  } else if (pixelCount < 1e9) {
    return 'Medium area - Use tiled download or Code Editor export';
  } else {
    return 'Large area - Use Code Editor or Python API for Drive export';
  }
}

module.exports = {
  exportLargeArea
};
