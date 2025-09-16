const { getEarthEngine } = require('./init');

/**
 * Generate both thumbnail and full-resolution export URLs
 * @param {object} image - Earth Engine image object
 * @param {object} params - Export parameters
 * @returns {object} URLs and metadata
 */
function generateExportUrls(image, params) {
  const ee = getEarthEngine();
  const {
    region,
    scale = 10,
    crs = 'EPSG:4326',
    bands = null,
    fileName = `export_${Date.now()}`,
    maxPixels = 1e9,
    thumbnailSize = '1024x1024'
  } = params;

  // Get band names
  let exportBands = bands;
  if (!exportBands) {
    const bandNames = image.bandNames();
    exportBands = bandNames.getInfo();
  }

  // Select bands for export
  const exportImage = bands ? image.select(bands) : image;

  // Generate thumbnail URL for preview (small, quick)
  const thumbnailUrl = exportImage.getThumbURL({
    dimensions: thumbnailSize,
    region: region,
    format: 'png',
    min: 0,
    max: 3000
  });

  // Generate download URL for full GeoTIFF (full resolution)
  const fullDownloadUrl = exportImage.getDownloadURL({
    name: fileName,
    region: region,
    scale: scale,
    crs: crs,
    format: 'GeoTIFF',
    maxPixels: maxPixels,
    filePerBand: false
  });

  // For very large exports, provide batch export instructions
  const estimatedPixels = estimatePixelCount(region, scale);
  const needsBatchExport = estimatedPixels > maxPixels;

  return {
    thumbnail: {
      url: thumbnailUrl,
      description: 'Quick preview image (PNG)',
      dimensions: thumbnailSize
    },
    download: {
      url: fullDownloadUrl,
      description: 'Full resolution GeoTIFF download',
      format: 'GeoTIFF',
      scale: scale,
      crs: crs,
      bands: exportBands,
      bandCount: exportBands.length
    },
    metadata: {
      fileName: `${fileName}.tif`,
      estimatedPixels: estimatedPixels,
      needsBatchExport: needsBatchExport,
      maxPixelsAllowed: maxPixels
    },
    batchExportNote: needsBatchExport ? 
      'This export is too large for direct download. Use Export.image.toDrive() for batch processing.' : 
      null
  };
}

/**
 * Estimate pixel count for an export
 * @param {object} region - Export region
 * @param {number} scale - Resolution in meters
 * @returns {number} Estimated pixel count
 */
function estimatePixelCount(region, scale) {
  // Rough estimation based on region type
  if (!region) return 1e6; // Default estimate
  
  if (region.type === 'Point') {
    // Point with 5km buffer
    const bufferArea = Math.PI * 5000 * 5000; // m²
    return Math.ceil(bufferArea / (scale * scale));
  } else if (region.type === 'Polygon' && region.coordinates) {
    // Very rough estimate for polygon (assumes square-ish shape)
    // This is a simplification; actual calculation would need geodesic area
    const coords = region.coordinates[0];
    if (coords && coords.length >= 3) {
      const minLon = Math.min(...coords.map(c => c[0]));
      const maxLon = Math.max(...coords.map(c => c[0]));
      const minLat = Math.min(...coords.map(c => c[1]));
      const maxLat = Math.max(...coords.map(c => c[1]));
      
      // Convert degrees to meters (rough approximation at equator)
      const width = (maxLon - minLon) * 111320;
      const height = (maxLat - minLat) * 110540;
      const area = width * height;
      
      return Math.ceil(area / (scale * scale));
    }
  }
  
  return 1e7; // Default for unknown
}

/**
 * Create a batch export task to Google Drive
 * @param {object} image - Earth Engine image
 * @param {object} params - Export parameters
 * @returns {object} Task information
 */
function createDriveExportTask(image, params) {
  const ee = getEarthEngine();
  const {
    region,
    scale = 10,
    crs = 'EPSG:4326',
    bands = null,
    folder = 'EarthEngine',
    description = `export_${Date.now()}`,
    maxPixels = 1e10
  } = params;

  // Select bands if specified
  const exportImage = bands ? image.select(bands) : image;

  // Create the export task
  const task = ee.batch.Export.image.toDrive({
    image: exportImage,
    description: description,
    folder: folder,
    fileNamePrefix: description,
    region: region,
    scale: scale,
    crs: crs,
    maxPixels: maxPixels,
    fileFormat: 'GeoTIFF',
    formatOptions: {
      cloudOptimized: true  // Create Cloud-Optimized GeoTIFF (COG)
    }
  });

  return {
    task: task,
    description: description,
    folder: folder,
    message: 'Task created. Call task.start() to begin export to Google Drive.'
  };
}

module.exports = {
  generateExportUrls,
  estimatePixelCount,
  createDriveExportTask
};
