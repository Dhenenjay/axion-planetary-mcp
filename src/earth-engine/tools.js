const { getEarthEngine } = require('./init');
const { exportToDownload, exportToDrive } = require('./export');

/**
 * Search the Earth Engine data catalog
 * @param {string} query - Search query
 * @returns {Promise<object>} Search results
 */
async function searchCatalog(query) {
  const ee = getEarthEngine();
  
  // Common dataset mappings
  const datasets = {
    'sentinel-2': 'COPERNICUS/S2_SR_HARMONIZED',
    'landsat-8': 'LANDSAT/LC08/C02/T1_L2',
    'landsat-9': 'LANDSAT/LC09/C02/T1_L2',
    'modis': 'MODIS/006/MOD13Q1',
    'dem': 'USGS/SRTMGL1_003',
    'precipitation': 'UCSB-CHG/CHIRPS/DAILY',
    'temperature': 'MODIS/006/MOD11A1',
    'ndvi': 'MODIS/006/MOD13Q1'
  };
  
  const lowerQuery = query.toLowerCase();
  const results = [];
  
  for (const [key, id] of Object.entries(datasets)) {
    if (lowerQuery.includes(key) || key.includes(lowerQuery)) {
      results.push({
        id: id,
        name: key.charAt(0).toUpperCase() + key.slice(1).replace('-', ' '),
        description: `Earth Engine dataset: ${id}`
      });
    }
  }
  
  return {
    query: query,
    count: results.length,
    datasets: results
  };
}

/**
 * Get band names for a dataset
 * @param {string} datasetId - Dataset ID
 * @returns {Promise<object>} Band information
 */
async function getBandNames(datasetId) {
  const ee = getEarthEngine();
  
  return new Promise((resolve, reject) => {
    try {
      const collection = ee.ImageCollection(datasetId);
      const first = collection.first();
      
      first.bandNames().evaluate((bandNames, error) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            datasetId: datasetId,
            bands: bandNames,
            count: bandNames.length
          });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Filter collection by date and region
 * @param {object} params - Filter parameters
 * @returns {Promise<object>} Filtered collection info
 */
async function filterCollection(params) {
  const ee = getEarthEngine();
  const { datasetId, startDate, endDate, region } = params;
  
  return new Promise((resolve, reject) => {
    try {
      let collection = ee.ImageCollection(datasetId)
        .filterDate(startDate, endDate);
      
      if (region) {
        const geometry = region.type === 'Point' 
          ? ee.Geometry.Point(region.coordinates)
          : ee.Geometry.Polygon(region.coordinates);
        collection = collection.filterBounds(geometry);
      }
      
      collection.size().evaluate((size, error) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            datasetId: datasetId,
            startDate: startDate,
            endDate: endDate,
            imageCount: size,
            collectionId: collection.getInfo().id || `${datasetId}_filtered`
          });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Calculate NDVI
 * @param {object} params - NDVI parameters
 * @returns {Promise<object>} NDVI calculation result
 */
async function calculateNDVI(params) {
  const ee = getEarthEngine();
  const { imageId, redBand = 'B4', nirBand = 'B8' } = params;
  
  return new Promise((resolve, reject) => {
    try {
      let image;
      
      // Handle both image IDs and collection IDs
      if (imageId.includes('ImageCollection')) {
        const collection = ee.ImageCollection(imageId);
        image = collection.median();
      } else {
        image = ee.Image(imageId);
      }
      
      // Calculate NDVI
      const ndvi = image.normalizedDifference([nirBand, redBand]).rename('NDVI');
      
      // Get basic statistics
      const stats = ndvi.reduceRegion({
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.minMax(),
          sharedInputs: true
        }).combine({
          reducer2: ee.Reducer.stdDev(),
          sharedInputs: true
        }),
        scale: 30,
        maxPixels: 1e9
      });
      
      stats.evaluate((result, error) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            imageId: imageId,
            index: 'NDVI',
            bands: { red: redBand, nir: nirBand },
            statistics: result,
            resultId: `NDVI_${Date.now()}`
          });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Create a composite image from a collection
 * @param {object} params - Composite parameters
 * @returns {Promise<object>} Composite result
 */
async function createComposite(params) {
  const ee = getEarthEngine();
  const { 
    datasetId, 
    startDate, 
    endDate, 
    region, 
    method = 'median',
    cloudMask = true 
  } = params;
  
  return new Promise((resolve, reject) => {
    try {
      let collection = ee.ImageCollection(datasetId)
        .filterDate(startDate, endDate);
      
      if (region) {
        const geometry = region.type === 'Point' 
          ? ee.Geometry.Point(region.coordinates)
          : ee.Geometry.Polygon(region.coordinates);
        collection = collection.filterBounds(geometry);
      }
      
      // Apply cloud masking for Sentinel-2
      if (cloudMask && datasetId.includes('S2')) {
        collection = collection.map(function(image) {
          const qa = image.select('QA60');
          const cloudBitMask = 1 << 10;
          const cirrusBitMask = 1 << 11;
          const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
            .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
          return image.updateMask(mask).divide(10000)
            .select('B.*')
            .copyProperties(image, ['system:time_start']);
        });
      }
      
      // Create composite based on method
      let composite;
      switch(method) {
        case 'median':
          composite = collection.median();
          break;
        case 'mean':
          composite = collection.mean();
          break;
        case 'min':
          composite = collection.min();
          break;
        case 'max':
          composite = collection.max();
          break;
        case 'mosaic':
          composite = collection.mosaic();
          break;
        default:
          composite = collection.median();
      }
      
      // Get collection size
      collection.size().evaluate((size, error) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            datasetId: datasetId,
            method: method,
            startDate: startDate,
            endDate: endDate,
            imageCount: size,
            compositeId: `composite_${Date.now()}`,
            cloudMasked: cloudMask
          });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get visualization URL for an image
 * @param {object} params - Visualization parameters
 * @returns {Promise<object>} Map tile URL
 */
async function getMapUrl(params) {
  const ee = getEarthEngine();
  const { imageId, datasetId, startDate, endDate, region, visParams = {}, composite = false } = params;
  
  return new Promise((resolve, reject) => {
    try {
      let image;
      
      // Handle composite creation if requested
      if (composite && datasetId) {
        let collection = ee.ImageCollection(datasetId);
        
        if (startDate && endDate) {
          collection = collection.filterDate(startDate, endDate);
        }
        
        if (region) {
          const geometry = region.type === 'Point' 
            ? ee.Geometry.Point(region.coordinates)
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
        
      } else if (imageId && imageId.includes('ImageCollection')) {
        const collection = ee.ImageCollection(imageId);
        image = collection.median();
      } else if (imageId) {
        image = ee.Image(imageId);
      } else {
        throw new Error('Either imageId or datasetId must be provided');
      }
      
      // Default visualization parameters for Sentinel-2
      const defaultVis = datasetId && datasetId.includes('S2') ? {
        min: 0,
        max: 3000,
        bands: ['B4', 'B3', 'B2'],
        gamma: 1.4
      } : {
        min: 0,
        max: 3000,
        bands: ['B4', 'B3', 'B2']
      };
      
      const finalVis = { ...defaultVis, ...visParams };
      
      // For direct viewing, also generate a static thumbnail
      const thumbParams = {
        dimensions: '1024x768',
        format: 'png',
        ...finalVis
      };
      
      // Add region if specified
      if (region) {
        const geometry = region.type === 'Point' 
          ? ee.Geometry.Point(region.coordinates).buffer(50000) // 50km buffer
          : ee.Geometry.Polygon(region.coordinates);
        thumbParams.region = geometry;
      }
      
      // Get both map tiles and thumbnail
      image.getMap(finalVis, (mapId, error) => {
        if (error) {
          reject(error);
        } else {
          // Also get thumbnail URL for direct viewing
          const thumbnailUrl = image.getThumbURL(thumbParams);
          
          resolve({
            imageId: imageId || `${datasetId}_composite`,
            mapId: mapId.mapid,
            token: mapId.token,
            
            // Tile URLs for web mapping
            tileUrlTemplate: `https://earthengine.googleapis.com/v1alpha/${mapId.mapid}/tiles/{z}/{x}/{y}`,
            
            // Direct viewable image
            thumbnailUrl: thumbnailUrl,
            viewInBrowser: thumbnailUrl,
            
            visParams: finalVis,
            instructions: 'Use thumbnailUrl/viewInBrowser to see the image directly. Use tileUrlTemplate for web mapping applications.',
            
            // Example URLs
            exampleTileUrl: `https://earthengine.googleapis.com/v1alpha/${mapId.mapid}/tiles/8/41/99`,
            
            // For embedding in HTML
            htmlEmbed: `<img src="${thumbnailUrl}" alt="Earth Engine Image" style="max-width: 100%; height: auto;" />`
          });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Get a thumbnail image URL
 * @param {object} params - Thumbnail parameters
 * @returns {Promise<object>} Thumbnail URL
 */
async function getThumbnail(params) {
  const ee = getEarthEngine();
  const { 
    datasetId, 
    imageId,
    startDate, 
    endDate, 
    region, 
    dimensions = '512x512',
    format = 'png',
    visParams = {} 
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
            ? ee.Geometry.Point(region.coordinates).buffer(10000) // 10km buffer for point
            : ee.Geometry.Polygon(region.coordinates);
          collection = collection.filterBounds(geometry);
        }
        
      // Apply cloud masking for Sentinel-2
      if (datasetId && datasetId.includes('S2')) {
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
      } else if (imageId) {
        image = ee.Image(imageId);
      } else {
        throw new Error('Either imageId or datasetId must be provided');
      }
      
      // Set visualization parameters
      // Sentinel-2 values are in range 0-10000, scale appropriately
      const defaultVis = datasetId && datasetId.includes('S2') ? {
        min: 0,
        max: 3000,
        bands: ['B4', 'B3', 'B2'],
        gamma: 1.4
      } : {
        min: 0,
        max: 3000,
        bands: ['B4', 'B3', 'B2']
      };
      
      const finalVis = { ...defaultVis, ...visParams };
      
      // Prepare thumbnail parameters
      const thumbParams = {
        dimensions: dimensions,
        format: format,
        ...finalVis
      };
      
      // Add region if specified
      if (region) {
        const geometry = region.type === 'Point' 
          ? ee.Geometry.Point(region.coordinates).buffer(10000)
          : ee.Geometry.Polygon(region.coordinates);
        thumbParams.region = geometry;
      }
      
      // Get thumbnail URL
      const thumbnailUrl = image.getThumbURL(thumbParams);
      
      resolve({
        thumbnailUrl: thumbnailUrl,
        dimensions: dimensions,
        format: format,
        visParams: finalVis,
        description: 'Direct link to view the image. Open this URL in a browser to see the thumbnail.',
        datasetId: datasetId || imageId
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Calculate summary statistics for an image
 * @param {object} params - Statistics parameters
 * @returns {Promise<object>} Statistics result
 */
async function calculateStatistics(params) {
  const ee = getEarthEngine();
  const { imageId, region, scale = 30 } = params;
  
  return new Promise((resolve, reject) => {
    try {
      let image;
      
      if (imageId.includes('ImageCollection')) {
        const collection = ee.ImageCollection(imageId);
        image = collection.median();
      } else {
        image = ee.Image(imageId);
      }
      
      let geometry;
      if (region) {
        geometry = region.type === 'Point'
          ? ee.Geometry.Point(region.coordinates)
          : ee.Geometry.Polygon(region.coordinates);
      }
      
      const stats = image.reduceRegion({
        reducer: ee.Reducer.mean().combine({
          reducer2: ee.Reducer.minMax(),
          sharedInputs: true
        }).combine({
          reducer2: ee.Reducer.stdDev(),
          sharedInputs: true
        }).combine({
          reducer2: ee.Reducer.count(),
          sharedInputs: true
        }),
        geometry: geometry,
        scale: scale,
        maxPixels: 1e9
      });
      
      stats.evaluate((result, error) => {
        if (error) {
          reject(error);
        } else {
          resolve({
            imageId: imageId,
            statistics: result,
            scale: scale,
            region: region
          });
        }
      });
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  searchCatalog,
  getBandNames,
  filterCollection,
  calculateNDVI,
  createComposite,
  getMapUrl,
  getThumbnail,
  calculateStatistics,
  exportToDownload,
  exportToDrive
};
