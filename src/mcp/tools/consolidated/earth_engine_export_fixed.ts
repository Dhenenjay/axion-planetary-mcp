/**
 * EARTH ENGINE EXPORT - Consolidated Export & Visualization Tool
 * Fixed version with complete thumbnail implementation
 */

import ee from '@google/earthengine';
import { z } from 'zod';
import { register } from '../../registry';
import { parseAoi } from '@/src/utils/geo';
import { Storage } from '@google-cloud/storage';
import { optimizer } from '@/src/utils/ee-optimizer';
import { compositeStore } from './earth_engine_process_fixed';

// Main schema for the consolidated tool
const ExportToolSchema = z.object({
  operation: z.enum(['export', 'thumbnail', 'tiles', 'status', 'download']),
  
  // Common params
  input: z.any().optional(),
  compositeKey: z.string().optional(),
  ndviKey: z.string().optional(),
  datasetId: z.string().optional(),
  region: z.any().optional(),
  scale: z.number().optional().default(10),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  
  // Export operation params
  destination: z.enum(['gcs', 'drive', 'auto']).optional().default('gcs'),
  bucket: z.string().optional(),
  folder: z.string().optional(),
  fileNamePrefix: z.string().optional(),
  format: z.enum(['GeoTIFF', 'TFRecord', 'COG']).optional().default('GeoTIFF'),
  maxPixels: z.number().optional().default(1e9),
  
  // Visualization params
  visParams: z.object({
    bands: z.array(z.string()).optional(),
    min: z.union([z.number(), z.array(z.number())]).optional(),
    max: z.union([z.number(), z.array(z.number())]).optional(),
    gamma: z.number().optional(),
    palette: z.array(z.string()).optional()
  }).optional(),
  
  // Thumbnail params
  dimensions: z.number().optional().default(512),
  width: z.number().optional(),
  height: z.number().optional(),
  
  // Tiles params
  zoomLevel: z.number().optional().default(10),
  
  // Status params
  taskId: z.string().optional()
});

/**
 * Generate thumbnail for visualization
 */
async function generateThumbnail(params: any) {
  const { 
    input,
    compositeKey,
    ndviKey,
    datasetId,
    startDate,
    endDate,
    region,
    visParams = {},
    dimensions = 512,
    width,
    height
  } = params;
  
  let image;
  let defaultVis = {};
  
  // Priority: Use stored results first
  if (ndviKey && compositeStore[ndviKey]) {
    // Use stored NDVI result
    image = compositeStore[ndviKey];
    defaultVis = {
      bands: ['NDVI'],
      min: -1,
      max: 1,
      palette: ['blue', 'white', 'green']
    };
  } else if (compositeKey && compositeStore[compositeKey]) {
    // Use stored composite result
    image = compositeStore[compositeKey];
    
    // Determine default visualization based on what created the composite
    if (datasetId?.includes('COPERNICUS/S2')) {
      defaultVis = {
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 0.3,
        gamma: 1.4
      };
    } else if (datasetId?.includes('LANDSAT')) {
      defaultVis = {
        bands: ['SR_B4', 'SR_B3', 'SR_B2'],
        min: 0,
        max: 3000,
        gamma: 1.4
      };
    }
  } else if (datasetId) {
    // Create image from dataset
    let collection = new ee.ImageCollection(datasetId);
    
    if (startDate && endDate) {
      collection = collection.filterDate(startDate, endDate);
    }
    
    if (region) {
      const geometry = await parseAoi(region);
      collection = collection.filterBounds(geometry);
    }
    
    // Apply cloud filter for optical imagery
    if (datasetId.includes('COPERNICUS/S2')) {
      collection = collection.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));
      // Apply cloud masking
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
      
      defaultVis = {
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 0.3,
        gamma: 1.4
      };
    } else if (datasetId.includes('LANDSAT')) {
      collection = collection.filter(ee.Filter.lt('CLOUD_COVER', 20));
      defaultVis = {
        bands: ['SR_B4', 'SR_B3', 'SR_B2'],
        min: 0,
        max: 3000,
        gamma: 1.4
      };
    }
    
    // Create median composite
    image = collection.median();
    
    if (region) {
      const geometry = await parseAoi(region);
      image = image.clip(geometry);
    }
  } else if (input) {
    // Use provided input
    image = input;
  } else {
    throw new Error('No image source provided. Use compositeKey, ndviKey, datasetId, or input');
  }
  
  // Merge provided visParams with defaults
  const finalVis = {
    ...defaultVis,
    ...visParams
  };
  
  // Prepare thumbnail parameters
  const thumbParams: any = {
    image: image.visualize(finalVis),
    dimensions: width && height ? `${width}x${height}` : dimensions,
    format: 'png'
  };
  
  // Add region if provided
  if (region) {
    try {
      const geometry = await parseAoi(region);
      thumbParams.region = geometry;
    } catch (e) {
      console.log('Could not parse region for thumbnail, using full image extent');
    }
  }
  
  try {
    // Get thumbnail URL
    const url = await new Promise((resolve, reject) => {
      image.visualize(finalVis).getThumbURL(thumbParams, (url: string, error: any) => {
        if (error) reject(error);
        else resolve(url);
      });
    });
    
    return {
      success: true,
      operation: 'thumbnail',
      url,
      message: 'Thumbnail generated successfully',
      visualization: finalVis,
      dimensions: thumbParams.dimensions,
      region: region || 'full extent',
      source: ndviKey ? 'NDVI' : compositeKey ? 'composite' : datasetId || 'input'
    };
  } catch (error: any) {
    // Fallback to smaller dimensions if failed
    if (dimensions > 256) {
      console.log('Thumbnail generation failed, trying smaller dimensions...');
      thumbParams.dimensions = 256;
      
      try {
        const url = await new Promise((resolve, reject) => {
          image.visualize(finalVis).getThumbURL(thumbParams, (url: string, error: any) => {
            if (error) reject(error);
            else resolve(url);
          });
        });
        
        return {
          success: true,
          operation: 'thumbnail',
          url,
          message: 'Thumbnail generated (reduced resolution)',
          visualization: finalVis,
          dimensions: 256,
          region: region || 'full extent',
          warning: 'Generated at reduced resolution due to size constraints'
        };
      } catch (fallbackError: any) {
        throw new Error(`Thumbnail generation failed: ${fallbackError.message}`);
      }
    }
    
    throw new Error(`Thumbnail generation failed: ${error.message}`);
  }
}

/**
 * Get tile service for interactive maps
 */
async function getTiles(params: any) {
  const { 
    input,
    compositeKey,
    ndviKey,
    datasetId,
    region,
    visParams = {},
    zoomLevel = 10
  } = params;
  
  let image;
  let defaultVis = {};
  
  // Get image source (similar to thumbnail)
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
    if (datasetId?.includes('COPERNICUS/S2')) {
      defaultVis = {
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 0.3
      };
    }
  } else {
    throw new Error('No image source provided');
  }
  
  const finalVis = { ...defaultVis, ...visParams };
  
  // Get map ID and tile URL
  const mapId = image.visualize(finalVis).getMapId(finalVis);
  const mapIdResult = await new Promise((resolve, reject) => {
    mapId.evaluate((result: any, error: any) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
  
  return {
    success: true,
    operation: 'tiles',
    mapId: mapIdResult,
    tileUrl: `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapIdResult}-*/tiles/{z}/{x}/{y}`,
    message: 'Tile service created',
    visualization: finalVis,
    zoomLevel
  };
}

/**
 * Check export task status
 */
async function checkStatus(params: any) {
  const { taskId } = params;
  
  if (!taskId) throw new Error('taskId required for status check');
  
  try {
    const taskList = await new Promise((resolve, reject) => {
      ee.data.getTaskList((tasks: any, error: any) => {
        if (error) reject(error);
        else resolve(tasks);
      });
    });
    
    const task = (taskList as any[]).find(t => t.id === taskId);
    
    if (!task) {
      return {
        success: false,
        operation: 'status',
        taskId,
        message: 'Task not found',
        state: 'UNKNOWN'
      };
    }
    
    return {
      success: true,
      operation: 'status',
      taskId,
      state: task.state,
      progress: task.state === 'RUNNING' ? task.progress : null,
      message: `Task ${taskId} is ${task.state}`,
      description: task.description,
      created: task.creation_timestamp_ms ? new Date(task.creation_timestamp_ms).toISOString() : null,
      updated: task.update_timestamp_ms ? new Date(task.update_timestamp_ms).toISOString() : null
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'status',
      taskId,
      error: error.message,
      message: 'Failed to check task status'
    };
  }
}

/**
 * Main handler
 */
async function handler(params: any) {
  const { operation } = params;
  
  switch (operation) {
    case 'thumbnail':
      return await generateThumbnail(params);
      
    case 'tiles':
      return await getTiles(params);
      
    case 'status':
      return await checkStatus(params);
      
    case 'export':
      // Export implementation would go here
      return {
        success: true,
        operation: 'export',
        message: 'Export functionality pending implementation',
        params
      };
      
    case 'download':
      return {
        success: true,
        operation: 'download',
        message: 'Download functionality pending implementation',
        params
      };
      
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// Register the tool
register({
  name: 'earth_engine_export',
  description: 'Export & Visualization - export, thumbnail, tiles, status, download operations',
  inputSchema: ExportToolSchema,
  handler
});

export { handler as exportHandler };
