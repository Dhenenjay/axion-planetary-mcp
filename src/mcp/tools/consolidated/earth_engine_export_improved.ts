/**
 * EARTH ENGINE EXPORT - Improved version with high-quality thumbnails
 * Optimized for better image quality and performance
 */

import ee from '@google/earthengine';
import { z } from 'zod';
import { register } from '../../registry';
import { parseAoi } from '@/src/utils/geo';
import { compositeStore, resultsStore } from './earth_engine_process_improved';

const ExportToolSchema = z.object({
  operation: z.enum(['thumbnail', 'export', 'tiles', 'download']),
  
  // Image source params
  compositeKey: z.string().optional(),
  indexKey: z.string().optional(),
  datasetId: z.string().optional(),
  
  // Region and time params
  region: z.any().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  
  // Visualization params
  visParams: z.object({
    bands: z.array(z.string()).optional(),
    min: z.union([z.number(), z.array(z.number())]).optional(),
    max: z.union([z.number(), z.array(z.number())]).optional(),
    gamma: z.union([z.number(), z.array(z.number())]).optional(),
    palette: z.array(z.string()).optional()
  }).optional(),
  
  // Thumbnail params
  dimensions: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  quality: z.enum(['low', 'medium', 'high', 'ultra']).optional().default('high'),
  format: z.enum(['png', 'jpg']).optional().default('png'),
  
  // Export params
  scale: z.number().optional().default(10),
  maxPixels: z.number().optional().default(1e9),
  destination: z.enum(['drive', 'gcs']).optional(),
  fileFormat: z.enum(['GeoTIFF', 'TFRecord']).optional().default('GeoTIFF')
});

/**
 * Get quality settings based on quality level
 */
function getQualitySettings(quality: string) {
  switch (quality) {
    case 'ultra':
      return {
        dimensions: 2048,
        scale: 10,
        format: 'png',
        gamma: 1.2,
        sharpen: true
      };
    case 'high':
      return {
        dimensions: 1024,
        scale: 30,
        format: 'png',
        gamma: 1.4,
        sharpen: false
      };
    case 'medium':
      return {
        dimensions: 512,
        scale: 60,
        format: 'jpg',
        gamma: 1.5,
        sharpen: false
      };
    case 'low':
      return {
        dimensions: 256,
        scale: 100,
        format: 'jpg',
        gamma: 1.6,
        sharpen: false
      };
    default:
      return {
        dimensions: 1024,
        scale: 30,
        format: 'png',
        gamma: 1.4,
        sharpen: false
      };
  }
}

/**
 * Optimize visualization parameters for better quality
 */
function optimizeVisualization(datasetId: string, bands?: string[], customVis?: any) {
  let optimized: any = {};
  
  if (datasetId?.includes('COPERNICUS/S2')) {
    // Sentinel-2 optimization
    optimized = {
      bands: bands || ['B4', 'B3', 'B2'],
      min: 0,
      max: 0.3,
      gamma: [1.4, 1.4, 1.6] // Different gamma for each band
    };
    
    // Special cases for different band combinations
    if (bands && bands[0] === 'B8') {
      // NIR composite
      optimized = {
        bands: bands,
        min: 0,
        max: 0.4,
        gamma: 1.3
      };
    } else if (bands && bands[0] === 'B12') {
      // SWIR composite
      optimized = {
        bands: bands,
        min: 0,
        max: 0.35,
        gamma: 1.2
      };
    }
  } else if (datasetId?.includes('LANDSAT')) {
    // Landsat optimization
    optimized = {
      bands: bands || ['SR_B4', 'SR_B3', 'SR_B2'],
      min: 0,
      max: 3000,
      gamma: 1.4
    };
  } else if (bands && bands.length === 1) {
    // Single band (like indices)
    const bandName = bands[0];
    if (bandName === 'NDVI' || bandName === 'NDWI' || bandName === 'EVI') {
      optimized = {
        bands: bands,
        min: -1,
        max: 1,
        palette: getPalette(bandName)
      };
    }
  }
  
  // Merge with custom visualization params
  return { ...optimized, ...customVis };
}

/**
 * Get optimized color palette for indices
 */
function getPalette(indexType: string): string[] {
  switch (indexType) {
    case 'NDVI':
      return [
        '#a50026', '#d73027', '#f46d43', '#fdae61',
        '#fee08b', '#ffffbf', '#d9ef8b', '#a6d96a',
        '#66bd63', '#1a9850', '#006837'
      ];
    case 'NDWI':
      return [
        '#8b4513', '#a0522d', '#cd853f', '#daa520',
        '#f0e68c', '#e0ffff', '#87ceeb', '#4682b4',
        '#1e90ff', '#0000cd', '#000080'
      ];
    case 'EVI':
      return [
        '#8b0000', '#ff0000', '#ff4500', '#ffa500',
        '#ffff00', '#adff2f', '#7fff00', '#32cd32',
        '#008000', '#006400', '#004000'
      ];
    default:
      return ['blue', 'white', 'green'];
  }
}

/**
 * Enhanced thumbnail generation with quality optimization
 */
export async function generateThumbnail(params: any) {
  const {
    compositeKey,
    indexKey,
    datasetId,
    region,
    startDate,
    endDate,
    visParams = {},
    dimensions,
    width,
    height,
    quality = 'high',
    format = 'png'
  } = params;
  
  // Get quality settings
  const qualitySettings = getQualitySettings(quality);
  
  // Determine image source
  let image;
  let sourceType = 'unknown';
  let defaultBands;
  
  // Priority: Use stored results first
  if (indexKey && compositeStore[indexKey]) {
    image = compositeStore[indexKey];
    sourceType = 'index';
    // Index images are single band
    const indexType = indexKey.split('_')[0].toUpperCase();
    defaultBands = [indexType];
  } else if (compositeKey && compositeStore[compositeKey]) {
    image = compositeStore[compositeKey];
    sourceType = 'composite';
    
    // Determine bands based on dataset
    if (datasetId?.includes('COPERNICUS/S2')) {
      defaultBands = ['B4', 'B3', 'B2'];
    } else if (datasetId?.includes('LANDSAT')) {
      defaultBands = ['SR_B4', 'SR_B3', 'SR_B2'];
    }
  } else if (datasetId) {
    // Create new composite with optimizations
    let collection = new ee.ImageCollection(datasetId);
    
    if (startDate && endDate) {
      collection = collection.filterDate(startDate, endDate);
    }
    
    let geometry;
    if (region) {
      geometry = await parseAoi(region);
      collection = collection.filterBounds(geometry);
    }
    
    // Apply cloud masking for better quality
    if (datasetId.includes('COPERNICUS/S2')) {
      collection = collection
        .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 10)) // Stricter cloud filter
        .map((img: any) => {
          const qa = img.select('QA60');
          const cloudBitMask = 1 << 10;
          const cirrusBitMask = 1 << 11;
          const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
            .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
          
          // Apply scaling and enhance contrast
          let scaled = img.updateMask(mask).divide(10000);
          
          // Apply histogram equalization for better contrast
          if (qualitySettings.sharpen) {
            scaled = scaled.convolve(ee.Kernel.laplacian8()).add(scaled);
          }
          
          return scaled
            .select(['B.*'])
            .copyProperties(img, ['system:time_start']);
        });
      
      defaultBands = ['B4', 'B3', 'B2'];
    } else if (datasetId.includes('LANDSAT')) {
      collection = collection
        .filter(ee.Filter.lt('CLOUD_COVER', 10))
        .map((img: any) => {
          // Landsat cloud masking
          const qa = img.select('QA_PIXEL');
          const mask = qa.bitwiseAnd(1 << 3)
            .or(qa.bitwiseAnd(1 << 4))
            .eq(0);
          return img.updateMask(mask);
        });
      
      defaultBands = ['SR_B4', 'SR_B3', 'SR_B2'];
    }
    
    // Use percentile composite for better quality
    image = collection.reduce(ee.Reducer.percentile([30]));
    
    if (geometry) {
      image = image.clip(geometry);
    }
    
    sourceType = 'dataset';
  } else {
    throw new Error('No image source provided');
  }
  
  // Optimize visualization parameters
  const optimizedVis = optimizeVisualization(
    datasetId || '',
    visParams.bands || defaultBands,
    visParams
  );
  
  // Apply gamma from quality settings if not specified
  if (!optimizedVis.gamma) {
    optimizedVis.gamma = qualitySettings.gamma;
  }
  
  // Determine final dimensions
  const finalDimensions = dimensions || width || height || qualitySettings.dimensions;
  const maxSafeDimension = 2048; // Maximum safe dimension
  const actualDimension = Math.min(finalDimensions, maxSafeDimension);
  
  // Prepare thumbnail parameters
  const thumbParams: any = {
    dimensions: actualDimension,
    format: format || qualitySettings.format
  };
  
  // Add region if specified
  if (region) {
    const geometry = await parseAoi(region);
    thumbParams.region = geometry;
  }
  
  try {
    // Apply visualization to image
    let visualized;
    
    if (optimizedVis.palette && optimizedVis.bands?.length === 1) {
      // Single band with palette
      visualized = image.select(optimizedVis.bands).visualize({
        min: optimizedVis.min,
        max: optimizedVis.max,
        palette: optimizedVis.palette
      });
    } else {
      // Multi-band or RGB
      visualized = image.select(optimizedVis.bands || defaultBands).visualize({
        min: optimizedVis.min,
        max: optimizedVis.max,
        gamma: optimizedVis.gamma
      });
    }
    
    // Apply additional enhancements for ultra quality
    if (quality === 'ultra') {
      // Apply slight sharpening
      const kernel = ee.Kernel.gaussian({
        radius: 1,
        sigma: 0.5,
        magnitude: -0.5
      });
      visualized = visualized.convolve(kernel).add(visualized.multiply(1.1));
    }
    
    // Generate thumbnail URL
    const url = await visualized.getThumbURL(thumbParams);
    
    return {
      success: true,
      operation: 'thumbnail',
      url,
      metadata: {
        sourceType,
        quality,
        dimensions: actualDimension,
        format: format || qualitySettings.format,
        visualization: optimizedVis,
        region: region || 'global',
        dateRange: startDate && endDate ? { startDate, endDate } : null
      },
      message: `Generated ${quality} quality thumbnail (${actualDimension}px)`,
      tip: quality !== 'ultra' ? 'Use quality:"ultra" for maximum quality' : null
    };
    
  } catch (error: any) {
    // If thumbnail fails, try with lower quality
    if (quality === 'ultra' || quality === 'high') {
      console.log('Thumbnail failed at high quality, trying medium...');
      return generateThumbnail({ ...params, quality: 'medium' });
    }
    
    throw error;
  }
}

/**
 * Export image to Drive or GCS
 */
async function exportImage(params: any) {
  const {
    compositeKey,
    indexKey,
    datasetId,
    region,
    scale = 10,
    destination = 'drive',
    fileFormat = 'GeoTIFF',
    maxPixels = 1e9
  } = params;
  
  // Get image source
  let image;
  if (indexKey && compositeStore[indexKey]) {
    image = compositeStore[indexKey];
  } else if (compositeKey && compositeStore[compositeKey]) {
    image = compositeStore[compositeKey];
  } else {
    throw new Error('No image source provided for export');
  }
  
  // Parse region
  let geometry;
  if (region) {
    geometry = await parseAoi(region);
    image = image.clip(geometry);
  }
  
  // Create export task
  const fileName = `ee_export_${Date.now()}`;
  
  if (destination === 'drive') {
    const task = ee.batch.Export.image.toDrive({
      image: image,
      description: fileName,
      folder: 'EarthEngine',
      fileNamePrefix: fileName,
      scale: scale,
      region: geometry,
      fileFormat: fileFormat,
      maxPixels: maxPixels,
      crs: 'EPSG:4326'
    });
    
    task.start();
    
    return {
      success: true,
      operation: 'export',
      destination: 'drive',
      taskId: task.id,
      fileName,
      message: 'Export task started. Check Google Drive for results.',
      estimatedTime: 'Results typically available in 5-30 minutes depending on size'
    };
  } else {
    // GCS export
    return {
      success: false,
      error: 'GCS export not yet implemented',
      message: 'Please use destination:"drive" for now'
    };
  }
}

// Register the improved export tool
register({
  name: 'earth_engine_export',
  description: 'Export and visualize Earth Engine data with high-quality thumbnails',
  inputSchema: ExportToolSchema,
  handler: async (params: any) => {
    try {
      const { operation } = params;
      
      switch (operation) {
        case 'thumbnail':
          return await generateThumbnail(params);
          
        case 'export':
          return await exportImage(params);
          
        case 'tiles':
          return {
            success: false,
            error: 'Tiles operation not yet implemented',
            message: 'Use thumbnail operation for visualization'
          };
          
        case 'download':
          return {
            success: false,
            error: 'Download operation not yet implemented',
            message: 'Use export operation to save to Drive'
          };
          
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Export failed',
        details: error.stack
      };
    }
  }
});

export default ExportToolSchema;
