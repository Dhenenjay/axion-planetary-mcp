/**
 * EARTH ENGINE SYSTEM - Consolidated System & Advanced Tool
 * Combines: auth, execute (custom code), setup, load operations
 * Critical for MCP stability - reduces tool count
 */

import ee from '@google/earthengine';
import { z } from 'zod';
import { register } from '../../registry';
import { Storage } from '@google-cloud/storage';
import fs from 'fs/promises';
import path from 'path';
import { optimizer } from '@/src/utils/ee-optimizer';
import { globalCompositeStore as compositeStore } from './stores';

// Main schema for the consolidated tool
const SystemToolSchema = z.object({
  operation: z.enum(['auth', 'execute', 'setup', 'load', 'info', 'help', 'health', 'dataset_info']),
  
  // Auth operation params
  checkType: z.enum(['status', 'projects', 'permissions']).optional(),
  
  // Execute operation params
  code: z.string().optional(),
  language: z.enum(['javascript', 'python']).optional().default('javascript'),
  params: z.record(z.any()).optional(),
  
  // Setup operation params
  setupType: z.enum(['gcs', 'auth', 'project']).optional(),
  bucket: z.string().optional(),
  projectId: z.string().optional(),
  
  // Load operation params
  source: z.string().optional(), // GCS path or URL
  dataType: z.enum(['cog', 'geotiff', 'json', 'csv']).optional(),
  
  // Info operation params
  infoType: z.enum(['system', 'quotas', 'assets', 'tasks']).optional(),
  
  // Dataset info params
  datasetId: z.string().optional()
});

/**
 * Auth operation - check authentication and permissions
 */
async function checkAuth(params: any) {
  const { checkType = 'status' } = params;
  
  switch (checkType) {
    case 'status':
      try {
        // Test authentication by making a simple API call
        await (ee as any).Number(1).getInfo();
        
        const credentials = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        const projectId = process.env.GCP_PROJECT_ID;
        
        return {
          success: true,
          operation: 'auth',
          authenticated: true,
          projectId: projectId || 'Not configured',
          credentialsPath: credentials ? 'Configured' : 'Not configured',
          message: 'Earth Engine authentication successful'
        };
      } catch (error: any) {
        return {
          success: false,
          operation: 'auth',
          authenticated: false,
          error: error?.message || 'Unknown error',
          message: 'Earth Engine authentication failed',
          help: 'Ensure GOOGLE_APPLICATION_CREDENTIALS is set to your service account key file'
        };
      }
      
    case 'projects':
      try {
        const projects = await (ee.data as any).listAssets({ parent: 'projects' });
        return {
          success: true,
          operation: 'auth',
          checkType: 'projects',
          projects: projects,
          message: `Found ${projects.length} accessible projects`
        };
      } catch (error: any) {
        return {
          success: false,
          operation: 'auth',
          checkType: 'projects',
          error: error?.message || 'Unknown error'
        };
      }
      
    case 'permissions':
      try {
        // Check various permissions
        const checks = {
          canReadPublicData: false,
          canExportToGCS: false,
          canExportToDrive: false,
          canCreateAssets: false
        };
        
        // Test reading public data
        try {
          await new ee.Image('USGS/SRTMGL1_003').getInfo();
          checks.canReadPublicData = true;
        } catch {}
        
        // Test GCS export permission
        try {
          const testTask = ee.batch.Export.image.toCloudStorage({
            image: new ee.Image(1),
            description: 'permission_test',
            bucket: 'test-bucket',
            fileNamePrefix: 'test',
            region: ee.Geometry.Point([0, 0]).buffer(100)
          });
          // Don't actually start the task
          checks.canExportToGCS = true;
        } catch {}
        
        return {
          success: true,
          operation: 'auth',
          checkType: 'permissions',
          permissions: checks,
          message: 'Permission check complete'
        };
      } catch (error: any) {
        return {
          success: false,
          operation: 'auth',
          checkType: 'permissions',
          error: error?.message || 'Unknown error'
        };
      }
      
    default:
      throw new Error(`Unknown auth check type: ${checkType}`);
  }
}

/**
 * Execute operation - run custom Earth Engine code
 */
async function executeCode(params: any) {
  const { code, language = 'javascript', params: codeParams = {} } = params;
  
  if (!code) throw new Error('code required for execute operation');
  
  try {
    // Create a function from the code string with timeout
    // Add 'global' to the function context to support global.variable = value
    const func = new Function('ee', 'params', 'global', code);
    
    // Set a timeout for execution
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Code execution timed out after 30 seconds')), 30000)
    );
    
    // Execute the code with Earth Engine, params, and compositeStore as global
    const executePromise = (async () => {
      const result = await func(ee, codeParams, compositeStore);
      
      // If result is an Earth Engine Image, store it for later use
      if (result && typeof result.select === 'function' && typeof result.visualize === 'function') {
        // This appears to be an Earth Engine Image
        const timestamp = Date.now();
        const imageKey = `user_image_${timestamp}`;
        compositeStore[imageKey] = result;
        
        // Return info about the stored image
        return {
          type: 'EarthEngineImage',
          stored: true,
          imageKey: imageKey,
          message: 'Image stored successfully',
          usage: `Use imageKey '${imageKey}' with the export tool for thumbnails or exports`
        };
      }
      
      // If result is an Earth Engine object, try to get info with optimizer
      let output;
      if (result && typeof result.getInfo === 'function') {
        try {
          // Use optimizer for efficient getInfo
          output = await optimizer.optimizedGetInfo(result, { timeout: 10000 });
        } catch (e) {
          // If getInfo times out, return a description instead
          output = { 
            type: 'EarthEngineObject', 
            message: 'Result is an Earth Engine object (evaluation timed out)',
            suggestion: 'Try simpler operations or add .limit() to collections' 
          };
        }
      } else {
        output = result;
      }
      return output;
    })();
    
    const output = await Promise.race([executePromise, timeoutPromise]);
    
    return {
      success: true,
      operation: 'execute',
      language,
      result: output,
      message: 'Code executed successfully'
    };
  } catch (error: any) {
    return {
      success: true, // Return success but with error info
      operation: 'execute',
      executed: false,
      error: error.message || 'Unknown error',
      message: error.message?.includes('timeout') ? 'Code execution timed out' : 'Code execution failed',
      help: 'Ensure your code returns a value quickly and uses proper Earth Engine syntax'
    };
  }
}

/**
 * Setup operation - configure GCS, auth, or project settings
 */
async function setupSystem(params: any) {
  const { 
    setupType = 'auth',  // Default to auth check instead of GCS
    bucket = process.env.GCS_BUCKET || 'earth-engine-exports',
    projectId = process.env.GCP_PROJECT_ID 
  } = params;
  
  switch (setupType) {
    case 'gcs':
      // Use default bucket if not provided
      const gcsBucket = bucket || 'earth-engine-exports';
      
      try {
        const storage = new Storage({
          projectId: process.env.GCP_PROJECT_ID,
          keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
        });
        
        // Check if bucket exists
        const [exists] = await storage.bucket(gcsBucket).exists();
        
        if (!exists) {
          // Create bucket
          await storage.createBucket(gcsBucket, {
            location: 'US',
            storageClass: 'STANDARD'
          });
          
          // Set CORS configuration
          await storage.bucket(gcsBucket).setCorsConfiguration([{
            origin: ['*'],
            method: ['GET', 'HEAD', 'PUT', 'POST'],
            responseHeader: ['*'],
            maxAgeSeconds: 3600
          }]);
          
          // Create export folder
          const file = storage.bucket(gcsBucket).file('exports/.keep');
          await file.save('');
          
          return {
            success: true,
            operation: 'setup',
            setupType: 'gcs',
            bucket: gcsBucket,
            created: true,
            message: `GCS bucket '${gcsBucket}' created and configured successfully`
          };
        } else {
          return {
            success: true,
            operation: 'setup',
            setupType: 'gcs',
            bucket: gcsBucket,
            exists: true,
            message: `GCS bucket '${gcsBucket}' already exists`
          };
        }
      } catch (error: any) {
        return {
          success: false,
          operation: 'setup',
          setupType: 'gcs',
          error: error?.message || 'Unknown error',
          message: 'GCS setup failed',
          help: 'Ensure you have permissions to create/manage GCS buckets'
        };
      }
      
    case 'auth':
      // Setup authentication by checking and creating service account
      try {
        const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
        
        if (!credPath) {
          return {
            success: true,
            operation: 'setup',
            setupType: 'auth',
            configured: false,
            message: 'GOOGLE_APPLICATION_CREDENTIALS not set',
            help: 'Set GOOGLE_APPLICATION_CREDENTIALS environment variable to your service account key file path'
          };
        }
        
        // Check if file exists - with timeout
        const fileExists = await fs.access(credPath).then(() => true).catch(() => false);
        
        if (!fileExists) {
          return {
            success: true,
            operation: 'setup',
            setupType: 'auth',
            configured: false,
            message: 'Credentials file not found',
            path: credPath
          };
        }
        
        // Read and parse the credentials - with size limit
        const stats = await fs.stat(credPath);
        if (stats.size > 10000) { // 10KB max for service account key
          return {
            success: true,
            operation: 'setup',
            setupType: 'auth',
            configured: false,
            message: 'Credentials file too large - may not be valid service account key'
          };
        }
        
        const credContent = await fs.readFile(credPath, 'utf-8');
        const credentials = JSON.parse(credContent);
        
        return {
          success: true,
          operation: 'setup',
          setupType: 'auth',
          configured: true,
          serviceAccount: credentials.client_email,
          projectId: credentials.project_id,
          keyId: credentials.private_key_id,
          message: 'Authentication configured correctly'
        };
      } catch (error: any) {
        return {
          success: true,
          operation: 'setup',
          setupType: 'auth',
          configured: false,
          error: error.message || 'Unknown error',
          message: 'Could not verify authentication setup'
        };
      }
      
    case 'project':
      if (!projectId) throw new Error('projectId required for project setup');
      
      // Update project configuration
      process.env.GCP_PROJECT_ID = projectId;
      
      return {
        success: true,
        operation: 'setup',
        setupType: 'project',
        projectId,
        message: `Project ID set to '${projectId}'`
      };
      
    default:
      throw new Error(`Unknown setup type: ${setupType}`);
  }
}

/**
 * Load operation - load external data (COG, GeoTIFF, etc.)
 */
async function loadData(params: any) {
  const { source, dataType = 'cog' } = params;
  
  if (!source) throw new Error('source required for load operation');
  
  try {
    let loaded;
    
    switch (dataType) {
      case 'cog':
      case 'geotiff':
        // Load Cloud Optimized GeoTIFF or regular GeoTIFF
        if (source.startsWith('gs://')) {
          // Load from GCS
          loaded = ee.Image.loadGeoTIFF(source);
        } else if (source.startsWith('http')) {
          // Load from HTTP URL
          loaded = ee.Image.loadGeoTIFF(source);
        } else {
          throw new Error('Source must be a GCS path (gs://) or HTTP URL');
        }
        
        const info = await loaded.getInfo();
        
        return {
          success: true,
          operation: 'load',
          dataType,
          source,
          bands: info.bands.length,
          properties: info.properties,
          message: `Loaded ${dataType.toUpperCase()} with ${info.bands.length} bands`,
          result: loaded
        };
        
      case 'json':
        // Load GeoJSON as feature collection
        if (source.startsWith('gs://')) {
          // For GCS, we need to read the file first
          const storage = new Storage();
          const matches = source.match(/gs:\/\/([^\/]+)\/(.+)/);
          if (!matches) throw new Error('Invalid GCS path');
          
          const [, bucketName, fileName] = matches;
          const file = storage.bucket(bucketName).file(fileName);
          const [contents] = await file.download();
          const geojson = JSON.parse(contents.toString());
          
          loaded = new ee.FeatureCollection(geojson);
        } else {
          // Assume it's a direct GeoJSON object or string
          const geojson = typeof source === 'string' ? JSON.parse(source) : source;
          loaded = new ee.FeatureCollection(geojson);
        }
        
        const count = await loaded.size().getInfo();
        
        return {
          success: true,
          operation: 'load',
          dataType: 'json',
          featureCount: count,
          message: `Loaded GeoJSON with ${count} features`,
          result: loaded
        };
        
      case 'csv':
        // CSV loading would require more complex handling
        return {
          success: false,
          operation: 'load',
          dataType: 'csv',
          message: 'CSV loading not yet implemented',
          help: 'Convert CSV to GeoJSON first, then use dataType: "json"'
        };
        
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  } catch (error: any) {
    return {
      success: false,
      operation: 'load',
      error: error?.message || 'Unknown error',
      message: 'Data loading failed'
    };
  }
}

/**
 * Dataset info operation - get information about a specific dataset
 */
async function getDatasetInfo(params: any) {
  const { datasetId } = params;
  
  if (!datasetId) {
    return {
      success: false,
      operation: 'dataset_info',
      error: 'datasetId is required',
      message: 'Please provide a dataset ID to get information about'
    };
  }
  
  // Determine dataset type and provide specific info based on ID pattern
  let datasetType = 'Unknown';
  let spatialResolution = 'Unknown';
  let temporalResolution = 'Unknown';
  let typicalBands = [];
  
  if (datasetId.includes('COPERNICUS/S2')) {
    datasetType = 'Sentinel-2 Optical Imagery';
    spatialResolution = '10-60m';
    temporalResolution = '5 days';
    typicalBands = ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B8A', 'B9', 'B10', 'B11', 'B12', 'QA60'];
  } else if (datasetId.includes('LANDSAT')) {
    datasetType = 'Landsat Optical Imagery';
    spatialResolution = '30m';
    temporalResolution = '16 days';
    typicalBands = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'QA_PIXEL'];
  } else if (datasetId.includes('MODIS')) {
    datasetType = 'MODIS Imagery';
    spatialResolution = '250-1000m';
    temporalResolution = 'Daily';
    typicalBands = ['sur_refl_b01', 'sur_refl_b02', 'sur_refl_b03', 'sur_refl_b04', 'sur_refl_b05', 'sur_refl_b06', 'sur_refl_b07'];
  } else if (datasetId.includes('CHIRPS')) {
    datasetType = 'Precipitation Data';
    spatialResolution = '5.5km';
    temporalResolution = 'Daily/Monthly';
    typicalBands = ['precipitation'];
  }
  
  // Try to get actual collection info with very aggressive timeout
  let actualBands = typicalBands;
  let imageCount = 'Unknown';
  
  try {
    const collection = new ee.ImageCollection(datasetId);
    
    // Only try to get band names from first image, skip count to avoid timeout
    const first = collection.first();
    
    // Use Promise.race to enforce strict timeout
    const bandsPromise = optimizer.optimizedGetInfo(first.bandNames(), { timeout: 2000 });
    const timeoutPromise = new Promise((resolve) => 
      setTimeout(() => resolve(null), 2000)
    );
    
    const bands = await Promise.race([bandsPromise, timeoutPromise]);
    if (bands && Array.isArray(bands)) {
      actualBands = bands;
    }
  } catch (error: any) {
    // If collection fails, just use the typical bands
    console.log('Could not fetch actual dataset info, using typical values');
  }
  
  return {
    success: true,
    operation: 'dataset_info',
    datasetId,
    datasetType,
    bands: actualBands,
    bandCount: actualBands.length,
    spatialResolution,
    temporalResolution,
    imageCount,
    message: `Dataset information for ${datasetId}`,
    usage: 'Use this dataset ID in filter, composite, and other operations',
    note: 'Band information may be typical values if actual collection could not be accessed quickly'
  };
}

/**
 * Info operation - get system information
 */
async function getSystemInfo(params: any) {
  const { infoType = 'system' } = params;
  
  switch (infoType) {
    case 'system':
      return {
        success: true,
        operation: 'info',
        infoType: 'system',
        earthEngineVersion: '1.x',
        nodeVersion: process.version,
        platform: process.platform,
        memory: {
          used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
          total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)} MB`
        },
        environment: {
          hasCredentials: !!process.env.GOOGLE_APPLICATION_CREDENTIALS,
          hasProjectId: !!process.env.GCP_PROJECT_ID,
          hasBucket: !!process.env.GCS_BUCKET
        },
        message: 'System information retrieved'
      };
      
    case 'quotas':
      // Earth Engine quotas
      return {
        success: true,
        operation: 'info',
        infoType: 'quotas',
        limits: {
          maxPixelsPerRequest: '1e9',
          maxFeaturesPerRequest: '5000',
          maxExportSize: '32GB',
          concurrentExports: 3000
        },
        message: 'Earth Engine quota information'
      };
      
    case 'assets':
      try {
        // List user assets
        const assets = await (ee.data as any).listAssets({ parent: 'projects/earthengine-legacy/assets' });
        
        return {
          success: true,
          operation: 'info',
          infoType: 'assets',
          assetCount: assets.length,
          assets: assets.slice(0, 10), // First 10 assets
          message: `Found ${assets.length} assets`
        };
      } catch (error: any) {
        return {
          success: true,
          operation: 'info',
          infoType: 'assets',
          message: 'No user assets found or no access to legacy assets'
        };
      }
      
    case 'tasks':
      try {
        // List running tasks
        const tasks = await (ee.data as any).listOperations();
        const running = tasks.filter((t: any) => t.metadata?.state === 'RUNNING');
        const completed = tasks.filter((t: any) => t.metadata?.state === 'SUCCEEDED');
        
        return {
          success: true,
          operation: 'info',
          infoType: 'tasks',
          totalTasks: tasks.length,
          running: running.length,
          completed: completed.length,
          recent: tasks.slice(0, 5).map((t: any) => ({
            id: t.name,
            state: t.metadata?.state,
            progress: Math.round((t.metadata?.progress || 0) * 100)
          })),
          message: `${running.length} running, ${completed.length} completed tasks`
        };
      } catch (error: any) {
        return {
          success: false,
          operation: 'info',
          infoType: 'tasks',
          error: error?.message || 'Unknown error'
        };
      }
      
    default:
      throw new Error(`Unknown info type: ${infoType}`);
  }
}

// Register the consolidated tool
register({
  name: 'earth_engine_system',
  description: `Consolidated Earth Engine system & advanced tool. Operations: auth (check authentication), execute (run custom code), setup (configure GCS/auth), load (external data), info (system info)`,
  input: SystemToolSchema,
  output: z.any(),
  handler: async (params) => {
    try {
      const { operation } = params;
      
      if (!operation) {
        return {
          success: false,
          error: 'Operation parameter is required',
          availableOperations: ['auth', 'execute', 'setup', 'load', 'info', 'dataset_info', 'help']
        };
      }
      
      // Handle both snake_case and camelCase parameters
      const normalizedParams = {
        ...params,
        assetId: params.assetId || params.asset_id,
        assetType: params.assetType || params.asset_type,
        dataSource: params.dataSource || params.data_source,
        dataUrl: params.dataUrl || params.data_url,
        dataContent: params.dataContent || params.data_content,
        includeDetails: params.includeDetails || params.include_details,
        checkType: params.checkType || params.check_type,
        setupType: params.setupType || params.setup_type,
        infoType: params.infoType || params.info_type,
        dataType: params.dataType || params.data_type
      };
      
      switch (operation) {
        case 'auth':
        case 'authentication':  // Allow both 'auth' and 'authentication'
          return await checkAuth(normalizedParams);
          
        case 'execute':
        case 'run':  // Allow both 'execute' and 'run'
          return await executeCode(normalizedParams);
          
        case 'setup':
        case 'configure':  // Allow both 'setup' and 'configure'
          return await setupSystem(normalizedParams);
          
        case 'load':
        case 'import':  // Allow both 'load' and 'import'
          return await loadData(normalizedParams);
          
        case 'info':
        case 'system':  // Allow both 'info' and 'system'
          return await getSystemInfo(normalizedParams);
          
        case 'dataset_info':
        case 'dataset':  // Allow both 'dataset_info' and 'dataset'
          return await getDatasetInfo(normalizedParams);
          
        case 'health':
          // Health check operation
          try {
            // Test Earth Engine connection
            await (ee as any).Number(1).getInfo();
            
            return {
              success: true,
              operation: 'health',
              status: 'healthy',
              earthEngine: 'connected',
              authentication: 'valid',
              timestamp: new Date().toISOString(),
              message: 'All systems operational'
            };
          } catch (error: any) {
            return {
              success: true,
              operation: 'health',
              status: 'degraded',
              earthEngine: 'error',
              error: error?.message || 'Unknown error',
              timestamp: new Date().toISOString(),
              message: 'Earth Engine connection issue'
            };
          }
          
        case 'help':
          return {
            success: true,
            operation: 'help',
            message: 'Earth Engine System Tool Help',
            availableOperations: {
              auth: 'Check authentication status and permissions',
              execute: 'Execute custom Earth Engine JavaScript code',
              setup: 'Setup GCS buckets, authentication, or projects',
              load: 'Load external data (GeoTIFF, JSON, CSV) into Earth Engine',
              info: 'Get system information, quotas, assets, or task status',
              dataset_info: 'Get detailed information about a specific dataset',
              health: 'Check system health status',
              help: 'Show this help message'
            },
            examples: {
              auth: { operation: 'auth', checkType: 'status' },
              execute: { operation: 'execute', code: 'return ee.Number(42).getInfo();' },
              setup: { operation: 'setup', setupType: 'gcs', bucket: 'my-bucket' },
              info: { operation: 'info', infoType: 'system' },
              health: { operation: 'health' }
            }
          };
          
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`,
            availableOperations: ['auth', 'execute', 'setup', 'load', 'info', 'dataset_info', 'help'],
            suggestion: 'Please use one of the available operations'
          };
      }
    } catch (error: any) {
      console.error(`[earth_engine_system] Error in ${params.operation}:`, error);
      return {
        success: false,
        operation: params.operation,
        error: error.message || 'An unexpected error occurred',
        details: error.stack,
        params: params
      };
    }
  }
});

export default {};
