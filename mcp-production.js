#!/usr/bin/env node

/**
 * EARTH ENGINE MCP SERVER - PRODUCTION READY
 * ===========================================
 * Fully functional MCP server for Google Earth Engine integration
 * with Claude Desktop using service account authentication
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import ee from '@google/earthengine';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Service account key path - automatically detect from environment or common locations
const SERVICE_ACCOUNT_PATHS = [
  process.env.GEE_JSON_PATH,
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  process.env.GEE_SERVICE_ACCOUNT,
  'C:\\Users\\Dhenenjay\\Downloads\\ee-key.json',
  path.join(process.cwd(), 'service-account-key.json'),
  path.join(process.cwd(), 'gee-key.json'),
  path.join(process.cwd(), '.keys', 'gee-service-account.json')
].filter(Boolean);

let eeInitialized = false;
let serviceAccountPath = null;

// Initialize Earth Engine
async function initializeEarthEngine() {
  if (eeInitialized) {
    return true;
  }

  try {
    // Find service account key
    for (const keyPath of SERVICE_ACCOUNT_PATHS) {
      if (fs.existsSync(keyPath)) {
        serviceAccountPath = keyPath;
        break;
      }
    }

    if (!serviceAccountPath) {
      console.error('No Google Earth Engine service account key found.');
      console.log('Please set GEE_JSON_PATH environment variable to your service account JSON key path.');
      return false;
    }

    const privateKey = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    return new Promise((resolve) => {
      ee.data.authenticateViaPrivateKey(
        privateKey,
        () => {
          ee.initialize(null, null, () => {
            console.log(`Earth Engine initialized with key from: ${serviceAccountPath}`);
            eeInitialized = true;
            resolve(true);
          }, (error) => {
            console.error('Earth Engine initialization error:', error);
            resolve(false);
          });
        },
        (error) => {
          console.error('Earth Engine authentication error:', error);
          resolve(false);
        }
      );
    });
  } catch (error) {
    console.error('Error initializing Earth Engine:', error);
    return false;
  }
}

// Helper function to evaluate Earth Engine objects
async function evaluateEE(eeObject) {
  return new Promise((resolve, reject) => {
    eeObject.evaluate((result, error) => {
      if (error) reject(error);
      else resolve(result);
    });
  });
}

// Helper function to get region geometry
function getRegionGeometry(region) {
  // Common regions
  const regions = {
    'California': ee.Geometry.Rectangle([-124.48, 32.53, -114.13, 42.01]),
    'Houston': ee.Geometry.Rectangle([-95.8, 29.5, -95.0, 30.1]),
    'Miami': ee.Geometry.Rectangle([-80.5, 25.5, -80.0, 26.0]),
    'Denver': ee.Geometry.Rectangle([-105.2, 39.6, -104.8, 39.9]),
    'Iowa': ee.Geometry.Rectangle([-96.6, 40.4, -90.1, 43.5]),
    'Amazon': ee.Geometry.Rectangle([-70, -10, -50, 0]),
    'Lake Tahoe': ee.Geometry.Rectangle([-120.2, 38.8, -119.9, 39.3]),
    'Yellowstone': ee.Geometry.Rectangle([-111.1, 44.1, -109.8, 45.1])
  };

  if (regions[region]) {
    return regions[region];
  }

  // Try to parse as coordinates
  if (Array.isArray(region) && region.length === 2) {
    return ee.Geometry.Point(region).buffer(10000);
  }

  // Default region
  return ee.Geometry.Rectangle([-122.5, 37.7, -122.3, 37.9]);
}

// Create the MCP server
const server = new Server(
  {
    name: 'earth-engine-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'earth_engine_health',
        description: 'Check Earth Engine server connection and authentication status',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'earth_engine_compute_ndvi',
        description: 'Compute NDVI (Normalized Difference Vegetation Index) for a region',
        inputSchema: {
          type: 'object',
          properties: {
            region: {
              type: 'string',
              description: 'Region name (e.g., "California", "Amazon") or coordinates [lon, lat]',
            },
            startDate: {
              type: 'string',
              description: 'Start date in YYYY-MM-DD format',
            },
            endDate: {
              type: 'string',
              description: 'End date in YYYY-MM-DD format',
            },
            scale: {
              type: 'number',
              description: 'Scale in meters (default: 100)',
              default: 100,
            },
          },
          required: ['region', 'startDate', 'endDate'],
        },
      },
      {
        name: 'earth_engine_wildfire_risk',
        description: 'Assess wildfire risk for a region using multiple environmental factors',
        inputSchema: {
          type: 'object',
          properties: {
            region: {
              type: 'string',
              description: 'Region name or coordinates',
            },
            startDate: {
              type: 'string',
              description: 'Start date for analysis',
            },
            endDate: {
              type: 'string',
              description: 'End date for analysis',
            },
          },
          required: ['region'],
        },
      },
      {
        name: 'earth_engine_flood_risk',
        description: 'Analyze flood risk based on terrain, precipitation, and water patterns',
        inputSchema: {
          type: 'object',
          properties: {
            region: {
              type: 'string',
              description: 'Region name or coordinates',
            },
            startDate: {
              type: 'string',
              description: 'Start date for analysis',
            },
            endDate: {
              type: 'string',
              description: 'End date for analysis',
            },
            floodType: {
              type: 'string',
              enum: ['urban', 'coastal', 'riverine'],
              default: 'urban',
            },
          },
          required: ['region'],
        },
      },
      {
        name: 'earth_engine_agriculture_monitor',
        description: 'Monitor agricultural health and crop conditions',
        inputSchema: {
          type: 'object',
          properties: {
            region: {
              type: 'string',
              description: 'Agricultural region to monitor',
            },
            cropType: {
              type: 'string',
              description: 'Type of crop (optional)',
              default: 'general',
            },
            startDate: {
              type: 'string',
              description: 'Start of growing season',
            },
            endDate: {
              type: 'string',
              description: 'End of growing season',
            },
          },
          required: ['region'],
        },
      },
      {
        name: 'earth_engine_deforestation',
        description: 'Detect deforestation by comparing forest cover between two periods',
        inputSchema: {
          type: 'object',
          properties: {
            region: {
              type: 'string',
              description: 'Forest region to analyze',
            },
            baselineStart: {
              type: 'string',
              description: 'Baseline period start date',
            },
            baselineEnd: {
              type: 'string',
              description: 'Baseline period end date',
            },
            currentStart: {
              type: 'string',
              description: 'Current period start date',
            },
            currentEnd: {
              type: 'string',
              description: 'Current period end date',
            },
          },
          required: ['region'],
        },
      },
      {
        name: 'earth_engine_water_quality',
        description: 'Monitor water quality using spectral indices',
        inputSchema: {
          type: 'object',
          properties: {
            region: {
              type: 'string',
              description: 'Water body or region to monitor',
            },
            startDate: {
              type: 'string',
              description: 'Start date for monitoring',
            },
            endDate: {
              type: 'string',
              description: 'End date for monitoring',
            },
            waterBody: {
              type: 'string',
              enum: ['lake', 'river', 'coastal'],
              default: 'lake',
            },
          },
          required: ['region'],
        },
      },
      {
        name: 'earth_engine_statistics',
        description: 'Calculate statistics for a dataset over a region',
        inputSchema: {
          type: 'object',
          properties: {
            datasetId: {
              type: 'string',
              description: 'Earth Engine dataset ID (e.g., "COPERNICUS/S2_SR_HARMONIZED")',
            },
            region: {
              type: 'string',
              description: 'Region for statistics',
            },
            startDate: {
              type: 'string',
              description: 'Start date',
            },
            endDate: {
              type: 'string',
              description: 'End date',
            },
            bands: {
              type: 'array',
              items: { type: 'string' },
              description: 'Bands to analyze',
            },
            reducer: {
              type: 'string',
              enum: ['mean', 'median', 'max', 'min', 'stdDev'],
              default: 'mean',
            },
          },
          required: ['datasetId', 'region'],
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler('tools/call', async (request) => {
  const { name, arguments: args } = request.params;

  // Ensure Earth Engine is initialized
  if (!eeInitialized) {
    const success = await initializeEarthEngine();
    if (!success) {
      return {
        content: [
          {
            type: 'text',
            text: 'Error: Earth Engine not initialized. Please check your service account credentials.',
          },
        ],
      };
    }
  }

  try {
    switch (name) {
      case 'earth_engine_health':
        return await checkHealth();

      case 'earth_engine_compute_ndvi':
        return await computeNDVI(args);

      case 'earth_engine_wildfire_risk':
        return await assessWildfireRisk(args);

      case 'earth_engine_flood_risk':
        return await assessFloodRisk(args);

      case 'earth_engine_agriculture_monitor':
        return await monitorAgriculture(args);

      case 'earth_engine_deforestation':
        return await detectDeforestation(args);

      case 'earth_engine_water_quality':
        return await monitorWaterQuality(args);

      case 'earth_engine_statistics':
        return await calculateStatistics(args);

      default:
        return {
          content: [
            {
              type: 'text',
              text: `Unknown tool: ${name}`,
            },
          ],
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${name}: ${error.message}`,
        },
      ],
    };
  }
});

// Tool implementations

async function checkHealth() {
  const status = {
    earthEngine: eeInitialized ? 'Connected' : 'Not connected',
    authentication: eeInitialized ? 'Authenticated' : 'Not authenticated',
    serviceAccount: serviceAccountPath ? path.basename(serviceAccountPath) : 'Not found',
  };

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(status, null, 2),
      },
    ],
  };
}

async function computeNDVI(args) {
  const { region, startDate, endDate, scale = 100 } = args;
  const geometry = getRegionGeometry(region);

  const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

  const composite = collection.median();
  const ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI');

  const stats = ndvi.reduceRegion({
    reducer: ee.Reducer.mean().combine({
      reducer2: ee.Reducer.stdDev(),
      sharedInputs: true
    }),
    geometry: geometry,
    scale: scale,
    maxPixels: 1e9
  });

  const result = await evaluateEE(stats);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          region,
          dateRange: { startDate, endDate },
          ndvi: {
            mean: result.NDVI_mean || 0,
            stdDev: result.NDVI_stdDev || 0,
          },
          interpretation: interpretNDVI(result.NDVI_mean),
        }, null, 2),
      },
    ],
  };
}

async function assessWildfireRisk(args) {
  const {
    region,
    startDate = '2023-06-01',
    endDate = '2023-09-30'
  } = args;

  const geometry = getRegionGeometry(region);

  // Get vegetation indices
  const sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

  const composite = sentinel2.median();
  const ndvi = composite.normalizedDifference(['B8', 'B4']);
  const ndwi = composite.normalizedDifference(['B3', 'B8']);

  // Get precipitation
  const precipitation = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterDate(startDate, endDate)
    .filterBounds(geometry)
    .sum();

  // Calculate statistics
  const vegStats = ee.Image.cat([ndvi, ndwi]).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 100,
    maxPixels: 1e9
  });

  const precipStats = precipitation.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 5500,
    maxPixels: 1e9
  });

  const vegResult = await evaluateEE(vegStats);
  const precipResult = await evaluateEE(precipStats);

  // Calculate risk score
  let riskScore = 0;
  const ndviValue = vegResult.nd || 0;
  const ndwiValue = vegResult.nd_1 || 0;
  const precipValue = precipResult.precipitation || 0;

  if (ndviValue < 0.3) riskScore += 40;
  else if (ndviValue < 0.5) riskScore += 20;

  if (ndwiValue < 0) riskScore += 30;
  else if (ndwiValue < 0.2) riskScore += 15;

  if (precipValue < 100) riskScore += 30;
  else if (precipValue < 200) riskScore += 15;

  const riskLevel = 
    riskScore >= 70 ? 'HIGH' :
    riskScore >= 40 ? 'MODERATE' :
    'LOW';

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          region,
          dateRange: { startDate, endDate },
          riskLevel,
          riskScore,
          factors: {
            vegetationDryness: ndviValue,
            waterContent: ndwiValue,
            totalPrecipitation: precipValue,
          },
          recommendations: getFireRecommendations(riskLevel),
        }, null, 2),
      },
    ],
  };
}

async function assessFloodRisk(args) {
  const {
    region,
    startDate = '2023-01-01',
    endDate = '2023-12-31',
    floodType = 'urban'
  } = args;

  const geometry = getRegionGeometry(region);

  // Get elevation and slope
  const elevation = ee.Image('USGS/SRTMGL1_003');
  const slope = ee.Terrain.slope(elevation);

  // Get precipitation
  const precipitation = ee.ImageCollection('UCSB-CHG/CHIRPS/DAILY')
    .filterDate(startDate, endDate)
    .filterBounds(geometry)
    .sum();

  // Calculate statistics
  const terrainStats = ee.Image.cat([elevation, slope]).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e9
  });

  const precipStats = precipitation.reduceRegion({
    reducer: ee.Reducer.sum(),
    geometry: geometry,
    scale: 5500,
    maxPixels: 1e9
  });

  const terrainResult = await evaluateEE(terrainStats);
  const precipResult = await evaluateEE(precipStats);

  // Calculate flood risk
  let riskScore = 0;
  const elevValue = terrainResult.elevation || 100;
  const slopeValue = terrainResult.slope || 5;
  const precipValue = precipResult.precipitation || 0;

  if (elevValue < 50) riskScore += 30;
  else if (elevValue < 100) riskScore += 15;

  if (slopeValue < 2) riskScore += 30;
  else if (slopeValue < 5) riskScore += 15;

  if (precipValue > 1500) riskScore += 40;
  else if (precipValue > 1000) riskScore += 20;

  const riskLevel = 
    riskScore >= 70 ? 'HIGH' :
    riskScore >= 40 ? 'MODERATE' :
    'LOW';

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          region,
          dateRange: { startDate, endDate },
          floodType,
          riskLevel,
          riskScore,
          factors: {
            elevation: elevValue,
            slope: slopeValue,
            totalPrecipitation: precipValue,
          },
          recommendations: getFloodRecommendations(riskLevel),
        }, null, 2),
      },
    ],
  };
}

async function monitorAgriculture(args) {
  const {
    region,
    cropType = 'general',
    startDate = '2023-05-01',
    endDate = '2023-09-30'
  } = args;

  const geometry = getRegionGeometry(region);

  // Get Sentinel-2 imagery
  const sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

  const composite = sentinel2.median();

  // Calculate vegetation indices
  const ndvi = composite.normalizedDifference(['B8', 'B4']);
  const evi = composite.expression(
    '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))',
    {
      'NIR': composite.select('B8'),
      'RED': composite.select('B4'),
      'BLUE': composite.select('B2')
    }
  );

  // Calculate statistics
  const stats = ee.Image.cat([ndvi, evi]).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e9
  });

  const result = await evaluateEE(stats);

  const ndviValue = result.nd || 0;
  const eviValue = result.constant || 0;

  // Determine crop health
  let healthStatus = 'UNKNOWN';
  if (ndviValue > 0.6) healthStatus = 'EXCELLENT';
  else if (ndviValue > 0.4) healthStatus = 'GOOD';
  else if (ndviValue > 0.2) healthStatus = 'MODERATE';
  else healthStatus = 'POOR';

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          region,
          cropType,
          dateRange: { startDate, endDate },
          cropHealth: healthStatus,
          indices: {
            NDVI: ndviValue,
            EVI: eviValue,
          },
          recommendations: getCropRecommendations(healthStatus),
        }, null, 2),
      },
    ],
  };
}

async function detectDeforestation(args) {
  const {
    region,
    baselineStart = '2023-01-01',
    baselineEnd = '2023-03-31',
    currentStart = '2023-10-01',
    currentEnd = '2023-12-31'
  } = args;

  const geometry = getRegionGeometry(region);

  // Get baseline NDVI
  const baselineCollection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(baselineStart, baselineEnd)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

  const baselineNDVI = baselineCollection.median()
    .normalizedDifference(['B8', 'B4']);

  // Get current NDVI
  const currentCollection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(currentStart, currentEnd)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

  const currentNDVI = currentCollection.median()
    .normalizedDifference(['B8', 'B4']);

  // Calculate statistics
  const baselineStats = baselineNDVI.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e9
  });

  const currentStats = currentNDVI.reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e9
  });

  const baselineResult = await evaluateEE(baselineStats);
  const currentResult = await evaluateEE(currentStats);

  const baselineValue = baselineResult.nd || 0;
  const currentValue = currentResult.nd || 0;
  const change = baselineValue - currentValue;
  const percentChange = baselineValue > 0 ? (change / baselineValue) * 100 : 0;

  const severity = 
    percentChange > 30 ? 'SEVERE' :
    percentChange > 15 ? 'HIGH' :
    percentChange > 5 ? 'MODERATE' :
    'LOW';

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          region,
          periods: {
            baseline: { start: baselineStart, end: baselineEnd },
            current: { start: currentStart, end: currentEnd },
          },
          deforestation: {
            detected: percentChange > 5,
            severity,
            percentLoss: percentChange,
            ndviChange: change,
          },
          values: {
            baselineNDVI: baselineValue,
            currentNDVI: currentValue,
          },
          recommendations: getDeforestationRecommendations(severity),
        }, null, 2),
      },
    ],
  };
}

async function monitorWaterQuality(args) {
  const {
    region,
    startDate = '2023-07-01',
    endDate = '2023-08-31',
    waterBody = 'lake'
  } = args;

  const geometry = getRegionGeometry(region);

  // Get Sentinel-2 imagery
  const sentinel2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
    .filterBounds(geometry)
    .filterDate(startDate, endDate)
    .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20));

  const composite = sentinel2.median();

  // Calculate water indices
  const ndwi = composite.normalizedDifference(['B3', 'B11']);
  const turbidity = composite.select('B4').divide(composite.select('B3'));

  // Calculate statistics
  const stats = ee.Image.cat([ndwi, turbidity]).reduceRegion({
    reducer: ee.Reducer.mean(),
    geometry: geometry,
    scale: 30,
    maxPixels: 1e9
  });

  const result = await evaluateEE(stats);

  const ndwiValue = result.nd || 0;
  const turbidityValue = result.B4 || 1;

  // Determine water quality
  let qualityLevel = 'UNKNOWN';
  if (turbidityValue < 1.2 && ndwiValue > 0.3) qualityLevel = 'EXCELLENT';
  else if (turbidityValue < 1.5 && ndwiValue > 0.1) qualityLevel = 'GOOD';
  else if (turbidityValue < 2.0) qualityLevel = 'MODERATE';
  else qualityLevel = 'POOR';

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          region,
          waterBody,
          dateRange: { startDate, endDate },
          qualityLevel,
          parameters: {
            waterIndex: ndwiValue,
            turbidity: turbidityValue,
          },
          recommendations: getWaterQualityRecommendations(qualityLevel),
        }, null, 2),
      },
    ],
  };
}

async function calculateStatistics(args) {
  const {
    datasetId,
    region,
    startDate = '2023-01-01',
    endDate = '2023-12-31',
    bands = null,
    reducer = 'mean'
  } = args;

  const geometry = getRegionGeometry(region);

  // Load dataset
  const collection = ee.ImageCollection(datasetId)
    .filterBounds(geometry)
    .filterDate(startDate, endDate);

  // Select bands if specified
  const image = bands ? collection.select(bands).median() : collection.median();

  // Apply reducer
  const reducerMap = {
    'mean': ee.Reducer.mean(),
    'median': ee.Reducer.median(),
    'max': ee.Reducer.max(),
    'min': ee.Reducer.min(),
    'stdDev': ee.Reducer.stdDev(),
  };

  const stats = image.reduceRegion({
    reducer: reducerMap[reducer] || ee.Reducer.mean(),
    geometry: geometry,
    scale: 100,
    maxPixels: 1e9
  });

  const result = await evaluateEE(stats);

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify({
          datasetId,
          region,
          dateRange: { startDate, endDate },
          reducer,
          statistics: result,
        }, null, 2),
      },
    ],
  };
}

// Helper functions for interpretations and recommendations

function interpretNDVI(value) {
  if (value > 0.6) return 'Dense vegetation';
  if (value > 0.4) return 'Moderate vegetation';
  if (value > 0.2) return 'Sparse vegetation';
  if (value > 0) return 'Very sparse vegetation';
  return 'No vegetation';
}

function getFireRecommendations(riskLevel) {
  const recommendations = {
    'HIGH': [
      'Increase fire watch patrols',
      'Issue fire weather warnings',
      'Prepare evacuation routes',
      'Clear vegetation around structures',
    ],
    'MODERATE': [
      'Monitor weather conditions',
      'Maintain firebreaks',
      'Educate public on fire safety',
    ],
    'LOW': [
      'Continue regular monitoring',
      'Maintain vegetation management',
    ],
  };
  return recommendations[riskLevel] || [];
}

function getFloodRecommendations(riskLevel) {
  const recommendations = {
    'HIGH': [
      'Monitor water levels continuously',
      'Prepare flood defenses',
      'Alert emergency services',
      'Review evacuation plans',
    ],
    'MODERATE': [
      'Check drainage systems',
      'Monitor weather forecasts',
      'Prepare flood response equipment',
    ],
    'LOW': [
      'Routine infrastructure maintenance',
      'Update flood maps',
    ],
  };
  return recommendations[riskLevel] || [];
}

function getCropRecommendations(healthStatus) {
  const recommendations = {
    'POOR': [
      'Immediate irrigation required',
      'Check for pest and disease',
      'Apply emergency nutrients',
    ],
    'MODERATE': [
      'Increase monitoring frequency',
      'Optimize irrigation schedule',
      'Consider supplemental nutrients',
    ],
    'GOOD': [
      'Maintain current practices',
      'Regular monitoring',
    ],
    'EXCELLENT': [
      'Prepare for optimal harvest',
      'Continue current management',
    ],
  };
  return recommendations[healthStatus] || [];
}

function getDeforestationRecommendations(severity) {
  const recommendations = {
    'SEVERE': [
      'Immediate intervention required',
      'Deploy forest protection teams',
      'Investigate illegal logging',
    ],
    'HIGH': [
      'Increase monitoring frequency',
      'Strengthen law enforcement',
      'Engage local communities',
    ],
    'MODERATE': [
      'Regular satellite monitoring',
      'Community awareness programs',
    ],
    'LOW': [
      'Continue monitoring',
      'Maintain conservation efforts',
    ],
  };
  return recommendations[severity] || [];
}

function getWaterQualityRecommendations(qualityLevel) {
  const recommendations = {
    'POOR': [
      'Issue water quality advisory',
      'Investigate pollution sources',
      'Increase monitoring frequency',
    ],
    'MODERATE': [
      'Monitor key parameters',
      'Check nutrient levels',
    ],
    'GOOD': [
      'Maintain current practices',
      'Regular monitoring',
    ],
    'EXCELLENT': [
      'Continue current management',
      'Preserve water quality',
    ],
  };
  return recommendations[qualityLevel] || [];
}

// Start the server
async function main() {
  console.log('Starting Earth Engine MCP Server...');
  
  // Initialize Earth Engine on startup
  await initializeEarthEngine();

  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.log('Earth Engine MCP Server is running');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
