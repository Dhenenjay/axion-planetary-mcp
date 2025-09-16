const { getEarthEngine } = require('./init');

/**
 * Calculate NDVI and create visualization with color palette
 * @param {object} params - NDVI parameters
 * @returns {Promise<object>} NDVI results with visualization
 */
async function calculateNDVI(params) {
  const ee = getEarthEngine();
  const { 
    datasetId = 'COPERNICUS/S2_SR_HARMONIZED',
    region,
    startDate,
    endDate,
    visualization = true,
    exportHtml = false
  } = params;
  
  return new Promise((resolve, reject) => {
    try {
      // Parse region
      let geometry;
      if (typeof region === 'string') {
        // Convert place name to geometry using gazetteers
        geometry = getPlaceGeometry(region);
      } else if (region && region.type) {
        geometry = region.type === 'Point' 
          ? ee.Geometry.Point(region.coordinates).buffer(10000)
          : ee.Geometry.Polygon(region.coordinates);
      } else {
        // Default to Los Angeles if no region specified
        geometry = ee.Geometry.Polygon([[
          [-118.9, 33.7],
          [-118.9, 34.8],
          [-117.6, 34.8],
          [-117.6, 33.7],
          [-118.9, 33.7]
        ]]);
      }
      
      // Get image collection
      let collection = ee.ImageCollection(datasetId)
        .filterDate(startDate, endDate)
        .filterBounds(geometry);
      
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
      const composite = collection.median().clip(geometry);
      
      // Calculate NDVI
      const nir = composite.select('B8');
      const red = composite.select('B4');
      const ndvi = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
      
      // NDVI color palette (red to green)
      const ndviPalette = [
        'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
        '74A901', '66A000', '529400', '3E8601', '207401', '056201',
        '004C00', '023B01', '012E01', '011D01', '011301'
      ];
      
      // Visualization parameters
      const visParams = {
        min: -0.2,
        max: 0.8,
        palette: ndviPalette
      };
      
      // Apply visualization to create a properly colored RGB image
      const ndviVisualized = ndvi.visualize(visParams);
      
      // Get thumbnail URL with color palette
      const thumbnailUrl = ndviVisualized.getThumbURL({
        dimensions: '1024x1024',
        region: geometry,
        format: 'png'
      });
      
      // Calculate NDVI statistics
      const stats = ndvi.reduceRegion({
        reducer: ee.Reducer.mean()
          .combine(ee.Reducer.min(), '', true)
          .combine(ee.Reducer.max(), '', true)
          .combine(ee.Reducer.stdDev(), '', true),
        geometry: geometry,
        scale: 30,
        maxPixels: 1e9
      });
      
      // Get the statistics
      stats.evaluate((statsResult, error) => {
        if (error) {
          reject(error);
          return;
        }
        
        // Create HTML visualization if requested
        let htmlVisualization = null;
        if (exportHtml) {
          htmlVisualization = createNDVIHtmlMap(thumbnailUrl, statsResult, region, visParams);
        }
        
        // Get map tiles for interactive viewing
        ndvi.getMap(visParams, (mapId, mapError) => {
          if (mapError) {
            reject(mapError);
            return;
          }
          
          const result = {
            success: true,
            ndvi: {
              calculated: true,
              dataset: datasetId,
              dateRange: `${startDate} to ${endDate}`,
              region: typeof region === 'string' ? region : 'Custom area'
            },
            statistics: {
              mean: statsResult['NDVI_mean'] ? statsResult['NDVI_mean'].toFixed(4) : 'N/A',
              min: statsResult['NDVI_min'] ? statsResult['NDVI_min'].toFixed(4) : 'N/A',
              max: statsResult['NDVI_max'] ? statsResult['NDVI_max'].toFixed(4) : 'N/A',
              stdDev: statsResult['NDVI_stdDev'] ? statsResult['NDVI_stdDev'].toFixed(4) : 'N/A'
            },
            visualization: {
              thumbnailUrl: thumbnailUrl,
              colorPalette: ndviPalette,
              description: 'NDVI visualization with color gradient from red (low/no vegetation) to dark green (dense vegetation)',
              legendValues: {
                '-0.2': 'Water/No vegetation',
                '0.0': 'Bare soil',
                '0.2': 'Sparse vegetation',
                '0.4': 'Moderate vegetation',
                '0.6': 'Dense vegetation',
                '0.8': 'Very dense vegetation'
              }
            },
            interactiveMap: {
              tilesUrl: `https://earthengine.googleapis.com/v1alpha/${mapId.mapid}/tiles/{z}/{x}/{y}`,
              mapId: mapId.mapid,
              token: mapId.token
            },
            htmlArtifact: htmlVisualization,
            instructions: {
              viewThumbnail: 'Open visualization.thumbnailUrl in a browser to see the NDVI map with color palette',
              viewInteractive: 'Use interactiveMap.tilesUrl in a web mapping library for interactive viewing',
              interpretation: 'Green areas indicate healthy vegetation, yellow/orange indicate sparse vegetation or stressed plants, red/brown indicate bare soil or no vegetation'
            }
          };
          
          resolve(result);
        });
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Create an HTML map artifact for NDVI visualization
 */
function createNDVIHtmlMap(thumbnailUrl, stats, region, visParams) {
  const html = `
<!DOCTYPE html>
<html>
<head>
    <title>NDVI Map - ${region}</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2e7d32;
            margin-bottom: 10px;
        }
        .map-container {
            position: relative;
            margin: 20px 0;
        }
        .map-image {
            width: 100%;
            max-width: 100%;
            height: auto;
            border: 2px solid #e0e0e0;
            border-radius: 4px;
        }
        .legend {
            display: flex;
            justify-content: space-between;
            margin: 20px 0;
            padding: 15px;
            background: #f9f9f9;
            border-radius: 4px;
        }
        .legend-item {
            display: flex;
            align-items: center;
        }
        .color-box {
            width: 30px;
            height: 20px;
            margin-right: 8px;
            border: 1px solid #ddd;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 15px;
            margin: 20px 0;
        }
        .stat-card {
            padding: 15px;
            background: #f0f4f8;
            border-radius: 4px;
            border-left: 4px solid #4caf50;
        }
        .stat-label {
            font-size: 12px;
            color: #666;
            text-transform: uppercase;
            margin-bottom: 5px;
        }
        .stat-value {
            font-size: 24px;
            font-weight: bold;
            color: #2e7d32;
        }
        .interpretation {
            margin: 20px 0;
            padding: 15px;
            background: #e8f5e9;
            border-radius: 4px;
            border-left: 4px solid #4caf50;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>NDVI Analysis - ${typeof region === 'string' ? region : 'Study Area'}</h1>
        <p>Normalized Difference Vegetation Index (NDVI) showing vegetation health and density</p>
        
        <div class="map-container">
            <img src="${thumbnailUrl}" alt="NDVI Map" class="map-image">
        </div>
        
        <div class="legend">
            <div class="legend-item">
                <div class="color-box" style="background: #CE7E45;"></div>
                <span>No Vegetation (-0.2)</span>
            </div>
            <div class="legend-item">
                <div class="color-box" style="background: #F1B555;"></div>
                <span>Bare Soil (0.0)</span>
            </div>
            <div class="legend-item">
                <div class="color-box" style="background: #99B718;"></div>
                <span>Sparse (0.2)</span>
            </div>
            <div class="legend-item">
                <div class="color-box" style="background: #66A000;"></div>
                <span>Moderate (0.4)</span>
            </div>
            <div class="legend-item">
                <div class="color-box" style="background: #207401;"></div>
                <span>Dense (0.6)</span>
            </div>
            <div class="legend-item">
                <div class="color-box" style="background: #004C00;"></div>
                <span>Very Dense (0.8)</span>
            </div>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-label">Mean NDVI</div>
                <div class="stat-value">${stats['NDVI_mean'] ? stats['NDVI_mean'].toFixed(3) : 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Minimum</div>
                <div class="stat-value">${stats['NDVI_min'] ? stats['NDVI_min'].toFixed(3) : 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Maximum</div>
                <div class="stat-value">${stats['NDVI_max'] ? stats['NDVI_max'].toFixed(3) : 'N/A'}</div>
            </div>
            <div class="stat-card">
                <div class="stat-label">Std Dev</div>
                <div class="stat-value">${stats['NDVI_stdDev'] ? stats['NDVI_stdDev'].toFixed(3) : 'N/A'}</div>
            </div>
        </div>
        
        <div class="interpretation">
            <h3>Interpretation Guide</h3>
            <ul>
                <li><strong>Dark Green Areas:</strong> Healthy, dense vegetation (forests, healthy crops)</li>
                <li><strong>Light Green:</strong> Moderate vegetation (grasslands, young crops)</li>
                <li><strong>Yellow/Orange:</strong> Sparse vegetation or stressed plants</li>
                <li><strong>Red/Brown:</strong> Bare soil, urban areas, or water bodies</li>
            </ul>
            <p><strong>Analysis:</strong> ${getInterpretation(stats['NDVI_mean'])}</p>
        </div>
        
        <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; color: #666; font-size: 12px;">
            Generated on ${new Date().toLocaleString()} | Data source: ${visParams.dataset || 'Sentinel-2'}
        </div>
    </div>
</body>
</html>
  `;
  
  return html;
}

/**
 * Get interpretation based on mean NDVI
 */
function getInterpretation(meanNDVI) {
  if (!meanNDVI) return 'Unable to calculate statistics for this area.';
  
  if (meanNDVI < 0.1) {
    return 'The area shows very low vegetation coverage, primarily consisting of bare soil, water, or urban development.';
  } else if (meanNDVI < 0.3) {
    return 'The area has sparse vegetation coverage, possibly indicating arid conditions, early growing season, or stressed vegetation.';
  } else if (meanNDVI < 0.5) {
    return 'The area shows moderate vegetation health, typical of grasslands, shrublands, or agricultural areas.';
  } else if (meanNDVI < 0.7) {
    return 'The area has healthy vegetation coverage, indicating good growing conditions and dense plant cover.';
  } else {
    return 'The area shows very dense, healthy vegetation typical of forests or peak growing season crops.';
  }
}

/**
 * Get place geometry from name
 */
function getPlaceGeometry(placeName) {
  const ee = getEarthEngine();
  
  // Common place boundaries
  const places = {
    'los angeles': [[-118.9, 33.7], [-118.9, 34.8], [-117.6, 34.8], [-117.6, 33.7], [-118.9, 33.7]],
    'san francisco': [[-122.5, 37.7], [-122.5, 37.85], [-122.35, 37.85], [-122.35, 37.7], [-122.5, 37.7]],
    'new york': [[-74.3, 40.5], [-74.3, 40.9], [-73.7, 40.9], [-73.7, 40.5], [-74.3, 40.5]],
    'chicago': [[-87.9, 41.6], [-87.9, 42.0], [-87.5, 42.0], [-87.5, 41.6], [-87.9, 41.6]],
    'miami': [[-80.5, 25.6], [-80.5, 25.9], [-80.1, 25.9], [-80.1, 25.6], [-80.5, 25.6]]
  };
  
  const normalizedName = placeName.toLowerCase().replace('county', '').trim();
  
  if (places[normalizedName]) {
    return ee.Geometry.Polygon([places[normalizedName]]);
  }
  
  // Default to point with buffer if place not found
  return ee.Geometry.Point([-118.2437, 34.0522]).buffer(50000); // LA center with 50km buffer
}

/**
 * Process and visualize any Earth Engine operation
 */
async function processEarthEngineOperation(params) {
  const ee = getEarthEngine();
  const { operation, ...operationParams } = params;
  
  switch (operation) {
    case 'ndvi':
      return await calculateNDVI(operationParams);
      
    case 'ndwi':
      return await calculateNDWI(operationParams);
      
    case 'composite':
      return await createComposite(operationParams);
      
    case 'classification':
      return await performClassification(operationParams);
      
    case 'change_detection':
      return await detectChanges(operationParams);
      
    case 'terrain':
      return await analyzeTerain(operationParams);
      
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

/**
 * Calculate NDWI (Normalized Difference Water Index)
 */
async function calculateNDWI(params) {
  const ee = getEarthEngine();
  const { datasetId = 'COPERNICUS/S2_SR_HARMONIZED', region, startDate, endDate } = params;
  
  return new Promise((resolve, reject) => {
    try {
      // Similar to NDVI but using Green and NIR bands
      let geometry = getGeometry(region);
      
      let collection = ee.ImageCollection(datasetId)
        .filterDate(startDate, endDate)
        .filterBounds(geometry);
      
      // Cloud masking
      collection = applyCloudMask(collection, datasetId);
      
      const composite = collection.median().clip(geometry);
      
      // Calculate NDWI = (Green - NIR) / (Green + NIR)
      const green = composite.select('B3');
      const nir = composite.select('B8');
      const ndwi = green.subtract(nir).divide(green.add(nir)).rename('NDWI');
      
      // Water palette (brown to blue)
      const ndwiPalette = ['0000ff', '00ffff', '00ff00', 'ffff00', 'ff0000'];
      
      const visParams = {
        min: -1,
        max: 1,
        palette: ndwiPalette
      };
      
      // Apply visualization to create a properly colored RGB image
      const ndwiVisualized = ndwi.visualize(visParams);
      
      const thumbnailUrl = ndwiVisualized.getThumbURL({
        dimensions: '1024x1024',
        region: geometry,
        format: 'png'
      });
      
      resolve({
        success: true,
        type: 'NDWI',
        thumbnailUrl: thumbnailUrl,
        visualization: {
          colorPalette: ndwiPalette,
          description: 'NDWI showing water bodies in blue and land in brown/red'
        }
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Helper function to get geometry from various inputs
 */
function getGeometry(region) {
  const ee = getEarthEngine();
  
  if (typeof region === 'string') {
    return getPlaceGeometry(region);
  } else if (region && region.type) {
    return region.type === 'Point' 
      ? ee.Geometry.Point(region.coordinates).buffer(10000)
      : ee.Geometry.Polygon(region.coordinates);
  } else {
    // Default to LA
    return ee.Geometry.Polygon([[
      [-118.9, 33.7],
      [-118.9, 34.8],
      [-117.6, 34.8],
      [-117.6, 33.7],
      [-118.9, 33.7]
    ]]);
  }
}

/**
 * Apply cloud masking based on dataset
 */
function applyCloudMask(collection, datasetId) {
  const ee = getEarthEngine();
  
  if (datasetId.includes('S2')) {
    // Sentinel-2 cloud masking
    return collection.map(function(image) {
      const qa = image.select('QA60');
      const cloudBitMask = 1 << 10;
      const cirrusBitMask = 1 << 11;
      const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
        .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
      return image.updateMask(mask)
        .select('B.*')
        .copyProperties(image, ['system:time_start']);
    });
  } else if (datasetId.includes('LANDSAT')) {
    // Landsat cloud masking
    return collection.map(function(image) {
      const qa = image.select('QA_PIXEL');
      const cloudBitMask = 1 << 3;
      const mask = qa.bitwiseAnd(cloudBitMask).eq(0);
      return image.updateMask(mask);
    });
  }
  
  return collection;
}

/**
 * Create a composite image
 */
async function createComposite(params) {
  const ee = getEarthEngine();
  const { 
    datasetId = 'COPERNICUS/S2_SR_HARMONIZED',
    region,
    startDate,
    endDate,
    method = 'median',
    cloudMask = true,
    visualization = true
  } = params;
  
  return new Promise((resolve, reject) => {
    try {
      let geometry = getGeometry(region);
      
      let collection = ee.ImageCollection(datasetId)
        .filterDate(startDate, endDate)
        .filterBounds(geometry);
      
      if (cloudMask) {
        collection = applyCloudMask(collection, datasetId);
      }
      
      // Create composite based on method
      let composite;
      switch (method) {
        case 'median':
          composite = collection.median();
          break;
        case 'mean':
          composite = collection.mean();
          break;
        case 'max':
          composite = collection.max();
          break;
        case 'min':
          composite = collection.min();
          break;
        case 'mosaic':
          composite = collection.mosaic();
          break;
        default:
          composite = collection.median();
      }
      
      composite = composite.clip(geometry);
      
      // Get visualization with proper parameters for Sentinel-2
      let visParams;
      
      if (datasetId.includes('S2')) {
        // Sentinel-2 specific visualization (True Color RGB)
        visParams = {
          bands: ['B4', 'B3', 'B2'],  // Red, Green, Blue
          min: 0,
          max: 2500,  // Adjusted for better contrast
          gamma: 1.2
        };
      } else if (datasetId.includes('LANDSAT/LC08')) {
        // Landsat 8 visualization
        visParams = {
          bands: ['B4', 'B3', 'B2'],  // Red, Green, Blue
          min: 0,
          max: 3000,
          gamma: 1.4
        };
      } else if (datasetId.includes('LANDSAT/LC09')) {
        // Landsat 9 visualization
        visParams = {
          bands: ['B4', 'B3', 'B2'],  // Red, Green, Blue
          min: 0,
          max: 3000,
          gamma: 1.4
        };
      } else {
        // Default visualization
        visParams = {
          bands: ['B4', 'B3', 'B2'],
          min: 0,
          max: 3000,
          gamma: 1.4
        };
      }
      
      // Apply visualization to create an RGB image
      const visualized = composite.visualize(visParams);
      
      const thumbnailUrl = visualized.getThumbURL({
        dimensions: '1024x1024',
        region: geometry,
        format: 'png'
      });
      
      resolve({
        success: true,
        type: 'composite',
        method: method,
        thumbnailUrl: thumbnailUrl,
        dateRange: `${startDate} to ${endDate}`,
        description: `${method} composite created successfully`
      });
      
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  calculateNDVI,
  calculateNDWI,
  createComposite,
  processEarthEngineOperation,
  createNDVIHtmlMap,
  getPlaceGeometry,
  getGeometry,
  applyCloudMask
};
