/**
 * Ultra-fast Tile Service Implementation
 * Optimized for speed and reliability
 */

import ee from '@google/earthengine';
import { compositeStore } from './earth_engine_process';

// Cache for geometries to avoid repeated lookups
const geometryCache: Map<string, any> = new Map();

/**
 * Get or create simple geometry
 */
async function getSimpleGeometry(region: string | undefined) {
  if (!region) return null;
  
  // Check cache first
  if (geometryCache.has(region)) {
    return geometryCache.get(region);
  }
  
  // Create simple bounding boxes for common cities
  const cityBounds: Record<string, number[]> = {
    'San Francisco': [-122.5, 37.7, -122.3, 37.9],
    'Los Angeles': [-118.5, 33.9, -118.1, 34.2],
    'New York': [-74.1, 40.6, -73.9, 40.8],
    'Manhattan': [-74.02, 40.70, -73.93, 40.82],
    'Miami': [-80.3, 25.7, -80.1, 25.9],
    'Seattle': [-122.4, 47.5, -122.2, 47.7],
    'Denver': [-105.1, 39.6, -104.8, 39.8],
    'Phoenix': [-112.2, 33.3, -111.9, 33.6],
    'Boston': [-71.2, 42.3, -71.0, 42.4],
    'Chicago': [-87.8, 41.8, -87.6, 42.0],
    'Texas': [-106.6, 25.8, -93.5, 36.5],
    'California': [-124.4, 32.5, -114.1, 42.0]
  };
  
  // Use predefined bounds if available
  if (cityBounds[region]) {
    const [west, south, east, north] = cityBounds[region];
    const geometry = ee.Geometry.Rectangle([west, south, east, north]);
    geometryCache.set(region, geometry);
    return geometry;
  }
  
  // For unknown regions, create a small default box
  const geometry = ee.Geometry.Rectangle([-122.5, 37.5, -122.0, 38.0]);
  geometryCache.set(region, geometry);
  return geometry;
}

/**
 * Lightning-fast tile generation
 */
export async function generateTilesFast(params: any) {
  const { 
    compositeKey,
    ndviKey,
    indexKey,
    datasetId,
    startDate,
    endDate,
    region,
    visParams = {},
    ultraFast = true
  } = params;
  
  try {
    let image;
    let defaultVis = {};
    
    // Priority 1: Use stored results (fastest)
    if (ndviKey && compositeStore[ndviKey]) {
      image = compositeStore[ndviKey];
      defaultVis = {
        bands: ['NDVI'],
        min: -1,
        max: 1,
        palette: ['blue', 'white', 'green']
      };
    } else if (indexKey && compositeStore[indexKey]) {
      // Support other index keys
      image = compositeStore[indexKey];
      const indexType = indexKey.split('_')[0].toUpperCase();
      defaultVis = {
        bands: [indexType],
        min: -1,
        max: 1,
        palette: ['blue', 'white', 'green']
      };
    } else if (compositeKey && compositeStore[compositeKey]) {
      image = compositeStore[compositeKey];
      // Assume Sentinel-2 by default for composites
      defaultVis = {
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 0.3
      };
    } else if (datasetId && ultraFast) {
      // Ultra-fast mode: Use single image instead of composite
      const collection = new ee.ImageCollection(datasetId);
      
      // Minimal filtering for speed
      let filtered = collection;
      
      // Use short date range or defaults
      if (startDate && endDate) {
        filtered = filtered.filterDate(startDate, endDate);
      } else {
        // Default to a single recent month
        filtered = filtered.filterDate('2024-01-01', '2024-01-31');
      }
      
      // Simple geometry if region provided
      if (region) {
        const geometry = await getSimpleGeometry(region);
        if (geometry) {
          filtered = filtered.filterBounds(geometry);
        }
      }
      
      // Just take the first image for ultra-fast mode
      image = filtered.first();
      
      // Quick preprocessing based on dataset
      if (datasetId.includes('COPERNICUS/S2')) {
        // Simple scaling without cloud masking
        image = image.divide(10000).select(['B.*']).clip(
          region ? await getSimpleGeometry(region) : ee.Geometry.Rectangle([-180, -90, 180, 90])
        );
        defaultVis = {
          bands: visParams.bands || ['B4', 'B3', 'B2'],
          min: visParams.min ?? 0,
          max: visParams.max ?? 0.3
        };
      } else if (datasetId.includes('LANDSAT')) {
        image = image.select(['SR_B.*']).clip(
          region ? await getSimpleGeometry(region) : ee.Geometry.Rectangle([-180, -90, 180, 90])
        );
        defaultVis = {
          bands: visParams.bands || ['SR_B4', 'SR_B3', 'SR_B2'],
          min: visParams.min ?? 0,
          max: visParams.max ?? 3000
        };
      } else if (datasetId.includes('MODIS')) {
        defaultVis = {
          bands: visParams.bands || ['sur_refl_b01', 'sur_refl_b04', 'sur_refl_b03'],
          min: visParams.min ?? 0,
          max: visParams.max ?? 3000
        };
      } else {
        // Generic defaults
        defaultVis = {
          bands: visParams.bands || ['B1', 'B2', 'B3'],
          min: visParams.min ?? 0,
          max: visParams.max ?? 1
        };
      }
    } else {
      throw new Error('No valid image source for tiles');
    }
    
    // Merge visualization
    const finalVis = { ...defaultVis, ...visParams };
    
    // Fast map ID generation with shorter timeout
    const mapIdPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Map ID timeout'));
      }, 10000); // 10 second max
      
      try {
        image.visualize(finalVis).getMapId((mapId: any, error: any) => {
          clearTimeout(timeout);
          if (error) {
            reject(error);
          } else {
            resolve(mapId);
          }
        });
      } catch (err) {
        clearTimeout(timeout);
        reject(err);
      }
    });
    
    const mapIdDict = await mapIdPromise;
    const mapId = (mapIdDict as any).mapid || (mapIdDict as any).token;
    
    if (!mapId) {
      throw new Error('No map ID generated');
    }
    
    return {
      success: true,
      operation: 'tiles',
      mapId: mapId,
      tileUrl: `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapId}/tiles/{z}/{x}/{y}`,
      message: 'Tile service created (fast mode)',
      visualization: finalVis,
      metadata: {
        mode: 'ultrafast',
        source: compositeKey ? 'composite' : ndviKey ? 'ndvi' : indexKey ? 'index' : 'dataset',
        region: region || 'global'
      }
    };
    
  } catch (error: any) {
    console.error('Fast tiles error:', error);
    
    // Fallback to super simple tile
    try {
      // Use a known simple dataset
      const fallbackImage = new ee.Image('COPERNICUS/S2/20240101T000000_20240101T000000_T10SEG')
        .divide(10000)
        .select(['B4', 'B3', 'B2']);
      
      const fallbackVis = { min: 0, max: 0.3 };
      
      const mapId = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error('Timeout')), 5000);
        fallbackImage.visualize(fallbackVis).getMapId((id: any, err: any) => {
          clearTimeout(timeout);
          if (err) reject(err);
          else resolve(id);
        });
      });
      
      return {
        success: true,
        operation: 'tiles',
        mapId: (mapId as any).mapid,
        tileUrl: `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${(mapId as any).mapid}/tiles/{z}/{x}/{y}`,
        message: 'Tile service created (fallback mode)',
        warning: 'Using fallback imagery due to errors',
        originalError: error.message
      };
    } catch (fallbackError) {
      return {
        success: false,
        operation: 'tiles',
        error: error.message,
        fallbackError: (fallbackError as any).message,
        message: 'Failed to create tile service',
        suggestion: 'Try creating a composite first and using the compositeKey'
      };
    }
  }
}
