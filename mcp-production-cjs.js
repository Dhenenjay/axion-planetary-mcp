#!/usr/bin/env node

/**
 * EARTH ENGINE MCP SERVER - PRODUCTION READY (CommonJS)
 * ======================================================
 * Fully functional MCP server for Google Earth Engine integration
 * with Claude Desktop using service account authentication
 */

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const ee = require('@google/earthengine');
const fs = require('fs');
const path = require('path');

// Service account key path - automatically detect from environment or common locations
const SERVICE_ACCOUNT_PATHS = [
  process.env.GEE_JSON_PATH,
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  process.env.GEE_SERVICE_ACCOUNT,
  'C:\\Users\\Dhenenjay\\Downloads\\ee-key.json',
  path.join(process.cwd(), 'service-account-key.json'),
  path.join(process.cwd(), 'gee-key.json'),
  path.join(process.cwd(), 'ee-key.json'),
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
        console.log(`Found service account key at: ${keyPath}`);
        break;
      }
    }

    if (!serviceAccountPath) {
      console.error('No Google Earth Engine service account key found.');
      console.log('Searched locations:', SERVICE_ACCOUNT_PATHS);
      console.log('Please set GEE_JSON_PATH environment variable to your service account JSON key path.');
      return false;
    }

    const privateKey = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

    return new Promise((resolve) => {
      ee.data.authenticateViaPrivateKey(
        privateKey,
        () => {
          ee.initialize(null, null, () => {
            console.log(`Earth Engine initialized successfully with key from: ${serviceAccountPath}`);
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

// Helper function for NDVI interpretation
function interpretNDVI(value) {
  if (value > 0.6) return 'Dense vegetation';
  if (value > 0.4) return 'Moderate vegetation';
  if (value > 0.2) return 'Sparse vegetation';
  if (value > 0) return 'Very sparse vegetation';
  return 'No vegetation';
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
