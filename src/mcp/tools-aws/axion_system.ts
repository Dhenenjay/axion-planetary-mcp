/**
 * AXION SYSTEM - AWS-Native System & Health Check Tool
 * Operations: health, info, config, boundary, help
 */

import { z } from 'zod';
import { register } from '../registry';
import { S3Client, HeadBucketCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';
import { DynamoDBClient, DescribeTableCommand } from '@aws-sdk/client-dynamodb';
import axios from 'axios';
import {
  AWS_REGION,
  STAC_ENDPOINT,
  S3_EXPORTS_BUCKET,
  S3_TILES_BUCKET,
  S3_BOUNDARIES_BUCKET,
  DYNAMODB_SESSIONS_TABLE,
  DYNAMODB_TASKS_TABLE,
  DYNAMODB_BOUNDARIES_TABLE,
  DYNAMODB_CACHE_TABLE
} from '@/src/utils/aws-config';

const s3 = new S3Client({ region: AWS_REGION });
const dynamodb = new DynamoDBClient({ region: AWS_REGION });

const SystemToolSchema = z.object({
  operation: z.enum(['health', 'info', 'config', 'boundary', 'dataset_info', 'help']),
  
  // Boundary params
  placeName: z.string().optional(),
  boundaryType: z.enum(['country', 'state', 'district']).optional(),
  
  // Config params
  configKey: z.string().optional(),
  
  // Dataset info params
  datasetId: z.string().optional(),
  collectionId: z.string().optional()
});

/**
 * Check if S3 bucket exists and is accessible
 */
async function checkBucket(bucketName: string): Promise<{ accessible: boolean; error?: string }> {
  if (!bucketName) return { accessible: false, error: 'Bucket name not configured' };
  
  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
    return { accessible: true };
  } catch (error: any) {
    return { accessible: false, error: error.message };
  }
}

/**
 * Check if DynamoDB table exists and is accessible
 */
async function checkTable(tableName: string): Promise<{ accessible: boolean; status?: string; error?: string }> {
  if (!tableName) return { accessible: false, error: 'Table name not configured' };
  
  try {
    const response = await dynamodb.send(new DescribeTableCommand({ TableName: tableName }));
    return { accessible: true, status: response.Table?.TableStatus };
  } catch (error: any) {
    return { accessible: false, error: error.message };
  }
}

/**
 * Check STAC endpoint availability
 */
async function checkStac(): Promise<{ accessible: boolean; collections?: number; error?: string }> {
  try {
    const response = await axios.get(`${STAC_ENDPOINT}/collections`, { timeout: 10000 });
    const collections = response.data?.collections?.length || 0;
    return { accessible: true, collections };
  } catch (error: any) {
    return { accessible: false, error: error.message };
  }
}

/**
 * Health operation - comprehensive system health check
 */
async function checkHealth() {
  const startTime = Date.now();
  
  // Run all checks in parallel
  const [
    exportsBucket,
    tilesBucket,
    boundariesBucket,
    sessionsTable,
    tasksTable,
    boundariesTable,
    cacheTable,
    stacEndpoint
  ] = await Promise.all([
    checkBucket(S3_EXPORTS_BUCKET),
    checkBucket(S3_TILES_BUCKET),
    checkBucket(S3_BOUNDARIES_BUCKET),
    checkTable(DYNAMODB_SESSIONS_TABLE),
    checkTable(DYNAMODB_TASKS_TABLE),
    checkTable(DYNAMODB_BOUNDARIES_TABLE),
    checkTable(DYNAMODB_CACHE_TABLE),
    checkStac()
  ]);
  
  const duration = Date.now() - startTime;
  
  // Determine overall status
  const s3Healthy = exportsBucket.accessible && tilesBucket.accessible && boundariesBucket.accessible;
  const dynamoHealthy = sessionsTable.accessible && tasksTable.accessible && boundariesTable.accessible && cacheTable.accessible;
  const stacHealthy = stacEndpoint.accessible;
  
  const overallStatus = s3Healthy && dynamoHealthy && stacHealthy ? 'healthy' : 
                       (stacHealthy ? 'degraded' : 'unhealthy');
  
  return {
    success: true,
    operation: 'health',
    status: overallStatus,
    timestamp: new Date().toISOString(),
    checkDurationMs: duration,
    components: {
      s3: {
        status: s3Healthy ? 'healthy' : 'unhealthy',
        buckets: {
          exports: { name: S3_EXPORTS_BUCKET, ...exportsBucket },
          tiles: { name: S3_TILES_BUCKET, ...tilesBucket },
          boundaries: { name: S3_BOUNDARIES_BUCKET, ...boundariesBucket }
        }
      },
      dynamodb: {
        status: dynamoHealthy ? 'healthy' : 'unhealthy',
        tables: {
          sessions: { name: DYNAMODB_SESSIONS_TABLE, ...sessionsTable },
          tasks: { name: DYNAMODB_TASKS_TABLE, ...tasksTable },
          boundaries: { name: DYNAMODB_BOUNDARIES_TABLE, ...boundariesTable },
          cache: { name: DYNAMODB_CACHE_TABLE, ...cacheTable }
        }
      },
      stac: {
        status: stacHealthy ? 'healthy' : 'unhealthy',
        endpoint: STAC_ENDPOINT,
        ...stacEndpoint
      }
    },
    message: overallStatus === 'healthy' 
      ? 'All systems operational'
      : `System ${overallStatus}: check component details`
  };
}

/**
 * Info operation - system information
 */
async function getSystemInfo() {
  return {
    success: true,
    operation: 'info',
    system: {
      name: 'Axion AWS',
      version: '1.0.0',
      platform: 'AWS',
      region: AWS_REGION
    },
    infrastructure: {
      dataSource: 'Element84 Earth Search STAC',
      stacEndpoint: STAC_ENDPOINT,
      storage: 'Amazon S3',
      database: 'Amazon DynamoDB',
      processing: 'AWS Lambda / ECS (planned)'
    },
    capabilities: [
      'Satellite imagery search (Sentinel-2, Landsat, etc.)',
      'Cloud-optimized GeoTIFF access',
      'Vegetation indices computation',
      'Time series analysis',
      'Export to S3',
      'Tile serving'
    ],
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
      memory: {
        used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`
      }
    },
    message: 'System information retrieved'
  };
}

/**
 * Config operation - show current configuration
 */
async function getConfig(configKey?: string) {
  const config = {
    aws: {
      region: AWS_REGION,
      exportsBucket: S3_EXPORTS_BUCKET,
      tilesBucket: S3_TILES_BUCKET,
      boundariesBucket: S3_BOUNDARIES_BUCKET
    },
    dynamodb: {
      sessionsTable: DYNAMODB_SESSIONS_TABLE,
      tasksTable: DYNAMODB_TASKS_TABLE,
      boundariesTable: DYNAMODB_BOUNDARIES_TABLE,
      cacheTable: DYNAMODB_CACHE_TABLE
    },
    stac: {
      endpoint: STAC_ENDPOINT
    }
  };
  
  if (configKey) {
    const keys = configKey.split('.');
    let value: any = config;
    for (const k of keys) {
      value = value?.[k];
    }
    return {
      success: true,
      operation: 'config',
      key: configKey,
      value: value ?? 'not found',
      message: `Configuration value for ${configKey}`
    };
  }
  
  return {
    success: true,
    operation: 'config',
    configuration: config,
    message: 'Current configuration'
  };
}

/**
 * Boundary operation - load boundary by place name
 */
async function loadBoundary(params: any) {
  const { placeName, boundaryType = 'district' } = params;
  
  if (!placeName) {
    return {
      success: false,
      operation: 'boundary',
      error: 'placeName required',
      message: 'Please provide a place name to look up'
    };
  }
  
  // Common place coordinates as fallback
  const knownPlaces: Record<string, { bbox: [number, number, number, number]; type: string }> = {
    'ludhiana': { bbox: [75.7, 30.8, 76.0, 31.0], type: 'district' },
    'san francisco': { bbox: [-122.52, 37.7, -122.35, 37.82], type: 'city' },
    'new york': { bbox: [-74.26, 40.49, -73.7, 40.92], type: 'city' },
    'london': { bbox: [-0.51, 51.28, 0.33, 51.69], type: 'city' },
    'delhi': { bbox: [76.84, 28.4, 77.35, 28.88], type: 'district' },
    'mumbai': { bbox: [72.77, 18.89, 72.99, 19.27], type: 'city' },
    'california': { bbox: [-124.48, 32.53, -114.13, 42.01], type: 'state' },
    'texas': { bbox: [-106.65, 25.84, -93.51, 36.5], type: 'state' },
    'india': { bbox: [68.18, 6.75, 97.4, 35.5], type: 'country' },
    'united states': { bbox: [-125.0, 24.4, -66.93, 49.38], type: 'country' }
  };
  
  const placeKey = placeName.toLowerCase().trim();
  const place = knownPlaces[placeKey];
  
  if (place) {
    return {
      success: true,
      operation: 'boundary',
      placeName,
      boundaryType: place.type,
      bbox: place.bbox,
      geometry: {
        type: 'Polygon',
        coordinates: [[
          [place.bbox[0], place.bbox[1]],
          [place.bbox[2], place.bbox[1]],
          [place.bbox[2], place.bbox[3]],
          [place.bbox[0], place.bbox[3]],
          [place.bbox[0], place.bbox[1]]
        ]]
      },
      source: 'known-places',
      message: `Boundary found for ${placeName}`,
      usage: 'Use bbox in search/filter operations'
    };
  }
  
  // TODO: Look up in S3/DynamoDB boundary index
  return {
    success: false,
    operation: 'boundary',
    placeName,
    error: 'Boundary not found',
    message: `No boundary data found for "${placeName}"`,
    suggestion: 'Try common place names like "San Francisco", "California", "India"'
  };
}

/**
 * Dataset info operation - get detailed info about STAC collections
 */
async function getDatasetInfo(params: any) {
  const { datasetId, collectionId } = params;
  const id = datasetId || collectionId;
  
  if (!id) {
    return {
      success: false,
      operation: 'dataset_info',
      error: 'datasetId or collectionId required',
      message: 'Please provide a dataset/collection ID',
      examples: ['sentinel-2-l2a', 'landsat-c2-l2', 'sentinel-1-grd', 'cop-dem-glo-30']
    };
  }
  
  // Collection mapping (GEE style to STAC)
  const collectionMap: Record<string, string> = {
    'COPERNICUS/S2_SR_HARMONIZED': 'sentinel-2-l2a',
    'COPERNICUS/S2_SR': 'sentinel-2-l2a',
    'LANDSAT/LC09/C02/T1_L2': 'landsat-c2-l2',
    'LANDSAT/LC08/C02/T1_L2': 'landsat-c2-l2',
    'COPERNICUS/S1_GRD': 'sentinel-1-grd'
  };
  
  const resolvedId = collectionMap[id] || id;
  
  // Known dataset metadata
  const knownDatasets: Record<string, any> = {
    'sentinel-2-l2a': {
      title: 'Sentinel-2 Level-2A',
      description: 'Surface reflectance data from Sentinel-2 MSI',
      provider: 'European Space Agency (ESA)',
      spatialResolution: '10-60m',
      temporalResolution: '5 days',
      bands: ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B8A', 'B09', 'B11', 'B12', 'SCL'],
      bandDescriptions: {
        'B02': 'Blue (490nm)',
        'B03': 'Green (560nm)',
        'B04': 'Red (665nm)',
        'B08': 'NIR (842nm)',
        'B11': 'SWIR-1 (1610nm)',
        'B12': 'SWIR-2 (2190nm)',
        'SCL': 'Scene Classification'
      },
      useCases: ['Vegetation monitoring', 'Land cover', 'Agriculture', 'Water quality']
    },
    'landsat-c2-l2': {
      title: 'Landsat Collection 2 Level-2',
      description: 'Surface reflectance and temperature from Landsat 8/9',
      provider: 'USGS',
      spatialResolution: '30m',
      temporalResolution: '16 days',
      bands: ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'ST_B10', 'QA_PIXEL'],
      bandDescriptions: {
        'SR_B2': 'Blue',
        'SR_B3': 'Green',
        'SR_B4': 'Red',
        'SR_B5': 'NIR',
        'SR_B6': 'SWIR-1',
        'SR_B7': 'SWIR-2',
        'ST_B10': 'Thermal'
      },
      useCases: ['Long-term monitoring', 'Land use change', 'Temperature analysis']
    },
    'sentinel-1-grd': {
      title: 'Sentinel-1 GRD',
      description: 'C-band SAR Ground Range Detected',
      provider: 'European Space Agency (ESA)',
      spatialResolution: '10m',
      temporalResolution: '6-12 days',
      bands: ['VV', 'VH'],
      polarizations: ['VV', 'VH', 'HH', 'HV'],
      useCases: ['Flood mapping', 'Ship detection', 'Deforestation', 'Soil moisture']
    },
    'cop-dem-glo-30': {
      title: 'Copernicus DEM GLO-30',
      description: 'Global 30m Digital Elevation Model',
      provider: 'ESA/Copernicus',
      spatialResolution: '30m',
      bands: ['elevation'],
      useCases: ['Terrain analysis', 'Flood modeling', 'Viewshed analysis']
    },
    'naip': {
      title: 'NAIP Aerial Imagery',
      description: 'National Agriculture Imagery Program',
      provider: 'USDA',
      spatialResolution: '0.6-1m',
      coverage: 'United States only',
      bands: ['red', 'green', 'blue', 'nir'],
      useCases: ['High-resolution mapping', 'Urban planning', 'Agriculture']
    }
  };
  
  const info = knownDatasets[resolvedId];
  
  if (info) {
    return {
      success: true,
      operation: 'dataset_info',
      datasetId: resolvedId,
      originalId: id !== resolvedId ? id : undefined,
      ...info,
      stacEndpoint: STAC_ENDPOINT,
      stacCollectionUrl: `${STAC_ENDPOINT}/collections/${resolvedId}`,
      message: `Dataset information for ${info.title}`
    };
  }
  
  // Try to fetch from STAC
  try {
    const response = await axios.get(`${STAC_ENDPOINT}/collections/${resolvedId}`, { timeout: 10000 });
    const collection = response.data;
    
    return {
      success: true,
      operation: 'dataset_info',
      datasetId: resolvedId,
      title: collection.title,
      description: collection.description,
      extent: collection.extent,
      license: collection.license,
      stacEndpoint: STAC_ENDPOINT,
      message: `Dataset information for ${collection.title || resolvedId}`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'dataset_info',
      datasetId: resolvedId,
      error: `Collection not found: ${resolvedId}`,
      suggestion: 'Try: sentinel-2-l2a, landsat-c2-l2, sentinel-1-grd, cop-dem-glo-30, naip'
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
    tool: 'axion_system',
    description: 'AWS-native system and health check tool',
    operations: {
      health: {
        description: 'Check health of all AWS services (S3, DynamoDB, STAC)',
        example: { operation: 'health' }
      },
      info: {
        description: 'Get system information and capabilities',
        example: { operation: 'info' }
      },
      config: {
        description: 'View current configuration',
        example: { operation: 'config', configKey: 'aws.region' }
      },
      boundary: {
        description: 'Load administrative boundary by place name',
        example: { operation: 'boundary', placeName: 'San Francisco' }
      },
      dataset_info: {
        description: 'Get detailed information about a STAC collection/dataset',
        example: { operation: 'dataset_info', datasetId: 'sentinel-2-l2a' },
        availableDatasets: ['sentinel-2-l2a', 'landsat-c2-l2', 'sentinel-1-grd', 'cop-dem-glo-30', 'naip']
      },
      help: {
        description: 'Show this help message',
        example: { operation: 'help' }
      }
    },
    message: 'Axion System Tool Help'
  };
}

// Register the tool
register({
  name: 'axion_system',
  description: `AWS-native system tool. Operations: health (check AWS services), info (system info), config (view config), boundary (load boundaries), dataset_info (collection details), help`,
  input: SystemToolSchema,
  output: z.any(),
  handler: async (params) => {
    try {
      const { operation } = params;
      
      if (!operation) {
        return {
          success: false,
          error: 'operation parameter required',
          availableOperations: ['health', 'info', 'config', 'boundary', 'dataset_info', 'help'],
          example: '{ "operation": "health" }'
        };
      }
      
      switch (operation) {
        case 'health':
          return await checkHealth();
        case 'info':
          return await getSystemInfo();
        case 'config':
          return await getConfig(params.configKey);
        case 'boundary':
          return await loadBoundary(params);
        case 'dataset_info':
        case 'dataset':
          return await getDatasetInfo(params);
        case 'help':
          return getHelp();
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`,
            availableOperations: ['health', 'info', 'config', 'boundary', 'dataset_info', 'help']
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
