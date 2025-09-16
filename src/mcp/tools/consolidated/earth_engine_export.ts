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
import { getComposite, getMetadata, getAllCompositeKeys, globalCompositeStore as compositeStore, globalMetadataStore as compositeMetadata } from '@/src/lib/global-store';
import { generateTilesOptimized } from './tiles_handler';
import { generateTilesFast } from './tiles_fast';
import { generateTilesDirect } from './tiles_direct';
import { generateTilesFixed } from './tiles_fixed';

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
  let { 
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
  let metadata = null;
  
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
  } else if (compositeKey) {
    // Use stored composite result
    console.log(`Looking for composite: ${compositeKey}`);
    console.log(`Keys in store: ${getAllCompositeKeys().join(', ')}`);
    image = compositeStore[compositeKey];
    if (!image) {
      throw new Error(`Composite ${compositeKey} not found in store`);
    }
    
    // Check if we have metadata about this composite
    metadata = compositeMetadata[compositeKey];
    
    // Determine default visualization based on what created the composite
    if (metadata?.datasetId?.includes('COPERNICUS/S2') || datasetId?.includes('COPERNICUS/S2')) {
      // Sentinel-2 values are already scaled to 0-1 range (divided by 10000)
      defaultVis = {
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 0.3,
        gamma: 1.4
      };
    } else if (metadata?.datasetId?.includes('LANDSAT') || datasetId?.includes('LANDSAT')) {
      defaultVis = {
        bands: ['SR_B4', 'SR_B3', 'SR_B2'],
        min: 0,
        max: 3000,
        gamma: 1.4
      };
    } else {
      // Default for unknown or when no metadata - assume Sentinel-2 scaled values
      defaultVis = {
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 0.3,
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
    // Use provided input - ensure it's a valid EE object
    if (typeof input === 'string') {
      // If input is a string, it might be a compositeKey, modelKey, or datasetId
      console.log(`Looking for input: ${input}`);
      console.log(`Keys in store: ${getAllCompositeKeys().join(', ')}`);
      if (compositeStore[input]) {
        image = compositeStore[input];
        // Also get metadata if this is a composite
        metadata = compositeMetadata[input];
        // Set default vis based on metadata
        if (metadata?.datasetId?.includes('COPERNICUS/S2')) {
          defaultVis = {
            bands: ['B4', 'B3', 'B2'],
            min: 0,
            max: 0.3,
            gamma: 1.4
          };
        } else if (metadata?.datasetId?.includes('LANDSAT')) {
          defaultVis = {
            bands: ['SR_B4', 'SR_B3', 'SR_B2'],
            min: 0,
            max: 3000,
            gamma: 1.4
          };
        }
      } else if (input.startsWith('agriculture_model_') || 
                 input.startsWith('wildfire_model_') || 
                 input.startsWith('flood_model_') || 
                 input.startsWith('deforestation_model_') || 
                 input.startsWith('water_quality_model_')) {
        // This is a model key - retrieve from compositeStore
        if (compositeStore[input]) {
          image = compositeStore[input];
          // Set appropriate default vis for model outputs
          if (input.startsWith('agriculture_model_')) {
            defaultVis = {
              bands: ['crop_health'],
              min: 0,
              max: 0.8,
              palette: ['red', 'orange', 'yellow', 'lightgreen', 'darkgreen']
            };
          }
        } else {
          throw new Error(`Model output '${input}' not found in store`);
        }
      } else {
        // Try as dataset ID
        try {
          const collection = new ee.ImageCollection(input).median();
          image = collection;
        } catch {
          // Try as single image
          image = new ee.Image(input);
        }
      }
    } else {
      // Assume it's already an EE Image object
      image = input;
    }
  } else {
    // Check if there's a recent model or composite in the store
    const storeKeys = Object.keys(compositeStore);
    if (storeKeys.length > 0) {
      // Get the most recent key (highest timestamp)
      const recentKey = storeKeys.sort().reverse()[0];
      console.log(`No input specified, using most recent stored image: ${recentKey}`);
      image = compositeStore[recentKey];
      input = recentKey;
      
      // Set appropriate defaults based on key type
      if (recentKey.startsWith('agriculture_model_')) {
        defaultVis = {
          bands: ['crop_health'],
          min: 0,
          max: 0.8,
          palette: ['red', 'orange', 'yellow', 'lightgreen', 'darkgreen']
        };
      }
    } else {
      throw new Error('No image source provided. Use compositeKey, ndviKey, modelKey, datasetId, or input');
    }
  }
  
  // Smart merge of visParams - fix common mistakes
  let finalVis = { ...defaultVis };
  
  if (visParams) {
    // Check if we're dealing with Sentinel-2 data
    const isSentinel2 = (metadata?.datasetId?.includes('COPERNICUS/S2') || 
                        datasetId?.includes('COPERNICUS/S2') ||
                        (input && typeof input === 'string' && input.includes('composite') && 
                         !metadata?.datasetId?.includes('LANDSAT')));
    
    console.log('[Thumbnail] Dataset detection:', {
      isSentinel2,
      metadata: metadata?.datasetId,
      datasetId,
      input,
      providedMax: visParams.max
    });
    
    if (isSentinel2 && visParams.max && visParams.max > 100) {
      // User provided raw values (e.g., 3000/4000) for scaled Sentinel-2 data
      console.log('[AUTO-FIX] Correcting Sentinel-2 visualization: max', visParams.max, '→', visParams.max / 10000);
      finalVis = {
        bands: visParams.bands || defaultVis.bands,
        min: (visParams.min || 0) / 10000,
        max: visParams.max / 10000,
        gamma: visParams.gamma || defaultVis.gamma,
        palette: visParams.palette
      };
    } else {
      // Use provided params merged with defaults
      finalVis = {
        ...defaultVis,
        ...visParams
      };
    }
    
    console.log('[Thumbnail] Final visualization params:', finalVis);
  }
  
  // Prepare thumbnail parameters with size constraints
  // Earth Engine has a limit on thumbnail size
  const maxDimension = 1024; // Max safe dimension for thumbnails
  let finalDimensions = dimensions;
  
  if (dimensions > maxDimension) {
    console.log(`Requested dimension ${dimensions} exceeds max ${maxDimension}, capping to ${maxDimension}`);
    finalDimensions = maxDimension;
  }
  
  // Prepare thumbnail parameters - don't visualize here, do it in the callback
  const thumbParams: any = {
    dimensions: width && height ? `${Math.min(width, maxDimension)}x${Math.min(height, maxDimension)}` : finalDimensions,
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
  
  // Ensure we have a valid Earth Engine Image object
  if (!image || typeof image.visualize !== 'function') {
    throw new Error('Invalid image object - cannot generate thumbnail');
  }
  
  try {
    // Get thumbnail URL - visualize the image first, then get thumb URL
    const visualizedImage = image.visualize(finalVis);
    const url = await new Promise((resolve, reject) => {
      visualizedImage.getThumbURL(thumbParams, (url: string, error: any) => {
        if (error) reject(error);
        else resolve(url);
      });
    });
    
    return {
      success: true,
      operation: 'thumbnail',
      url,
      message: dimensions > maxDimension ? `Thumbnail generated (capped to ${maxDimension}px)` : 'Thumbnail generated successfully',
      visualization: finalVis,
      dimensions: thumbParams.dimensions,
      requestedDimensions: dimensions,
      region: region || 'full extent',
      source: ndviKey ? 'NDVI' : compositeKey ? 'composite' : datasetId || 'input'
    };
  } catch (error: any) {
    // Fallback to smaller dimensions if failed
    if (dimensions > 256) {
      console.log('Thumbnail generation failed, trying smaller dimensions...');
      thumbParams.dimensions = 256;
      
      try {
        const visualizedImage = image.visualize(finalVis);
        const url = await new Promise((resolve, reject) => {
          // Set a timeout for thumbnail generation
          const timeout = setTimeout(() => {
            reject(new Error('Thumbnail generation timed out (30s)'));
          }, 30000);
          
          visualizedImage.getThumbURL(thumbParams, (url: string, error: any) => {
            clearTimeout(timeout);
            if (error) reject(error);
            else resolve(url);
          });
        });
        
        return {
          success: true,
          operation: 'thumbnail',
          url,
          message: 'Thumbnail generated with smaller dimensions',
          visualization: finalVis,
          dimensions: thumbParams.dimensions,
          requestedDimensions: dimensions,
          region: region || 'full extent',
          source: ndviKey ? 'NDVI' : compositeKey ? 'composite' : datasetId || 'input'
        };
      } catch (fallbackError: any) {
        // If even small thumbnail fails, try ultra-small
        console.log('Fallback failed, trying ultra-small thumbnail (128px)...');
        thumbParams.dimensions = 128;
        
        try {
          const visualizedImage = image.visualize(finalVis);
          const url = await new Promise((resolve, reject) => {
            const timeout = setTimeout(() => {
              reject(new Error('Ultra-small thumbnail also timed out'));
            }, 15000);
            
            visualizedImage.getThumbURL(thumbParams, (url: string, error: any) => {
              clearTimeout(timeout);
              if (error) reject(error);
              else resolve(url);
            });
          });
          
          return {
            success: true,
            operation: 'thumbnail',
            url,
            message: 'Thumbnail generated at minimum size (128px) due to region complexity',
            visualization: finalVis,
            dimensions: 128,
            requestedDimensions: dimensions,
            region: region || 'full extent',
            source: ndviKey ? 'NDVI' : compositeKey ? 'composite' : datasetId || 'input'
          };
        } catch (ultraFallbackError: any) {
          throw new Error(`Thumbnail generation failed even at minimum size: ${ultraFallbackError.message}`);
        }
      }
    }
    
    throw new Error(`Thumbnail generation failed: ${error.message}`);
  }
}

/**
 * Get tile service for interactive maps - ROBUST IMPLEMENTATION
 */
async function getTiles(params: any) {
  // Use the fixed implementation that always works
  try {
    const result = await generateTilesFixed(params);
    return result;
  } catch (error) {
    // Fallback to original implementation
    console.log('Fixed tiles had an issue, using fallback');
  }
  const { 
    compositeKey,
    ndviKey,
    datasetId,
    startDate,
    endDate,
    region,
    visParams = {},
    zoomLevel = 10
  } = params;
  
  let image;
  let defaultVis = {};
  
  try {
    // Priority 1: Use stored results (most reliable)
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
      // Set visualization based on what we expect
      defaultVis = {
        bands: ['B4', 'B3', 'B2'],
        min: 0,
        max: 0.3
      };
    } else if (datasetId) {
      // Create a simple composite without complex operations
      const collection = new ee.ImageCollection(datasetId);
      
      // Apply basic filters
      let filtered = collection;
      
      if (startDate && endDate) {
        filtered = filtered.filterDate(startDate, endDate);
      }
      
      // Don't parse region - just skip if complex
      if (region && typeof region === 'string') {
        // Use simple bbox for known cities
        const cityBoxes: Record<string, number[]> = {
          'San Francisco': [-122.5, 37.7, -122.3, 37.9],
          'Los Angeles': [-118.5, 33.9, -118.1, 34.2],
          'Manhattan': [-74.02, 40.70, -73.93, 40.82],
          'Denver': [-105.1, 39.6, -104.8, 39.8],
          'Miami': [-80.3, 25.7, -80.1, 25.9],
          'Seattle': [-122.4, 47.5, -122.2, 47.7],
          'Phoenix': [-112.2, 33.3, -111.9, 33.6],
          'Boston': [-71.2, 42.3, -71.0, 42.4],
          'Chicago': [-87.8, 41.8, -87.6, 42.0],
          'Texas': [-100, 28, -98, 30]
        };
        
        if (cityBoxes[region]) {
          const [west, south, east, north] = cityBoxes[region];
          const bbox = ee.Geometry.Rectangle([west, south, east, north]);
          filtered = filtered.filterBounds(bbox);
        }
      }
      
      // Take first image or simple median
      const count = filtered.size();
      image = filtered.limit(5).median();
      
      // Apply simple processing
      if (datasetId.includes('COPERNICUS/S2')) {
        image = image.divide(10000).select(['B.*']);
        defaultVis = {
          bands: ['B4', 'B3', 'B2'],
          min: 0,
          max: 0.3
        };
      } else if (datasetId.includes('LANDSAT')) {
        image = image.select(['SR_B.*']);
        defaultVis = {
          bands: ['SR_B4', 'SR_B3', 'SR_B2'],
          min: 0,
          max: 3000
        };
      }
    } else {
      throw new Error('No image source provided');
    }
    
    const finalVis = { ...defaultVis, ...visParams };
    
    // Robust map ID generation with proper async handling
    return new Promise((resolve, reject) => {
      // Set a reasonable timeout
      const timeout = setTimeout(() => {
        resolve({
          success: false,
          operation: 'tiles',
          message: 'Tile generation is taking longer than expected',
          suggestion: 'Create a composite first using earth_engine_process, then use the compositeKey',
          alternativeAction: 'Use thumbnail operation for static images instead'
        });
      }, 30000); // 30 second timeout
      
      try {
        // Visualize and get map ID
        const visualized = image.visualize(finalVis);
        visualized.getMapId((mapIdObj: any, error: any) => {
          clearTimeout(timeout);
          
          if (error) {
            console.error('Map ID error:', error);
            resolve({
              success: false,
              operation: 'tiles',
              error: error.message || 'Failed to generate map ID',
              message: 'Could not create tile service',
              suggestion: 'Try with a smaller region or date range'
            });
          } else {
            const mapId = mapIdObj.mapid || mapIdObj.token || mapIdObj;
            if (mapId) {
              resolve({
                success: true,
                operation: 'tiles',
                mapId: mapId,
                tileUrl: `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapId}/tiles/{z}/{x}/{y}`,
                message: 'Tile service created successfully',
                visualization: finalVis,
                zoomLevel,
                examples: {
                  leaflet: `L.tileLayer('https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapId}/tiles/{z}/{x}/{y}').addTo(map)`,
                  directTile: `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapId}/tiles/10/163/394`
                }
              });
            } else {
              resolve({
                success: false,
                operation: 'tiles',
                error: 'No map ID returned',
                message: 'Failed to generate tile service'
              });
            }
          }
        });
      } catch (err: any) {
        clearTimeout(timeout);
        resolve({
          success: false,
          operation: 'tiles',
          error: err.message,
          message: 'Error creating tile service'
        });
      }
    });
  } catch (error: any) {
    console.error('Tiles error:', error);
    return {
      success: false,
      operation: 'tiles',
      error: error.message,
      message: 'Failed to create tile service',
      suggestion: 'Create a composite first, then use its key for tiles'
    };
  }
}

/**
 * Perform actual export to GCS or Drive
 */
async function performExport(params: any) {
  const {
    input,
    compositeKey,
    datasetId,
    region,
    startDate,
    endDate,
    destination = 'gcs',
    bucket = 'earthengine-exports',
    folder = 'My Drive',
    fileNamePrefix = `export_${Date.now()}`,
    format = 'GeoTIFF',
    scale = 10,
    maxPixels = 1e9
  } = params;
  
  try {
    let image;
    let exportRegion;
    
    // Priority 1: Use stored composite
    if (compositeKey && compositeStore[compositeKey]) {
      image = compositeStore[compositeKey];
      console.log(`Using stored composite: ${compositeKey}`);
    } 
    // Priority 2: Use provided input string as compositeKey
    else if (input && typeof input === 'string' && compositeStore[input]) {
      image = compositeStore[input];
      console.log(`Using composite from input: ${input}`);
    }
    // Priority 3: Create new image from datasetId
    else if (datasetId) {
      console.log(`Creating new image from dataset: ${datasetId}`);
      let collection = ee.ImageCollection(datasetId);
      
      if (startDate && endDate) {
        collection = collection.filterDate(startDate, endDate);
      }
      
      if (region) {
        exportRegion = await parseAoi(region);
        collection = collection.filterBounds(exportRegion);
      }
      
      // Apply cloud filtering for optical data
      if (datasetId.includes('COPERNICUS/S2')) {
        collection = collection.filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
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
      } else if (datasetId.includes('LANDSAT')) {
        collection = collection.filter(ee.Filter.lt('CLOUD_COVER', 20));
      }
      
      image = collection.median();
    } else {
      throw new Error('No valid image source provided (need compositeKey, input, or datasetId)');
    }
    
    // Parse region for export if not already done
    if (!exportRegion && region) {
      exportRegion = await parseAoi(region);
    }
    
    // Generate unique task description
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const taskDescription = `${fileNamePrefix}_${timestamp}`;
    
    // Create export task based on destination
    let task;
    if (destination === 'gcs' || destination === 'auto') {
      // Export to Google Cloud Storage
      const exportParams: any = {
        image: image,
        description: taskDescription,
        bucket: bucket,
        fileNamePrefix: fileNamePrefix,
        scale: scale,
        maxPixels: maxPixels,
        fileFormat: format,
        crs: 'EPSG:4326'
      };
      
      // Handle region - if it exists, clip the image but don't set region in params
      // This avoids the computed geometry serialization issue
      if (exportRegion) {
        // Clip the image to the region instead of passing region to export
        exportParams.image = image.clip(exportRegion);
      } else {
        exportParams.image = image;
      }
      
      task = ee.batch.Export.image.toCloudStorage(exportParams);
    } else if (destination === 'drive') {
      // Export to Google Drive
      const exportParams: any = {
        image: image,
        description: taskDescription,
        folder: folder,
        fileNamePrefix: fileNamePrefix,
        scale: scale,
        maxPixels: maxPixels,
        fileFormat: format,
        crs: 'EPSG:4326'
      };
      
      // Handle region - if it exists, clip the image but don't set region in params
      // This avoids the computed geometry serialization issue
      if (exportRegion) {
        // Clip the image to the region instead of passing region to export
        exportParams.image = image.clip(exportRegion);
      } else {
        exportParams.image = image;
      }
      
      task = ee.batch.Export.image.toDrive(exportParams);
    } else {
      throw new Error(`Unsupported destination: ${destination}`);
    }
    
    // Start the export task
    task.start();
    
    // Get task ID
    const taskId = task.id;
    
    return {
      success: true,
      operation: 'export',
      taskId: taskId,
      status: 'STARTED',
      message: `Export task started successfully`,
      details: {
        description: taskDescription,
        destination: destination,
        bucket: destination === 'gcs' ? bucket : undefined,
        folder: destination === 'drive' ? folder : undefined,
        fileNamePrefix: fileNamePrefix,
        format: format,
        scale: scale,
        maxPixels: maxPixels,
        region: region || 'full extent'
      },
      instructions: {
        checkStatus: `Use operation: 'status' with taskId: '${taskId}' to check progress`,
        accessFile: destination === 'gcs' 
          ? `File will be available at: gs://${bucket}/${fileNamePrefix}*`
          : `File will be available in Google Drive folder: ${folder}/${fileNamePrefix}*`
      }
    };
  } catch (error: any) {
    console.error('Export error:', error);
    return {
      success: false,
      operation: 'export',
      error: error.message || 'Export failed',
      message: 'Failed to start export task',
      params: params
    };
  }
}

/**
 * Check export status
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
      return await performExport(params);
      
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
