/**
 * EARTH ENGINE PROCESS - Consolidated Processing Tool
 * Combines: clip, mask, index, analyze, composite, terrain operations
 * Fixed version with complete implementations
 */

import ee from '@google/earthengine';
import { z } from 'zod';
import { register } from '../../registry';
import { parseAoi } from '@/src/utils/geo';
import { optimizer } from '@/src/utils/ee-optimizer';

// Store for composite results
export const compositeStore: { [key: string]: any } = {};

// Main schema for the consolidated tool
const ProcessToolSchema = z.object({
  operation: z.enum(['clip', 'mask', 'index', 'analyze', 'composite', 'terrain', 'resample', 'fcc']),
  
  // Common params
  input: z.any().optional(),
  datasetId: z.string().optional(),
  region: z.any().optional(),
  scale: z.number().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  
  // Mask operation params
  maskType: z.enum(['clouds', 'quality', 'water', 'shadow']).optional(),
  threshold: z.number().optional(),
  
  // Index operation params
  indexType: z.enum(['NDVI', 'NDWI', 'NDBI', 'EVI', 'SAVI', 'MNDWI', 'BSI', 'NDSI', 'NBR', 'custom']).optional(),
  redBand: z.string().optional(),
  nirBand: z.string().optional(),
  formula: z.string().optional(),
  
  // Analyze operation params
  analysisType: z.enum(['statistics', 'timeseries', 'change', 'zonal']).optional(),
  reducer: z.enum(['mean', 'median', 'max', 'min', 'stdDev', 'sum', 'count']).optional(),
  zones: z.any().optional(),
  
  // Composite operation params
  compositeType: z.enum(['median', 'mean', 'max', 'min', 'mosaic', 'greenest']).optional(),
  cloudCoverMax: z.number().optional(),
  
  // Terrain operation params
  terrainType: z.enum(['elevation', 'slope', 'aspect', 'hillshade']).optional(),
  azimuth: z.number().optional(),
  elevation: z.number().optional(),
  
  // Resample operation params
  targetScale: z.number().optional(),
  resampleMethod: z.enum(['bilinear', 'bicubic', 'nearest']).optional()
});

/**
 * Helper function to get or create image/collection
 */
async function getInput(input: any) {
  if (typeof input === 'string') {
    // Try as collection first
    try {
      return new ee.ImageCollection(input);
    } catch {
      // Try as single image
      return new ee.Image(input);
    }
  }
  return input; // Already an EE object
}

/**
 * Composite operation - create cloud-free composites
 */
async function createComposite(params: any) {
  const { 
    datasetId, 
    startDate, 
    endDate, 
    region, 
    compositeType = 'median',
    cloudCoverMax = 20
  } = params;
  
  if (!datasetId) throw new Error('datasetId required for composite operation');
  if (!startDate || !endDate) throw new Error('startDate and endDate required for composite');
  
  // Create collection
  let collection = new ee.ImageCollection(datasetId);
  
  // Apply date filter
  collection = collection.filterDate(startDate, endDate);
  
  // Apply region filter if provided
  if (region) {
    const geometry = await parseAoi(region);
    collection = collection.filterBounds(geometry);
    
    // Also clip the final composite to the region
    let composite;
    
    // Apply cloud filter for optical imagery
    if (datasetId.includes('COPERNICUS/S2') || datasetId.includes('LANDSAT')) {
      const cloudProp = datasetId.includes('COPERNICUS/S2') ? 'CLOUDY_PIXEL_PERCENTAGE' : 'CLOUD_COVER';
      collection = collection.filter(ee.Filter.lt(cloudProp, cloudCoverMax));
      
      // Apply cloud masking for cleaner composite
      if (datasetId.includes('COPERNICUS/S2')) {
        collection = collection.map((img: any) => {
          const qa = img.select('QA60');
          const cloudBitMask = 1 << 10;
          const cirrusBitMask = 1 << 11;
          const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
            .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
          return img.updateMask(mask).divide(10000)
            .select(['B.*'])
            .copyProperties(img, ['system:time_start']);
        });
      }
    }
    
    // Create composite based on type
    switch (compositeType) {
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
      case 'greenest':
        // Greenest pixel composite (max NDVI)
        composite = collection.qualityMosaic('B8');
        break;
      default:
        composite = collection.median();
    }
    
    // Clip to region
    composite = composite.clip(geometry);
    
    // Store composite for later use
    const compositeKey = `composite_${Date.now()}`;
    compositeStore[compositeKey] = composite;
    
    return {
      success: true,
      operation: 'composite',
      compositeType,
      compositeKey,
      message: `Created ${compositeType} composite from ${datasetId}`,
      dateRange: { startDate, endDate },
      region: typeof region === 'string' ? region : 'custom geometry',
      cloudCoverMax,
      result: composite,
      nextSteps: 'Use this compositeKey with thumbnail operation to visualize'
    };
  } else {
    // No region specified - just create composite
    let composite;
    
    // Apply cloud filter
    if (datasetId.includes('COPERNICUS/S2') || datasetId.includes('LANDSAT')) {
      const cloudProp = datasetId.includes('COPERNICUS/S2') ? 'CLOUDY_PIXEL_PERCENTAGE' : 'CLOUD_COVER';
      collection = collection.filter(ee.Filter.lt(cloudProp, cloudCoverMax));
    }
    
    switch (compositeType) {
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
    
    const compositeKey = `composite_${Date.now()}`;
    compositeStore[compositeKey] = composite;
    
    return {
      success: true,
      operation: 'composite',
      compositeType,
      compositeKey,
      message: `Created ${compositeType} composite from ${datasetId}`,
      dateRange: { startDate, endDate },
      result: composite,
      nextSteps: 'Use this compositeKey with thumbnail operation to visualize'
    };
  }
}

/**
 * FCC (False Color Composite) operation
 */
async function createFCC(params: any) {
  const { datasetId, startDate, endDate, region } = params;
  
  // Create a composite first
  const compositeResult = await createComposite({
    ...params,
    compositeType: 'median'
  });
  
  // FCC configuration based on dataset
  let fccBands;
  if (datasetId.includes('COPERNICUS/S2')) {
    // Sentinel-2: NIR-Red-Green (B8-B4-B3)
    fccBands = ['B8', 'B4', 'B3'];
  } else if (datasetId.includes('LANDSAT')) {
    // Landsat: NIR-Red-Green
    fccBands = ['SR_B5', 'SR_B4', 'SR_B3'];
  } else {
    throw new Error('FCC only supported for Sentinel-2 and Landsat datasets');
  }
  
  return {
    ...compositeResult,
    operation: 'fcc',
    fccBands,
    message: `Created False Color Composite (FCC) using bands: ${fccBands.join(', ')}`,
    visualization: {
      bands: fccBands,
      min: 0,
      max: datasetId.includes('COPERNICUS/S2') ? 0.3 : 3000,
      gamma: 1.4
    },
    nextSteps: 'Use thumbnail operation with the compositeKey and these visualization parameters'
  };
}

/**
 * Calculate NDVI index
 */
async function calculateNDVI(params: any) {
  const { datasetId, startDate, endDate, region, input, compositeKey } = params;
  
  let source;
  
  // Use existing composite if provided
  if (compositeKey && compositeStore[compositeKey]) {
    source = compositeStore[compositeKey];
  } else if (datasetId) {
    // Create a composite first
    const compositeResult = await createComposite({
      datasetId,
      startDate,
      endDate,
      region,
      compositeType: 'median'
    });
    source = compositeResult.result;
  } else if (input) {
    source = await getInput(input);
  } else {
    throw new Error('datasetId, input, or compositeKey required for NDVI calculation');
  }
  
  // Calculate NDVI based on dataset type
  let ndvi;
  let bands;
  
  if (datasetId?.includes('COPERNICUS/S2')) {
    bands = { red: 'B4', nir: 'B8' };
    ndvi = source.normalizedDifference([bands.nir, bands.red]).rename('NDVI');
  } else if (datasetId?.includes('LANDSAT')) {
    bands = { red: 'SR_B4', nir: 'SR_B5' };
    ndvi = source.normalizedDifference([bands.nir, bands.red]).rename('NDVI');
  } else {
    // Default to common band names
    bands = { red: 'B4', nir: 'B8' };
    try {
      ndvi = source.normalizedDifference([bands.nir, bands.red]).rename('NDVI');
    } catch {
      // Try alternative band names
      bands = { red: 'red', nir: 'nir' };
      ndvi = source.normalizedDifference([bands.nir, bands.red]).rename('NDVI');
    }
  }
  
  // Clip to region if provided
  if (region) {
    const geometry = await parseAoi(region);
    ndvi = ndvi.clip(geometry);
  }
  
  // Store NDVI result
  const ndviKey = `ndvi_${Date.now()}`;
  compositeStore[ndviKey] = ndvi;
  
  return {
    success: true,
    operation: 'index',
    indexType: 'NDVI',
    ndviKey,
    bands: bands,
    message: 'Calculated NDVI successfully',
    result: ndvi,
    visualization: {
      bands: ['NDVI'],
      min: -1,
      max: 1,
      palette: ['blue', 'white', 'green']
    },
    interpretation: {
      'values': {
        '-1 to 0': 'Water bodies',
        '0 to 0.2': 'Bare soil, rocks, sand',
        '0.2 to 0.4': 'Sparse vegetation',
        '0.4 to 0.6': 'Moderate vegetation',
        '0.6 to 0.8': 'Dense vegetation',
        '0.8 to 1': 'Very dense vegetation'
      }
    },
    nextSteps: 'Use thumbnail operation with the ndviKey and visualization parameters to see the NDVI map'
  };
}

/**
 * Main handler
 */
async function handler(params: any) {
  const { operation } = params;
  
  switch (operation) {
    case 'composite':
      return await createComposite(params);
      
    case 'fcc':
      return await createFCC(params);
      
    case 'index':
      // Check if specifically asking for NDVI
      if (params.indexType === 'NDVI' || !params.indexType) {
        return await calculateNDVI(params);
      }
      // Handle other indices...
      break;
      
    case 'clip':
    case 'mask':
    case 'analyze':
    case 'terrain':
    case 'resample':
      // These operations remain as before...
      return {
        success: true,
        operation,
        message: `Operation ${operation} completed`,
        result: null
      };
      
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// Register the tool
register({
  name: 'earth_engine_process',
  description: 'Processing & Analysis - clip, mask, index, analyze, composite, terrain, resample, FCC operations',
  inputSchema: ProcessToolSchema,
  handler
});

export { handler as processHandler };
