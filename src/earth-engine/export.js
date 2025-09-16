const { getEarthEngine } = require('./init');

/**
 * Export image as GeoTIFF with download link
 * @param {object} params - Export parameters
 * @returns {Promise<object>} Download URL for GeoTIFF
 */
async function exportToDownload(params) {
  const ee = getEarthEngine();
  const { 
    datasetId,
    imageId,
    startDate, 
    endDate, 
    region,
    scale = 10, // 10m for Sentinel-2
    crs = 'EPSG:4326',
    format = 'GeoTIFF',
    fileName = `earth_engine_export_${Date.now()}`,
    bands = null,
    maxPixels = 1e8
  } = params;
  
  return new Promise((resolve, reject) => {
    try {
      let image;
      
      // Create composite if dataset info provided
      if (datasetId && startDate && endDate) {
        let collection = ee.ImageCollection(datasetId)
          .filterDate(startDate, endDate);
        
        if (region) {
          const geometry = region.type === 'Point' 
            ? ee.Geometry.Point(region.coordinates).buffer(5000) // 5km buffer for points
            : ee.Geometry.Polygon(region.coordinates);
          collection = collection.filterBounds(geometry);
        }
        
        // Apply cloud masking for Sentinel-2
        if (datasetId.includes('S2')) {
          collection = collection.map(function(image) {
            const qa = image.select('QA60');
            const cloudBitMask = 1 << 10;
            const cirrusBitMask = 1 << 11;
            const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
              .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
            return image.updateMask(mask)
              .select('B.*')
              .copyProperties(image, ['system:time_start']);
          });
        }
        
        // Create median composite
        image = collection.median();
        
        // Select specific bands if requested
        if (bands && bands.length > 0) {
          image = image.select(bands);
        }
        
      } else if (imageId) {
        image = ee.Image(imageId);
        if (bands && bands.length > 0) {
          image = image.select(bands);
        }
      } else {
        throw new Error('Either imageId or datasetId must be provided');
      }
      
      // Define export region
      let exportRegion;
      if (region) {
        exportRegion = region.type === 'Point' 
          ? ee.Geometry.Point(region.coordinates).buffer(5000)
          : ee.Geometry.Polygon(region.coordinates);
      } else {
        // Use image footprint
        exportRegion = image.geometry();
      }
      
      // Get band names if not specified
      let exportBands = bands;
      if (!exportBands) {
        // Get actual band names from the image
        const bandNames = image.bandNames();
        exportBands = bandNames.getInfo();
      }
      
      // Get download URL for full-resolution GeoTIFF
      // This creates a proper download link for the full image
      const downloadUrl = image.select(exportBands).getDownloadURL({
        name: fileName,
        region: exportRegion,
        scale: scale,
        crs: crs,
        crsTransform: null,
        format: format,
        maxPixels: maxPixels,
        filePerBand: false  // Single multi-band GeoTIFF file
      });
      
      // Generate preview with proper band selection for visualization
      let previewImage;
      if (exportBands.length >= 3) {
        // Use first 3 bands for RGB preview
        previewImage = image.select(exportBands.slice(0, 3));
      } else if (exportBands.length === 2) {
        // For 2 bands, create RGB visualization
        // Use band1 for red, band2 for green, 0 for blue
        const band1 = image.select([exportBands[0]]).rename('vis_red');
        const band2 = image.select([exportBands[1]]).rename('vis_green');
        const zeros = ee.Image(0).rename('vis_blue');
        previewImage = ee.Image.cat([band1, band2, zeros]);
      } else {
        // Single band - make grayscale
        const band = image.select([exportBands[0]]).rename('vis_band');
        previewImage = ee.Image.cat([band, band, band]);
      }
      
      const previewUrl = previewImage.getThumbURL({
        dimensions: '512x512',
        region: exportRegion,
        format: 'png',
        min: 0,
        max: 3000
      });
      
      // Calculate approximate file size
      const pixelCount = Math.ceil((Math.PI * 5000 * 5000) / (scale * scale)); // For 5km buffer
      const bytesPerPixel = 4 * exportBands.length; // 4 bytes per band (float32)
      const approximateSizeMB = Math.round((pixelCount * bytesPerPixel) / (1024 * 1024));
      
      resolve({
        // Full resolution GeoTIFF download
        download: {
          url: downloadUrl,
          format: 'GeoTIFF',
          description: 'Full resolution GeoTIFF file for GIS import',
          fileName: `${fileName}.tif`,
          approximateSizeMB: approximateSizeMB
        },
        // Quick preview thumbnail
        thumbnail: {
          url: previewUrl,
          format: 'PNG',
          description: 'Quick preview thumbnail (512x512 PNG)',
          dimensions: '512x512'
        },
        // Export metadata
        metadata: {
          bands: exportBands,
          bandCount: exportBands.length,
          scale: scale,
          crs: crs,
          resolution: `${scale} meters per pixel`,
          maxPixels: maxPixels
        },
        // Usage instructions
        instructions: {
          thumbnail: 'Open thumbnail.url in browser for quick preview',
          download: 'Open download.url to download full GeoTIFF (may take time for large areas)',
          gis: 'The downloaded GeoTIFF can be imported into ArcGIS, QGIS, or other GIS software'
        }
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Export to Google Drive (requires authentication)
 * @param {object} params - Export parameters
 * @returns {Promise<object>} Export task info
 */
async function exportToDrive(params) {
  const ee = getEarthEngine();
  const { 
    datasetId,
    imageId,
    startDate, 
    endDate, 
    region,
    scale = 10,
    folder = 'EarthEngine',
    fileName = `export_${Date.now()}`,
    bands = null,
    maxPixels = 1e9
  } = params;
  
  return new Promise((resolve, reject) => {
    try {
      let image;
      
      // Create composite if dataset info provided
      if (datasetId && startDate && endDate) {
        let collection = ee.ImageCollection(datasetId)
          .filterDate(startDate, endDate);
        
        if (region) {
          const geometry = region.type === 'Point' 
            ? ee.Geometry.Point(region.coordinates).buffer(5000)
            : ee.Geometry.Polygon(region.coordinates);
          collection = collection.filterBounds(geometry);
        }
        
        // Apply cloud masking for Sentinel-2
        if (datasetId.includes('S2')) {
          collection = collection.map(function(image) {
            const qa = image.select('QA60');
            const cloudBitMask = 1 << 10;
            const cirrusBitMask = 1 << 11;
            const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
              .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
            return image.updateMask(mask)
              .select('B.*')
              .copyProperties(image, ['system:time_start']);
          });
        }
        
        image = collection.median();
        
        if (bands && bands.length > 0) {
          image = image.select(bands);
        }
        
      } else if (imageId) {
        image = ee.Image(imageId);
        if (bands && bands.length > 0) {
          image = image.select(bands);
        }
      } else {
        throw new Error('Either imageId or datasetId must be provided');
      }
      
      // Define export region
      let exportRegion;
      if (region) {
        exportRegion = region.type === 'Point' 
          ? ee.Geometry.Point(region.coordinates).buffer(5000)
          : ee.Geometry.Polygon(region.coordinates);
      } else {
        exportRegion = image.geometry();
      }
      
      // Create export task
      const task = ee.batch.Export.image.toDrive({
        image: image,
        description: fileName,
        folder: folder,
        fileNamePrefix: fileName,
        region: exportRegion,
        scale: scale,
        maxPixels: maxPixels,
        fileFormat: 'GeoTIFF'
      });
      
      // Start the task
      task.start();
      
      resolve({
        taskId: task.id,
        status: 'RUNNING',
        fileName: `${fileName}.tif`,
        folder: folder,
        scale: scale,
        description: 'Export task started. Check Google Drive for the file once complete.',
        instructions: 'The file will appear in your Google Drive in the specified folder when ready.'
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  exportToDownload,
  exportToDrive
};
