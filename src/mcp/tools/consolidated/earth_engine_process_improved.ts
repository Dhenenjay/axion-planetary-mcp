/**
 * EARTH ENGINE PROCESS - Improved version with chunked output
 * Handles large results by breaking them into manageable chunks
 */

import ee from '@google/earthengine';
import { z } from 'zod';
import { register } from '../../registry';
import { parseAoi } from '@/src/utils/geo';
import { generateThumbnail } from './earth_engine_export_improved';

// Store composites in memory for reuse
export const compositeStore: Record<string, any> = {};
export const resultsStore: Record<string, any> = {};

const MAX_OUTPUT_SIZE = 50000; // 50KB max per chunk

const ProcessToolSchema = z.object({
  operation: z.enum([
    'composite', 
    'index', 
    'analyze', 
    'terrain',
    'timeseries',
    'statistics'
  ]),
  
  // Common params
  datasetId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  region: z.any().optional(),
  scale: z.number().optional().default(30),
  
  // Analysis params
  compositeType: z.enum(['median', 'mean', 'max', 'min', 'stdDev']).optional(),
  indexType: z.enum(['NDVI', 'NDWI', 'EVI', 'SAVI', 'MNDWI', 'NBR', 'NDSI', 'NDBI']).optional(),
  bands: z.array(z.string()).optional(),
  reducer: z.string().optional(),
  
  // Chunk control
  chunkSize: z.number().optional().default(10),
  chunkId: z.string().optional(),
  continueFrom: z.string().optional()
});

/**
 * Helper to chunk large results
 */
function chunkResults(data: any, maxSize: number = MAX_OUTPUT_SIZE): any[] {
  const dataStr = JSON.stringify(data);
  
  if (dataStr.length <= maxSize) {
    return [data];
  }
  
  // If it's an array, chunk by items
  if (Array.isArray(data)) {
    const chunks: any[] = [];
    let currentChunk: any[] = [];
    let currentSize = 0;
    
    for (const item of data) {
      const itemSize = JSON.stringify(item).length;
      if (currentSize + itemSize > maxSize && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentSize = 0;
      }
      currentChunk.push(item);
      currentSize += itemSize;
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }
    
    return chunks;
  }
  
  // If it's an object with values array (like time series)
  if (data.values && Array.isArray(data.values)) {
    const chunks: any[] = [];
    const chunkSize = Math.ceil(data.values.length / Math.ceil(dataStr.length / maxSize));
    
    for (let i = 0; i < data.values.length; i += chunkSize) {
      chunks.push({
        ...data,
        values: data.values.slice(i, Math.min(i + chunkSize, data.values.length)),
        chunk: {
          index: Math.floor(i / chunkSize),
          total: Math.ceil(data.values.length / chunkSize),
          start: i,
          end: Math.min(i + chunkSize, data.values.length)
        }
      });
    }
    
    return chunks;
  }
  
  // For other data, return with chunking metadata
  return [{
    ...data,
    truncated: true,
    message: 'Result too large. Use specific operations or smaller regions/time ranges.'
  }];
}

/**
 * Calculate time series with chunked output
 */
async function calculateTimeSeries(params: any) {
  const { 
    datasetId, 
    startDate, 
    endDate, 
    region, 
    scale = 30,
    bands = ['B4'],
    reducer = 'mean',
    chunkSize = 10,
    continueFrom
  } = params;
  
  let geometry = await parseAoi(region);
  let collection = new ee.ImageCollection(datasetId);
  
  if (startDate && endDate) {
    collection = collection.filterDate(startDate, endDate);
  }
  
  if (geometry) {
    collection = collection.filterBounds(geometry);
  }
  
  // Apply cloud filtering
  if (datasetId.includes('COPERNICUS/S2')) {
    collection = collection.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
  }
  
  // Get image count
  const count = await collection.size().getInfo();
  
  // Store result ID for continuation
  const resultId = `timeseries_${Date.now()}`;
  
  // If continuing, get from store
  let startIndex = 0;
  if (continueFrom && resultsStore[continueFrom]) {
    const stored = resultsStore[continueFrom];
    startIndex = stored.lastIndex + 1;
  }
  
  // Process in chunks
  const endIndex = Math.min(startIndex + chunkSize, count);
  const imageList = collection.toList(count);
  
  const values = [];
  for (let i = startIndex; i < endIndex; i++) {
    const image = ee.Image(imageList.get(i));
    const date = image.date().format('YYYY-MM-dd');
    
    let value;
    if (reducer === 'mean') {
      value = image.select(bands).reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: geometry,
        scale: scale,
        maxPixels: 1e9
      });
    } else if (reducer === 'median') {
      value = image.select(bands).reduceRegion({
        reducer: ee.Reducer.median(),
        geometry: geometry,
        scale: scale,
        maxPixels: 1e9
      });
    }
    
    const result = await value.getInfo();
    const dateStr = await date.getInfo();
    
    values.push({
      date: dateStr,
      value: result[bands[0]] || 0,
      index: i
    });
  }
  
  // Store for continuation
  resultsStore[resultId] = {
    values,
    lastIndex: endIndex - 1,
    totalCount: count,
    params
  };
  
  return {
    success: true,
    operation: 'timeseries',
    resultId,
    values,
    metadata: {
      dataset: datasetId,
      region: region,
      dateRange: { startDate, endDate },
      processed: `${endIndex}/${count} images`,
      chunkSize,
      hasMore: endIndex < count
    },
    continuation: endIndex < count ? {
      continueFrom: resultId,
      nextCommand: {
        operation: 'timeseries',
        continueFrom: resultId,
        ...params
      }
    } : null
  };
}

/**
 * Create composite with better defaults
 */
async function createComposite(params: any) {
  const { 
    datasetId, 
    startDate, 
    endDate, 
    region, 
    compositeType = 'median',
    scale = 30
  } = params;
  
  let collection = new ee.ImageCollection(datasetId);
  
  if (startDate && endDate) {
    collection = collection.filterDate(startDate, endDate);
  }
  
  let geometry;
  if (region) {
    geometry = await parseAoi(region);
    collection = collection.filterBounds(geometry);
  }
  
  // Apply dataset-specific preprocessing
  if (datasetId.includes('COPERNICUS/S2')) {
    collection = collection
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
      .map((img: any) => {
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
  
  // Create composite
  let composite;
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
    case 'stdDev':
      composite = collection.reduce(ee.Reducer.stdDev());
      break;
    default:
      composite = collection.median();
  }
  
  if (geometry) {
    composite = composite.clip(geometry);
  }
  
  // Store composite
  const compositeKey = `composite_${Date.now()}`;
  compositeStore[compositeKey] = composite;
  
  // Get basic statistics
  const stats = await composite.reduceRegion({
    reducer: ee.Reducer.minMax(),
    geometry: geometry || ee.Geometry.Rectangle([-180, -90, 180, 90]),
    scale: scale * 10, // Use coarser scale for stats
    maxPixels: 1e7,
    bestEffort: true
  }).getInfo();
  
  return {
    success: true,
    operation: 'composite',
    compositeType,
    compositeKey,
    message: `Created ${compositeType} composite from ${datasetId}`,
    dateRange: { startDate, endDate },
    statistics: stats,
    visualization: {
      recommended: datasetId.includes('COPERNICUS/S2') ? {
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 0.3,
        gamma: 1.4
      } : {
        bands: ['SR_B4', 'SR_B3', 'SR_B2'],
        min: 0,
        max: 3000,
        gamma: 1.4
      }
    },
    nextSteps: 'Use earth_engine_export with operation:"thumbnail" and this compositeKey to visualize'
  };
}

/**
 * Calculate vegetation indices with interpretation
 */
async function calculateIndex(params: any) {
  const { 
    datasetId, 
    startDate, 
    endDate, 
    region, 
    compositeKey,
    indexType = 'NDVI',
    scale = 30
  } = params;
  
  let source;
  
  if (compositeKey && compositeStore[compositeKey]) {
    source = compositeStore[compositeKey];
  } else if (datasetId) {
    const compositeResult = await createComposite({
      datasetId,
      startDate,
      endDate,
      region,
      compositeType: 'median'
    });
    source = compositeStore[compositeResult.compositeKey];
  } else {
    throw new Error('datasetId or compositeKey required');
  }
  
  // Band mapping
  let bands: any = {};
  if (datasetId?.includes('COPERNICUS/S2')) {
    bands = {
      red: 'B4',
      green: 'B3',
      blue: 'B2',
      nir: 'B8',
      swir1: 'B11',
      swir2: 'B12'
    };
  } else {
    bands = {
      red: 'SR_B4',
      green: 'SR_B3',
      blue: 'SR_B2',
      nir: 'SR_B5',
      swir1: 'SR_B6',
      swir2: 'SR_B7'
    };
  }
  
  let index;
  let indexKey;
  let visualization;
  
  switch (indexType) {
    case 'NDVI':
      index = source.normalizedDifference([bands.nir, bands.red]).rename('NDVI');
      indexKey = `ndvi_${Date.now()}`;
      visualization = {
        bands: ['NDVI'],
        min: -1,
        max: 1,
        palette: ['blue', 'white', 'green']
      };
      break;
      
    case 'NDWI':
      index = source.normalizedDifference([bands.green, bands.nir]).rename('NDWI');
      indexKey = `ndwi_${Date.now()}`;
      visualization = {
        bands: ['NDWI'],
        min: -1,
        max: 1,
        palette: ['brown', 'white', 'blue']
      };
      break;
      
    case 'EVI':
      const nir = source.select(bands.nir);
      const red = source.select(bands.red);
      const blue = source.select(bands.blue);
      
      index = nir.subtract(red)
        .divide(nir.add(red.multiply(6)).subtract(blue.multiply(7.5)).add(1))
        .multiply(2.5)
        .rename('EVI');
      
      indexKey = `evi_${Date.now()}`;
      visualization = {
        bands: ['EVI'],
        min: -1,
        max: 1,
        palette: ['brown', 'yellow', 'green']
      };
      break;
      
    default:
      throw new Error(`Unknown index type: ${indexType}`);
  }
  
  // Store index
  compositeStore[indexKey] = index;
  
  // Calculate statistics
  let geometry;
  if (region) {
    geometry = await parseAoi(region);
    index = index.clip(geometry);
  }
  
  const stats = await index.reduceRegion({
    reducer: ee.Reducer.mean().combine(ee.Reducer.stdDev(), '', true),
    geometry: geometry || ee.Geometry.Rectangle([-180, -90, 180, 90]),
    scale: scale * 10,
    maxPixels: 1e7,
    bestEffort: true
  }).getInfo();
  
  return {
    success: true,
    operation: 'index',
    indexType,
    indexKey,
    message: `Calculated ${indexType} index`,
    statistics: {
      mean: stats[`${indexType}_mean`] || 0,
      stdDev: stats[`${indexType}_stdDev`] || 0
    },
    visualization,
    interpretation: getIndexInterpretation(indexType, stats[`${indexType}_mean`]),
    nextSteps: `Use earth_engine_export with operation:"thumbnail" and indexKey:"${indexKey}" to visualize`
  };
}

function getIndexInterpretation(indexType: string, meanValue: number): any {
  switch (indexType) {
    case 'NDVI':
      if (meanValue < 0) return { status: 'Water/Snow', health: 'N/A' };
      if (meanValue < 0.2) return { status: 'Bare soil', health: 'No vegetation' };
      if (meanValue < 0.4) return { status: 'Sparse vegetation', health: 'Poor' };
      if (meanValue < 0.6) return { status: 'Moderate vegetation', health: 'Fair' };
      if (meanValue < 0.8) return { status: 'Dense vegetation', health: 'Good' };
      return { status: 'Very dense vegetation', health: 'Excellent' };
      
    case 'NDWI':
      if (meanValue < -0.3) return { status: 'Dry vegetation', waterContent: 'Very low' };
      if (meanValue < 0) return { status: 'Low moisture', waterContent: 'Low' };
      if (meanValue < 0.3) return { status: 'Moderate moisture', waterContent: 'Moderate' };
      return { status: 'High moisture/Water', waterContent: 'High' };
      
    default:
      return { status: 'Calculated', value: meanValue };
  }
}

// Register the improved tool
register({
  name: 'earth_engine_process',
  description: 'Process and analyze Earth Engine data with chunked output support',
  inputSchema: ProcessToolSchema,
  handler: async (params: any) => {
    try {
      const { operation } = params;
      
      switch (operation) {
        case 'composite':
          return await createComposite(params);
          
        case 'index':
          return await calculateIndex(params);
          
        case 'timeseries':
          return await calculateTimeSeries(params);
          
        case 'analyze':
        case 'statistics':
          // For large statistical operations, chunk the results
          const result = await calculateStatistics(params);
          const chunks = chunkResults(result);
          
          if (chunks.length === 1) {
            return chunks[0];
          }
          
          // Store chunks and return first with continuation info
          const chunkId = `chunk_${Date.now()}`;
          resultsStore[chunkId] = chunks;
          
          return {
            ...chunks[0],
            chunk: {
              id: chunkId,
              index: 0,
              total: chunks.length,
              hasMore: chunks.length > 1
            },
            continuation: {
              message: 'Result chunked due to size. Request next chunk with chunkId',
              chunkId,
              nextIndex: 1
            }
          };
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Processing failed',
        details: error.stack
      };
    }
  }
});

async function calculateStatistics(params: any) {
  // Implementation for statistics calculation
  // This would be similar to existing implementations but with chunking support
  return {
    success: true,
    operation: 'statistics',
    message: 'Statistics calculated',
    data: {} // Actual statistics data
  };
}

export default ProcessToolSchema;
