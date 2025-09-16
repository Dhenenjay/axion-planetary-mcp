/**
 * Optimized Tile Service Handler
 * Bypasses timeout issues with simplified approach
 */

import ee from '@google/earthengine';
import { compositeStore } from './earth_engine_process';
import { parseAoi } from '@/src/utils/geo';

/**
 * Simplified tile generation without optimizer timeouts
 */
export async function generateTilesOptimized(params: any) {
  const { 
    compositeKey,
    ndviKey,
    datasetId,
    startDate,
    endDate,
    region,
    visParams = {},
    simpleMode = true  // Use simplified mode by default
  } = params;
  
  let image;
  let defaultVis = {};
  
  try {
    // Priority 1: Use stored results
    if (ndviKey && compositeStore[ndviKey]) {
      image = compositeStore[ndviKey];
      defaultVis = {
        bands: ['NDVI'],
        min: -1,
        max: 1,
        palette: ['blue', 'white', 'green']
      };
    } else if (compositeKey && compositeStore[compositeKey]) {
      image = compositeStore[compositeKey];
      // Determine visualization based on expected dataset
      if (params.datasetId?.includes('COPERNICUS/S2') || !params.datasetId) {
        defaultVis = {
          bands: ['B4', 'B3', 'B2'],
          min: 0,
          max: 0.3
        };
      } else if (params.datasetId?.includes('LANDSAT')) {
        defaultVis = {
          bands: ['SR_B4', 'SR_B3', 'SR_B2'],
          min: 0,
          max: 3000
        };
      }
    } else if (datasetId && simpleMode) {
      // Simple mode: Just create a basic composite without complex processing
      const collection = new ee.ImageCollection(datasetId);
      
      // Basic filtering
      let filtered = collection;
      if (startDate && endDate) {
        filtered = filtered.filterDate(startDate, endDate);
      }
      
      if (region) {
        try {
          const geometry = await parseAoi(region);
          filtered = filtered.filterBounds(geometry);
        } catch {
          // Ignore region if parsing fails
        }
      }
      
      // Take first image or median of small sample
      const count = await new Promise((resolve) => {
        filtered.size().evaluate((result: any, error: any) => {
          if (error) resolve(5);
          else resolve(result);
        });
        // Timeout fallback
        setTimeout(() => resolve(5), 2000);
      });
      
      if (typeof count === 'number' && count > 0) {
        // Use first few images for speed
        image = filtered.limit(Math.min(count as number, 5)).median();
      } else {
        // Fallback to first image
        image = filtered.first();
      }
      
      // Apply simple scaling for known datasets
      if (datasetId.includes('COPERNICUS/S2')) {
        image = image.divide(10000).select(['B.*']);
        defaultVis = {
          bands: ['B4', 'B3', 'B2'],
          min: 0,
          max: 0.3
        };
      } else if (datasetId.includes('LANDSAT')) {
        defaultVis = {
          bands: ['SR_B4', 'SR_B3', 'SR_B2'],
          min: 0,
          max: 3000
        };
      } else if (datasetId.includes('MODIS')) {
        defaultVis = {
          bands: ['sur_refl_b01', 'sur_refl_b04', 'sur_refl_b03'],
          min: 0,
          max: 3000
        };
      }
      
      // Clip to region if specified
      if (region) {
        try {
          const geometry = await parseAoi(region);
          image = image.clip(geometry);
        } catch {
          // Continue without clipping
        }
      }
    } else {
      throw new Error('No valid image source for tile generation');
    }
    
    // Merge visualization parameters
    const finalVis = { ...defaultVis, ...visParams };
    
    // Generate map ID with timeout protection
    const mapIdPromise = new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Map ID generation timed out'));
      }, 15000); // 15 second timeout
      
      image.visualize(finalVis).getMapId((mapId: any, error: any) => {
        clearTimeout(timeout);
        if (error) {
          reject(error);
        } else {
          resolve(mapId);
        }
      });
    });
    
    const mapIdDict = await mapIdPromise;
    const mapId = (mapIdDict as any).mapid || (mapIdDict as any).token;
    
    if (!mapId) {
      throw new Error('Failed to generate map ID');
    }
    
    // Return successful tile service
    return {
      success: true,
      operation: 'tiles',
      mapId: mapId,
      tileUrl: `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapId}/tiles/{z}/{x}/{y}`,
      message: 'Tile service created successfully',
      visualization: finalVis,
      usage: 'Use the tileUrl in mapping libraries',
      example: {
        leaflet: `L.tileLayer('https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapId}/tiles/{z}/{x}/{y}').addTo(map)`,
        mapbox: `map.addSource('ee-tiles', { type: 'raster', tiles: ['https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapId}/tiles/{z}/{x}/{y}'], tileSize: 256 })`
      },
      metadata: {
        source: ndviKey ? 'NDVI' : compositeKey ? 'Composite' : 'Dataset',
        region: region || 'global',
        mode: simpleMode ? 'simple' : 'full'
      }
    };
    
  } catch (error: any) {
    // Provide detailed error information
    return {
      success: false,
      operation: 'tiles',
      error: error.message,
      message: 'Failed to create tile service',
      troubleshooting: {
        tips: [
          'Try using a compositeKey from a previously created composite',
          'Reduce the date range or region size',
          'Use simpleMode: true for faster processing',
          'Check if the dataset ID is valid'
        ],
        params: params
      }
    };
  }
}

/**
 * Quick tile generation for testing
 */
export async function quickTiles(datasetId: string, region: string) {
  return generateTilesOptimized({
    datasetId,
    region,
    simpleMode: true,
    startDate: '2024-01-01',
    endDate: '2024-01-15',
    visParams: {
      bands: datasetId.includes('S2') ? ['B4', 'B3', 'B2'] : ['SR_B4', 'SR_B3', 'SR_B2'],
      min: 0,
      max: datasetId.includes('S2') ? 0.3 : 3000
    }
  });
}
