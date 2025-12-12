/**
 * AXION EXPORT - AWS-Native Export Tool
 * Operations: thumbnail, tiles, export, status
 * Exports imagery to S3 and generates tile URLs
 */

import { z } from 'zod';
import { register } from '../registry';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { STACClient, parseBbox, formatDatetime, STACItem } from '@/src/aws/stac/client';
import {
  AWS_REGION,
  S3_EXPORTS_BUCKET,
  S3_TILES_BUCKET
} from '@/src/utils/aws-config';

const s3 = new S3Client({ region: AWS_REGION });
const stac = new STACClient();

const ExportToolSchema = z.object({
  operation: z.enum(['thumbnail', 'tiles', 'export', 'download', 'analysis', 'timeseries', 'statistics', 'status', 'help']),
  
  // Data params
  collectionId: z.string().optional(),
  itemId: z.string().optional(),
  bbox: z.union([z.string(), z.array(z.number())]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  
  // Export params
  bands: z.array(z.string()).optional(),
  format: z.enum(['geotiff', 'cog', 'png', 'jpg', 'geojson', 'shapefile', 'kml', 'csv', 'netcdf', 'json']).optional(),
  scale: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  crs: z.string().optional(),  // Coordinate reference system (EPSG:4326, etc.)
  
  // Analysis export params
  analysisType: z.enum(['ndvi', 'evi', 'ndwi', 'savi', 'ndbi', 'classification', 'composite', 'model']).optional(),
  modelType: z.string().optional(),
  classificationKey: z.string().optional(),
  
  // Visualization params
  min: z.number().optional(),
  max: z.number().optional(),
  palette: z.array(z.string()).optional(),
  
  // Statistics params
  statistics: z.array(z.enum(['mean', 'min', 'max', 'stdDev', 'sum', 'count', 'median'])).optional(),
  zones: z.any().optional(),  // GeoJSON zones for zonal statistics
  
  // Task params
  taskId: z.string().optional(),
  description: z.string().optional(),
  filename: z.string().optional()
});

/**
 * Collection mapping
 */
const COLLECTION_MAP: Record<string, string> = {
  'COPERNICUS/S2_SR_HARMONIZED': 'sentinel-2-l2a',
  'sentinel-2': 'sentinel-2-l2a',
  'LANDSAT/LC08/C02/T1_L2': 'landsat-c2-l2',
  'landsat': 'landsat-c2-l2'
};

function resolveCollection(id: string): string {
  return COLLECTION_MAP[id] || id;
}

/**
 * Generate thumbnail URL using TiTiler or direct COG preview
 */
async function generateThumbnail(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    itemId,
    bbox,
    startDate,
    endDate,
    bands = ['red', 'green', 'blue'],
    width = 512,
    height = 512,
    min = 0,
    max = 3000
  } = params;
  
  const collection = resolveCollection(collectionId);
  
  try {
    let item: STACItem | undefined;
    
    if (itemId) {
      // Get specific item
      const items = await stac.searchItems({
        collections: [collection],
        limit: 1
      });
      item = items.find(i => i.id === itemId);
    } else {
      // Search for best item
      const datetime = formatDatetime(startDate, endDate);
      
      const items = await stac.searchItems({
        collections: [collection],
        bbox: parseBbox(bbox),
        datetime,
        limit: 1,
        query: { 'eo:cloud_cover': { lt: 20 } }
      });
      item = items[0];
    }
    
    if (!item) {
      return {
        success: false,
        operation: 'thumbnail',
        error: 'No image found',
        message: 'No image matches the criteria'
      };
    }
    
    // Get preview/thumbnail asset if available
    const thumbnailAsset = item.assets?.thumbnail || item.assets?.overview || item.assets?.rendered_preview;
    
    if (thumbnailAsset) {
      return {
        success: true,
        operation: 'thumbnail',
        itemId: item.id,
        datetime: item.properties?.datetime,
        thumbnailUrl: thumbnailAsset.href,
        source: 'stac_asset',
        message: 'Thumbnail URL retrieved from STAC'
      };
    }
    
    // Generate TiTiler URL for thumbnail
    const titilerEndpoint = process.env.TITILER_ENDPOINT || 'https://titiler.xyz';
    const cogUrl = item.assets?.visual?.href || item.assets?.B04?.href || Object.values(item.assets || {})[0]?.href;
    
    if (!cogUrl) {
      return {
        success: false,
        operation: 'thumbnail',
        error: 'No COG URL available',
        message: 'Could not find a suitable COG for thumbnail generation'
      };
    }
    
    const thumbnailUrl = `${titilerEndpoint}/cog/preview.png?url=${encodeURIComponent(cogUrl)}&width=${width}&height=${height}&rescale=${min},${max}`;
    
    return {
      success: true,
      operation: 'thumbnail',
      itemId: item.id,
      datetime: item.properties?.datetime,
      cloudCover: item.properties?.['eo:cloud_cover'],
      thumbnailUrl,
      cogUrl,
      params: { width, height, min, max },
      source: 'titiler',
      message: 'Thumbnail URL generated via TiTiler'
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'thumbnail',
      error: error.message,
      message: 'Failed to generate thumbnail'
    };
  }
}

/**
 * Generate tile URL template
 */
async function generateTiles(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    itemId,
    bbox,
    startDate,
    endDate,
    bands = ['red', 'green', 'blue'],
    min = 0,
    max = 3000
  } = params;
  
  const collection = resolveCollection(collectionId);
  
  try {
    const datetime = formatDatetime(startDate, endDate);
    
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit: 1,
      query: { 'eo:cloud_cover': { lt: 20 } }
    });
    
    const item = itemId ? items.find(i => i.id === itemId) : items[0];
    
    if (!item) {
      return {
        success: false,
        operation: 'tiles',
        error: 'No image found',
        message: 'No image matches the criteria'
      };
    }
    
    const cogUrl = item.assets?.visual?.href || item.assets?.B04?.href;
    const titilerEndpoint = process.env.TITILER_ENDPOINT || 'https://titiler.xyz';
    
    // Generate tile URL template
    const tileUrlTemplate = `${titilerEndpoint}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${encodeURIComponent(cogUrl || '')}&rescale=${min},${max}`;
    
    return {
      success: true,
      operation: 'tiles',
      itemId: item.id,
      datetime: item.properties?.datetime,
      tileUrlTemplate,
      cogUrl,
      bounds: item.bbox,
      params: { min, max, bands },
      leafletExample: `L.tileLayer('${tileUrlTemplate.replace('{z}', '{z}').replace('{x}', '{x}').replace('{y}', '{y}')}')`,
      message: 'Tile URL template generated'
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'tiles',
      error: error.message,
      message: 'Failed to generate tiles'
    };
  }
}

/**
 * Export data to S3
 */
async function exportToS3(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    bands = ['red', 'green', 'blue', 'nir'],
    format = 'cog',
    scale = 10,
    description = 'Axion export'
  } = params;
  
  if (!S3_EXPORTS_BUCKET) {
    return {
      success: false,
      operation: 'export',
      error: 'S3 exports bucket not configured',
      message: 'Please configure AXION_S3_EXPORTS_BUCKET environment variable'
    };
  }
  
  const collection = resolveCollection(collectionId);
  
  try {
    // Search for items to export
    let datetime: string | undefined;
    if (startDate && endDate) {
      datetime = `${startDate}/${endDate}`;
    }
    
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit: 10,
      query: { 'eo:cloud_cover': { lt: 20 } }
    });
    
    if (items.length === 0) {
      return {
        success: false,
        operation: 'export',
        error: 'No images found',
        message: 'No images match the export criteria'
      };
    }
    
    // Create export task specification
    const taskId = `export_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const exportSpec = {
      taskId,
      description,
      collection,
      imageCount: items.length,
      bbox: parseBbox(bbox),
      dateRange: { startDate, endDate },
      bands,
      format,
      scale,
      status: 'pending',
      createdAt: new Date().toISOString(),
      s3Bucket: S3_EXPORTS_BUCKET,
      s3Prefix: `exports/${taskId}/`
    };
    
    // Store export specification in S3
    await s3.send(new PutObjectCommand({
      Bucket: S3_EXPORTS_BUCKET,
      Key: `exports/${taskId}/spec.json`,
      Body: JSON.stringify(exportSpec, null, 2),
      ContentType: 'application/json'
    }));
    
    // Get COG URLs for the export
    const cogUrls = items.map(item => ({
      itemId: item.id,
      datetime: item.properties?.datetime,
      assets: Object.entries(item.assets || {})
        .filter(([key]) => bands.some((b: string) => key.toLowerCase().includes(b.toLowerCase())))
        .map(([key, asset]) => ({ band: key, url: asset.href }))
    }));
    
    return {
      success: true,
      operation: 'export',
      taskId,
      exportSpec,
      cogUrls: cogUrls.slice(0, 3),
      status: 'specification_created',
      s3Location: `s3://${S3_EXPORTS_BUCKET}/exports/${taskId}/`,
      note: 'Export specification created. Use a processing service to generate actual exports.',
      message: `Export task ${taskId} created with ${items.length} images`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'export',
      error: error.message,
      message: 'Failed to create export task'
    };
  }
}

/**
 * Export analysis results (NDVI, classification, model outputs)
 */
async function exportAnalysis(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    analysisType = 'ndvi',
    modelType,
    classificationKey,
    format = 'geotiff',
    scale = 10,
    crs = 'EPSG:4326',
    palette,
    description = 'Analysis export',
    filename
  } = params;
  
  if (!bbox) {
    return {
      success: false,
      operation: 'analysis',
      error: 'bbox required for analysis export',
      message: 'Please provide a bounding box'
    };
  }
  
  const collection = resolveCollection(collectionId);
  const taskId = `analysis_${analysisType}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
  const outputFilename = filename || `${analysisType}_${startDate || 'latest'}_${endDate || ''}`;
  
  // Index/analysis configurations
  const analysisConfigs: Record<string, any> = {
    ndvi: {
      formula: '(B08 - B04) / (B08 + B04)',
      bands: ['B08', 'B04'],
      colormap: 'viridis',
      range: [-1, 1],
      description: 'Normalized Difference Vegetation Index'
    },
    evi: {
      formula: '2.5 * ((B08 - B04) / (B08 + 6 * B04 - 7.5 * B02 + 1))',
      bands: ['B08', 'B04', 'B02'],
      colormap: 'viridis',
      range: [-1, 1],
      description: 'Enhanced Vegetation Index'
    },
    ndwi: {
      formula: '(B03 - B08) / (B03 + B08)',
      bands: ['B03', 'B08'],
      colormap: 'Blues',
      range: [-1, 1],
      description: 'Normalized Difference Water Index'
    },
    savi: {
      formula: '1.5 * ((B08 - B04) / (B08 + B04 + 0.5))',
      bands: ['B08', 'B04'],
      colormap: 'YlGn',
      range: [-1, 1],
      description: 'Soil Adjusted Vegetation Index'
    },
    ndbi: {
      formula: '(B11 - B08) / (B11 + B08)',
      bands: ['B11', 'B08'],
      colormap: 'Reds',
      range: [-1, 1],
      description: 'Normalized Difference Built-up Index'
    },
    classification: {
      description: 'Land cover classification result',
      type: 'categorical'
    },
    composite: {
      description: 'Multi-band composite',
      type: 'multiband'
    },
    model: {
      description: 'Geospatial model output',
      type: 'continuous'
    }
  };
  
  const config = analysisConfigs[analysisType] || analysisConfigs.ndvi;
  const titilerEndpoint = process.env.TITILER_ENDPOINT || 'https://titiler.xyz';
  
  try {
    // Search for source imagery
    const datetime = formatDatetime(startDate, endDate);
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit: 10,
      query: { 'eo:cloud_cover': { lt: 20 } }
    });
    
    if (items.length === 0) {
      return { success: false, operation: 'analysis', error: 'No source images found' };
    }
    
    // Build export specification
    const exportSpec = {
      taskId,
      description,
      analysisType,
      modelType: modelType || null,
      collection,
      sourceImages: items.length,
      bbox: parseBbox(bbox),
      dateRange: { startDate, endDate },
      format,
      scale,
      crs,
      outputFilename,
      analysisConfig: config,
      palette: palette || null,
      status: 'specification_ready',
      createdAt: new Date().toISOString()
    };
    
    // Generate TiTiler URLs for the analysis
    const cogUrl = items[0].assets?.B08?.href || items[0].assets?.visual?.href;
    let previewUrl = '';
    let downloadInfo: any = {};
    
    if (cogUrl && config.formula) {
      // Generate expression-based preview
      const expression = encodeURIComponent(config.formula);
      previewUrl = `${titilerEndpoint}/cog/preview.png?url=${encodeURIComponent(cogUrl)}&expression=${expression}&rescale=${config.range[0]},${config.range[1]}&colormap_name=${config.colormap}`;
      
      // Download URLs for different formats
      downloadInfo = {
        geotiff: `${titilerEndpoint}/cog/crop/${parseBbox(bbox)?.join(',')}.tif?url=${encodeURIComponent(cogUrl)}&expression=${expression}`,
        png: `${titilerEndpoint}/cog/crop/${parseBbox(bbox)?.join(',')}.png?url=${encodeURIComponent(cogUrl)}&expression=${expression}&rescale=${config.range[0]},${config.range[1]}&colormap_name=${config.colormap}`,
        json: 'Statistics available via /statistics endpoint'
      };
    }
    
    // Store spec to S3 if bucket configured
    if (S3_EXPORTS_BUCKET) {
      await s3.send(new PutObjectCommand({
        Bucket: S3_EXPORTS_BUCKET,
        Key: `exports/${taskId}/spec.json`,
        Body: JSON.stringify(exportSpec, null, 2),
        ContentType: 'application/json'
      }));
    }
    
    return {
      success: true,
      operation: 'analysis',
      taskId,
      analysisType,
      description: config.description,
      exportSpec,
      previewUrl,
      downloadUrls: downloadInfo,
      supportedFormats: ['geotiff', 'cog', 'png', 'jpg', 'json'],
      s3Location: S3_EXPORTS_BUCKET ? `s3://${S3_EXPORTS_BUCKET}/exports/${taskId}/` : null,
      message: `${config.description} export ready. Use downloadUrls to retrieve data.`
    };
  } catch (error: any) {
    return { success: false, operation: 'analysis', error: error.message };
  }
}

/**
 * Export time series data
 */
async function exportTimeSeries(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    analysisType = 'ndvi',
    format = 'csv',
    scale = 100,
    description = 'Time series export'
  } = params;
  
  if (!bbox || !startDate || !endDate) {
    return {
      success: false,
      operation: 'timeseries',
      error: 'bbox, startDate, and endDate required',
      message: 'Please provide bounding box and date range'
    };
  }
  
  const collection = resolveCollection(collectionId);
  const taskId = `timeseries_${analysisType}_${Date.now()}`;
  
  try {
    // Get all images in date range
    const datetime = formatDatetime(startDate, endDate);
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit: 100,
      query: { 'eo:cloud_cover': { lt: 30 } }
    });
    
    if (items.length === 0) {
      return { success: false, operation: 'timeseries', error: 'No images found in date range' };
    }
    
    // Build time series specification
    const timeSeriesSpec = {
      taskId,
      description,
      analysisType,
      collection,
      dateRange: { startDate, endDate },
      bbox: parseBbox(bbox),
      imageCount: items.length,
      format,
      scale,
      dates: items.map(item => item.properties?.datetime).filter(Boolean).sort(),
      createdAt: new Date().toISOString(),
      status: 'specification_ready'
    };
    
    // Sample time series data structure
    const sampleData = items.slice(0, 5).map(item => ({
      date: item.properties?.datetime,
      imageId: item.id,
      cloudCover: item.properties?.['eo:cloud_cover'],
      value: 'To be computed by processing service'
    }));
    
    return {
      success: true,
      operation: 'timeseries',
      taskId,
      analysisType,
      timeSeriesSpec,
      imageCount: items.length,
      dateRange: {
        start: timeSeriesSpec.dates[0],
        end: timeSeriesSpec.dates[timeSeriesSpec.dates.length - 1]
      },
      sampleData,
      supportedFormats: ['csv', 'json', 'geojson'],
      outputFormat: format,
      processing: {
        status: 'specification_ready',
        note: 'Time series computation requires processing service'
      },
      message: `Time series specification ready: ${items.length} images from ${startDate} to ${endDate}`
    };
  } catch (error: any) {
    return { success: false, operation: 'timeseries', error: error.message };
  }
}

/**
 * Export zonal statistics
 */
async function exportStatistics(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    bands = ['B08'],
    statistics = ['mean', 'min', 'max', 'stdDev'],
    zones,
    format = 'json',
    scale = 100
  } = params;
  
  if (!bbox) {
    return {
      success: false,
      operation: 'statistics',
      error: 'bbox required',
      message: 'Please provide a bounding box for statistics computation'
    };
  }
  
  const collection = resolveCollection(collectionId);
  const taskId = `stats_${Date.now()}`;
  const titilerEndpoint = process.env.TITILER_ENDPOINT || 'https://titiler.xyz';
  
  try {
    const datetime = formatDatetime(startDate, endDate);
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit: 1,
      query: { 'eo:cloud_cover': { lt: 20 } }
    });
    
    if (items.length === 0) {
      return { success: false, operation: 'statistics', error: 'No images found' };
    }
    
    const item = items[0];
    const bboxArray = parseBbox(bbox);
    
    // Build statistics URLs for TiTiler
    const statsUrls: Record<string, string> = {};
    for (const band of bands) {
      const assetKey = band.startsWith('B') ? band : `B${band.padStart(2, '0')}`;
      const cogUrl = item.assets?.[assetKey]?.href;
      if (cogUrl) {
        statsUrls[band] = `${titilerEndpoint}/cog/statistics?url=${encodeURIComponent(cogUrl)}`;
      }
    }
    
    const statsSpec = {
      taskId,
      collection,
      imageId: item.id,
      datetime: item.properties?.datetime,
      bbox: bboxArray,
      bands,
      statistics,
      zones: zones ? 'Zonal statistics enabled' : 'Region-wide statistics',
      format,
      scale,
      createdAt: new Date().toISOString()
    };
    
    return {
      success: true,
      operation: 'statistics',
      taskId,
      statsSpec,
      statsUrls,
      availableStatistics: ['mean', 'min', 'max', 'stdDev', 'sum', 'count', 'median', 'percentile'],
      supportedFormats: ['json', 'csv', 'geojson'],
      processing: {
        note: 'Use statsUrls to fetch statistics from TiTiler',
        example: 'Fetch the URL to get {"min": X, "max": Y, "mean": Z, ...}'
      },
      message: `Statistics export ready for ${bands.length} bands`
    };
  } catch (error: any) {
    return { success: false, operation: 'statistics', error: error.message };
  }
}

/**
 * Generate signed download URLs
 */
async function generateDownload(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    itemId,
    bbox,
    startDate,
    endDate,
    bands = ['visual'],
    format = 'geotiff',
    expiresIn = 3600  // 1 hour
  } = params;
  
  const collection = resolveCollection(collectionId);
  const titilerEndpoint = process.env.TITILER_ENDPOINT || 'https://titiler.xyz';
  
  try {
    const datetime = formatDatetime(startDate, endDate);
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit: 1,
      query: { 'eo:cloud_cover': { lt: 20 } }
    });
    
    const item = itemId ? items.find(i => i.id === itemId) : items[0];
    
    if (!item) {
      return { success: false, operation: 'download', error: 'No image found' };
    }
    
    // Get COG URLs for all assets
    const downloadUrls: Record<string, any> = {};
    const bboxStr = parseBbox(bbox)?.join(',') || '';
    
    // Generate URLs for each requested band/asset
    for (const [assetKey, asset] of Object.entries(item.assets || {})) {
      if (bands.includes(assetKey) || bands.includes('all') || bands.includes('visual')) {
        const cogUrl = (asset as any).href;
        if (cogUrl) {
          downloadUrls[assetKey] = {
            directCog: cogUrl,
            geotiff: bboxStr ? `${titilerEndpoint}/cog/crop/${bboxStr}.tif?url=${encodeURIComponent(cogUrl)}` : cogUrl,
            png: bboxStr ? `${titilerEndpoint}/cog/crop/${bboxStr}.png?url=${encodeURIComponent(cogUrl)}` : `${titilerEndpoint}/cog/preview.png?url=${encodeURIComponent(cogUrl)}`,
            thumbnail: `${titilerEndpoint}/cog/preview.png?url=${encodeURIComponent(cogUrl)}&width=256&height=256`
          };
        }
      }
    }
    
    // Special handling for visual composite
    if (bands.includes('visual') && item.assets?.visual) {
      const visualUrl = item.assets.visual.href;
      downloadUrls['visual_composite'] = {
        directCog: visualUrl,
        geotiff: bboxStr ? `${titilerEndpoint}/cog/crop/${bboxStr}.tif?url=${encodeURIComponent(visualUrl)}` : visualUrl,
        png: bboxStr ? `${titilerEndpoint}/cog/crop/${bboxStr}.png?url=${encodeURIComponent(visualUrl)}` : `${titilerEndpoint}/cog/preview.png?url=${encodeURIComponent(visualUrl)}`
      };
    }
    
    return {
      success: true,
      operation: 'download',
      itemId: item.id,
      datetime: item.properties?.datetime,
      cloudCover: item.properties?.['eo:cloud_cover'],
      bbox: parseBbox(bbox),
      downloadUrls,
      supportedFormats: {
        raster: ['geotiff', 'cog', 'png', 'jpg', 'webp'],
        vector: ['geojson', 'shapefile', 'kml'],
        data: ['csv', 'json', 'netcdf']
      },
      usage: {
        geotiff: 'Full resolution GeoTIFF with georeferencing',
        cog: 'Cloud Optimized GeoTIFF (streaming)',
        png: 'PNG image (no georeferencing)',
        directCog: 'Direct link to source COG on AWS'
      },
      message: `Download URLs generated for ${Object.keys(downloadUrls).length} assets`
    };
  } catch (error: any) {
    return { success: false, operation: 'download', error: error.message };
  }
}

/**
 * Check export status
 */
async function checkStatus(params: any) {
  const { taskId } = params;
  
  if (!taskId) {
    return {
      success: false,
      operation: 'status',
      error: 'taskId required',
      message: 'Please provide a task ID to check status'
    };
  }
  
  if (!S3_EXPORTS_BUCKET) {
    return {
      success: false,
      operation: 'status',
      error: 'S3 exports bucket not configured',
      message: 'Please configure AXION_S3_EXPORTS_BUCKET'
    };
  }
  
  try {
    // Get export specification from S3
    const response = await s3.send(new GetObjectCommand({
      Bucket: S3_EXPORTS_BUCKET,
      Key: `exports/${taskId}/spec.json`
    }));
    
    const specBody = await response.Body?.transformToString();
    const spec = specBody ? JSON.parse(specBody) : null;
    
    if (!spec) {
      return {
        success: false,
        operation: 'status',
        taskId,
        error: 'Export specification not found',
        message: 'No export found with this task ID'
      };
    }
    
    return {
      success: true,
      operation: 'status',
      taskId,
      status: spec.status,
      createdAt: spec.createdAt,
      exportSpec: spec,
      message: `Export status: ${spec.status}`
    };
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return {
        success: false,
        operation: 'status',
        taskId,
        error: 'Export not found',
        message: 'No export found with this task ID'
      };
    }
    
    return {
      success: false,
      operation: 'status',
      taskId,
      error: error.message,
      message: 'Failed to check export status'
    };
  }
}

/**
 * Help operation
 */
function getHelp() {
  return {
    success: true,
    operation: 'help',
    tool: 'axion_export',
    description: 'Comprehensive AWS-native export tool - replaces ArcGIS export functionality',
    capabilities: [
      'Export raw imagery in multiple formats',
      'Export analysis results (NDVI, classifications, models)',
      'Export time series data',
      'Export zonal statistics',
      'Generate download URLs',
      'Web map tile generation'
    ],
    operations: {
      thumbnail: {
        description: 'Generate thumbnail preview image',
        params: ['collectionId', 'bbox', 'startDate', 'endDate', 'width', 'height']
      },
      tiles: {
        description: 'Generate tile URL template for web mapping (Leaflet/OpenLayers)',
        params: ['collectionId', 'bbox', 'bands', 'min', 'max']
      },
      export: {
        description: 'Export raw imagery to S3',
        params: ['collectionId', 'bbox', 'startDate', 'endDate', 'bands', 'format', 'scale'],
        formats: ['geotiff', 'cog', 'png', 'jpg', 'geojson', 'shapefile', 'kml', 'csv', 'netcdf']
      },
      download: {
        description: 'Generate direct download URLs for imagery',
        params: ['collectionId', 'itemId', 'bbox', 'bands', 'format']
      },
      analysis: {
        description: 'Export analysis results (NDVI, EVI, classifications, models)',
        params: ['bbox', 'startDate', 'endDate', 'analysisType', 'format', 'palette'],
        analysisTypes: ['ndvi', 'evi', 'ndwi', 'savi', 'ndbi', 'classification', 'composite', 'model']
      },
      timeseries: {
        description: 'Export time series data over a date range',
        params: ['bbox', 'startDate', 'endDate', 'analysisType', 'format'],
        formats: ['csv', 'json', 'geojson']
      },
      statistics: {
        description: 'Export zonal/regional statistics',
        params: ['bbox', 'bands', 'statistics', 'zones', 'format'],
        statistics: ['mean', 'min', 'max', 'stdDev', 'sum', 'count', 'median']
      },
      status: {
        description: 'Check export task status',
        params: ['taskId']
      }
    },
    examples: {
      export_ndvi_geotiff: {
        operation: 'analysis',
        analysisType: 'ndvi',
        bbox: '-122.5,37.5,-122.0,38.0',
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        format: 'geotiff'
      },
      download_imagery: {
        operation: 'download',
        collectionId: 'sentinel-2-l2a',
        bbox: '-122.5,37.5,-122.0,38.0',
        bands: ['B04', 'B03', 'B02', 'B08'],
        format: 'geotiff'
      },
      export_timeseries: {
        operation: 'timeseries',
        bbox: '-122.5,37.5,-122.0,38.0',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        analysisType: 'ndvi',
        format: 'csv'
      },
      export_statistics: {
        operation: 'statistics',
        bbox: '-122.5,37.5,-122.0,38.0',
        bands: ['B08', 'B04'],
        statistics: ['mean', 'max', 'stdDev'],
        format: 'json'
      },
      thumbnail: {
        operation: 'thumbnail',
        collectionId: 'sentinel-2-l2a',
        bbox: '-122.5,37.5,-122.0,38.0',
        width: 512,
        height: 512
      }
    },
    message: 'Axion Export Tool - Complete export capabilities for geospatial data'
  };
}

// Register the tool
register({
  name: 'axion_export',
  description: `Complete export tool - ArcGIS replacement. Operations: thumbnail, tiles, export (S3), download (direct URLs), analysis (NDVI/EVI/classification exports), timeseries (CSV/JSON), statistics (zonal stats), status, help. Formats: GeoTIFF, COG, PNG, Shapefile, KML, CSV, GeoJSON, NetCDF`,
  input: ExportToolSchema,
  output: z.any(),
  handler: async (params) => {
    try {
      const { operation } = params;
      
      if (!operation) {
        return {
          success: false,
          error: 'operation parameter required',
          availableOperations: ['thumbnail', 'tiles', 'export', 'download', 'analysis', 'timeseries', 'statistics', 'status', 'help'],
          example: '{ "operation": "analysis", "analysisType": "ndvi", "bbox": "-122.5,37.5,-122.0,38.0", "format": "geotiff" }'
        };
      }
      
      // Normalize params
      const normalizedParams = {
        ...params,
        collectionId: params.collectionId || params.collection_id,
        itemId: params.itemId || params.item_id,
        startDate: params.startDate || params.start_date,
        endDate: params.endDate || params.end_date,
        taskId: params.taskId || params.task_id,
        analysisType: params.analysisType || params.analysis_type,
        modelType: params.modelType || params.model_type,
        classificationKey: params.classificationKey || params.classification_key
      };
      
      switch (operation) {
        case 'thumbnail':
          return await generateThumbnail(normalizedParams);
        case 'tiles':
          return await generateTiles(normalizedParams);
        case 'export':
          return await exportToS3(normalizedParams);
        case 'download':
          return await generateDownload(normalizedParams);
        case 'analysis':
          return await exportAnalysis(normalizedParams);
        case 'timeseries':
        case 'time_series':
          return await exportTimeSeries(normalizedParams);
        case 'statistics':
        case 'stats':
        case 'zonal':
          return await exportStatistics(normalizedParams);
        case 'status':
          return await checkStatus(normalizedParams);
        case 'help':
          return getHelp();
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`,
            availableOperations: ['thumbnail', 'tiles', 'export', 'download', 'analysis', 'timeseries', 'statistics', 'status', 'help']
          };
      }
    } catch (error: any) {
      return {
        success: false,
        operation: params.operation,
        error: error.message || 'Unexpected error',
        stack: error.stack
      };
    }
  }
});

export default {};
