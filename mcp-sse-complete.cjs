#!/usr/bin/env node

/**
 * COMPLETE MCP-SSE Bridge with ALL Tools and Models
 * Restores full functionality including:
 * - 4 consolidated super tools (earth_engine_data, process, export, system)
 * - 5 geospatial models (wildfire, flood, agriculture, deforestation, water quality)
 */

const readline = require('readline');
const http = require('http');
const { URL } = require('url');

const SSE_ENDPOINT = 'http://localhost:3000/api/mcp/sse';

// Create readline interface for stdio communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Buffer for incomplete messages
let buffer = '';

// COMPLETE TOOLS LIST - All your original tools
const TOOLS = [
  // ========== CONSOLIDATED SUPER TOOLS ==========
  {
    name: 'earth_engine_data',
    description: 'Data Discovery & Access - search, filter, geometry, info, boundaries operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['search', 'filter', 'geometry', 'info', 'boundaries'],
          description: 'Operation to perform'
        },
        query: { type: 'string', description: 'Search query (for search operation)' },
        datasetId: { type: 'string', description: 'Dataset ID' },
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD' },
        region: { type: 'string', description: 'Region name or geometry' },
        placeName: { type: 'string', description: 'Place name for geometry lookup' },
        limit: { type: 'number', description: 'Maximum results', default: 10 }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_process',
    description: 'Processing & Analysis - clip, mask, index, analyze, composite, terrain, resample operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['clip', 'mask', 'index', 'analyze', 'composite', 'terrain', 'resample'],
          description: 'Processing operation'
        },
        input: { type: 'string', description: 'Input dataset or result' },
        datasetId: { type: 'string', description: 'Dataset ID' },
        region: { type: 'string', description: 'Region for processing' },
        indexType: {
          type: 'string',
          enum: ['NDVI', 'NDWI', 'NDBI', 'EVI', 'SAVI', 'MNDWI', 'NBR', 'custom'],
          description: 'Index type'
        },
        maskType: {
          type: 'string',
          enum: ['clouds', 'water', 'quality', 'shadow'],
          description: 'Mask type'
        },
        analysisType: {
          type: 'string',
          enum: ['statistics', 'timeseries', 'change', 'zonal', 'histogram'],
          description: 'Analysis type'
        },
        compositeType: {
          type: 'string',
          enum: ['median', 'mean', 'max', 'min', 'mosaic', 'greenest'],
          description: 'Composite type'
        },
        terrainType: {
          type: 'string',
          enum: ['elevation', 'slope', 'aspect', 'hillshade'],
          description: 'Terrain analysis type'
        },
        reducer: {
          type: 'string',
          enum: ['mean', 'median', 'max', 'min', 'stdDev', 'sum', 'count'],
          description: 'Statistical reducer'
        },
        targetScale: { type: 'number', description: 'Target scale in meters' },
        resampleMethod: {
          type: 'string',
          enum: ['bilinear', 'bicubic', 'nearest'],
          description: 'Resampling method'
        },
        startDate: { type: 'string', description: 'Start date' },
        endDate: { type: 'string', description: 'End date' },
        scale: { type: 'number', description: 'Processing scale', default: 30 },
        band: { type: 'string', description: 'Band name' },
        bands: { type: 'array', items: { type: 'string' }, description: 'Band names' }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_export',
    description: 'Export & Visualization - export, thumbnail, tiles, status, download operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['export', 'thumbnail', 'tiles', 'status', 'download'],
          description: 'Export operation'
        },
        input: { type: 'string', description: 'Input data to export' },
        datasetId: { type: 'string', description: 'Dataset ID' },
        region: { type: 'string', description: 'Export region' },
        destination: {
          type: 'string',
          enum: ['gcs', 'drive', 'auto'],
          description: 'Export destination'
        },
        bucket: { type: 'string', description: 'GCS bucket name' },
        scale: { type: 'number', description: 'Export scale', default: 10 },
        format: {
          type: 'string',
          enum: ['GeoTIFF', 'COG', 'TFRecord'],
          description: 'Export format'
        },
        dimensions: { type: 'number', description: 'Thumbnail dimensions', default: 512 },
        visParams: {
          type: 'object',
          properties: {
            bands: { type: 'array', items: { type: 'string' } },
            min: { type: 'number' },
            max: { type: 'number' },
            palette: { type: 'array', items: { type: 'string' } },
            gamma: { type: 'number' }
          }
        },
        zoomLevel: { type: 'number', description: 'Tile zoom level' },
        taskId: { type: 'string', description: 'Task ID for status check' },
        fileNamePrefix: { type: 'string', description: 'File prefix for download' },
        startDate: { type: 'string', description: 'Start date' },
        endDate: { type: 'string', description: 'End date' }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_system',
    description: 'System & Advanced - auth, execute, setup, load, info, health operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['auth', 'execute', 'setup', 'load', 'info', 'health'],
          description: 'System operation'
        },
        checkType: {
          type: 'string',
          enum: ['status', 'projects', 'permissions'],
          description: 'Auth check type'
        },
        code: { type: 'string', description: 'JavaScript code to execute' },
        language: { type: 'string', description: 'Code language', default: 'javascript' },
        setupType: {
          type: 'string',
          enum: ['gcs', 'auth', 'project'],
          description: 'Setup type'
        },
        source: { type: 'string', description: 'Source path for loading' },
        dataType: {
          type: 'string',
          enum: ['cog', 'geotiff', 'json'],
          description: 'Data type to load'
        },
        infoType: {
          type: 'string',
          enum: ['system', 'quotas', 'assets', 'tasks'],
          description: 'Info type'
        },
        bucket: { type: 'string', description: 'GCS bucket' }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_map',
    description: 'Interactive Map Viewer - create, list, delete interactive web maps for large regions',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['create', 'list', 'delete'],
          description: 'Map operation to perform'
        },
        input: { type: 'string', description: 'Model key or composite key to visualize' },
        region: { type: 'string', description: 'Region name for the map' },
        layers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Layer name' },
              input: { type: 'string', description: 'Input key for this specific layer' },
              bands: { type: 'array', items: { type: 'string' }, description: 'Bands to visualize' },
              visParams: {
                type: 'object',
                properties: {
                  min: { type: 'number' },
                  max: { type: 'number' },
                  palette: { type: 'array', items: { type: 'string' } },
                  gamma: { type: 'number' }
                }
              }
            }
          },
          description: 'Multiple layers configuration'
        },
        bands: { type: 'array', items: { type: 'string' }, description: 'Bands to visualize' },
        visParams: {
          type: 'object',
          properties: {
            min: { type: 'number' },
            max: { type: 'number' },
            palette: { type: 'array', items: { type: 'string' } },
            gamma: { type: 'number' }
          },
          description: 'Visualization parameters'
        },
        mapId: { type: 'string', description: 'Map ID for specific operations' },
        center: { type: 'array', items: { type: 'number' }, description: '[longitude, latitude] center point' },
        zoom: { type: 'number', description: 'Initial zoom level' },
        basemap: {
          type: 'string',
          enum: ['satellite', 'terrain', 'roadmap', 'dark'],
          description: 'Base map style'
        }
      },
      required: ['operation']
    }
  },

  // ========== GEOSPATIAL MODELS ==========
  {
    name: 'wildfire_risk_assessment',
    description: 'Comprehensive wildfire risk assessment using vegetation, terrain, and weather data',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Region to assess (e.g., California, Yellowstone)' },
        startDate: { type: 'string', description: 'Start date for analysis' },
        endDate: { type: 'string', description: 'End date for analysis' },
        scale: { type: 'number', description: 'Analysis scale in meters', default: 100 },
        includeTimeSeries: { type: 'boolean', description: 'Include temporal analysis', default: true },
        exportMaps: { type: 'boolean', description: 'Generate visualization maps', default: true }
      },
      required: ['region']
    }
  },
  {
    name: 'flood_risk_assessment',
    description: 'Flood risk analysis based on terrain, precipitation, and water patterns',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Region to assess' },
        startDate: { type: 'string', description: 'Start date' },
        endDate: { type: 'string', description: 'End date' },
        floodType: {
          type: 'string',
          enum: ['urban', 'coastal', 'riverine'],
          description: 'Type of flood risk',
          default: 'urban'
        },
        scale: { type: 'number', description: 'Analysis scale', default: 100 }
      },
      required: ['region']
    }
  },
  {
    name: 'agricultural_monitoring',
    description: 'Monitor crop health and agricultural conditions',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Agricultural region' },
        cropType: { type: 'string', description: 'Crop type', default: 'general' },
        startDate: { type: 'string', description: 'Growing season start' },
        endDate: { type: 'string', description: 'Growing season end' },
        scale: { type: 'number', description: 'Analysis scale', default: 30 }
      },
      required: ['region']
    }
  },
  {
    name: 'deforestation_detection',
    description: 'Detect forest loss between two time periods',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Forest region (e.g., Amazon)' },
        baselineStart: { type: 'string', description: 'Baseline period start' },
        baselineEnd: { type: 'string', description: 'Baseline period end' },
        currentStart: { type: 'string', description: 'Current period start' },
        currentEnd: { type: 'string', description: 'Current period end' },
        scale: { type: 'number', description: 'Analysis scale', default: 30 }
      },
      required: ['region']
    }
  },
  {
    name: 'water_quality_monitoring',
    description: 'Monitor water quality using spectral indices',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Water body (e.g., Lake Tahoe)' },
        startDate: { type: 'string', description: 'Monitoring start date' },
        endDate: { type: 'string', description: 'Monitoring end date' },
        waterBody: {
          type: 'string',
          enum: ['lake', 'river', 'coastal'],
          description: 'Water body type',
          default: 'lake'
        },
        scale: { type: 'number', description: 'Analysis scale', default: 30 }
      },
      required: ['region']
    }
  },
  {
    name: 'crop_classification',
    description: 'COMPLETE crop classification tool - builds model, trains classifier, performs classification, AND creates interactive map automatically. Returns map URL directly. DO NOT call other tools after this - it does everything. Supports Iowa, California, Texas, Kansas, Nebraska, Illinois with built-in training data.',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['classify', 'train', 'evaluate', 'export'],
          description: 'Operation to perform (use "classify" for full classification with map)',
          default: 'classify'
        },
        region: {
          type: 'string',
          description: 'State name (Iowa, California, Texas, Kansas, Nebraska, Illinois) or geometry for classification area'
        },
        startDate: {
          type: 'string',
          description: 'Start date for imagery (YYYY-MM-DD)',
          default: '2024-06-01'
        },
        endDate: {
          type: 'string',
          description: 'End date for imagery (YYYY-MM-DD)',
          default: '2024-08-31'
        },
        classifier: {
          type: 'string',
          enum: ['randomForest', 'svm', 'cart', 'naiveBayes'],
          description: 'Classification algorithm',
          default: 'randomForest'
        },
        createMap: {
          type: 'boolean',
          description: 'Create interactive map',
          default: true
        },
        includeIndices: {
          type: 'boolean',
          description: 'Include vegetation indices (NDVI, EVI, etc.)',
          default: true
        },
        scale: {
          type: 'number',
          description: 'Processing scale in meters',
          default: 30
        },
        numberOfTrees: {
          type: 'number',
          description: 'Number of trees for Random Forest',
          default: 100
        }
      },
      required: ['region']
    }
  }
];

// Send response to Claude Desktop
function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    id: id,
    result: result
  };
  console.log(JSON.stringify(response));
}

// Send error to Claude Desktop
function sendError(id, code, message) {
  const response = {
    jsonrpc: '2.0',
    id: id,
    error: {
      code: code,
      message: message
    }
  };
  console.log(JSON.stringify(response));
}

// Call SSE endpoint using http module
async function callSSE(tool, args) {
  return new Promise((resolve, reject) => {
    const url = new URL(SSE_ENDPOINT);
    const data = JSON.stringify({
      tool: tool,
      arguments: args
    });

    const options = {
      hostname: url.hostname,
      port: url.port || 3000,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';

      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const result = JSON.parse(responseData);
            resolve(result);
          } catch (error) {
            reject(new Error(`Failed to parse response: ${error.message}`));
          }
        } else {
          reject(new Error(`SSE error (${res.statusCode}): ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.write(data);
    req.end();
  });
}

// Handle incoming messages
rl.on('line', (line) => {
  buffer += line;
  
  try {
    const message = JSON.parse(buffer);
    buffer = '';
    
    handleMessage(message);
  } catch (e) {
    // Message not complete yet, continue buffering
    if (buffer.length > 100000) {
      // Reset if buffer gets too large
      buffer = '';
      sendError(null, -32700, 'Parse error');
    }
  }
});

// Handle JSON-RPC messages
async function handleMessage(message) {
  try {
    if (message.method === 'initialize') {
      sendResponse(message.id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        },
        serverInfo: {
          name: 'earth-engine-mcp',
          version: '1.0.0'
        }
      });
    } else if (message.method === 'notifications/initialized') {
      // No response needed for notifications
      return;
    } else if (message.method === 'tools/list') {
      sendResponse(message.id, { tools: TOOLS });
    } else if (message.method === 'prompts/list') {
      sendResponse(message.id, { prompts: [] });
    } else if (message.method === 'resources/list') {
      sendResponse(message.id, { resources: [] });
    } else if (message.method === 'tools/call') {
      await handleToolCall(message);
    } else if (message.method === 'shutdown') {
      process.exit(0);
    } else {
      sendError(message.id, -32601, `Method not found: ${message.method}`);
    }
  } catch (error) {
    sendError(message.id, -32603, error.message);
  }
}

  // Handle tool calls
  async function handleToolCall(message) {
    const { name, arguments: args } = message.params;
    
    // Debug logging
    process.stderr.write(`[MCP-SSE] Tool call received: ${name}\n`);
    process.stderr.write(`[MCP-SSE] Arguments: ${JSON.stringify(args, null, 2)}\n`);
    
    try {
      let sseResult;
    
    // Route tool calls to appropriate SSE endpoints
    if (name === 'earth_engine_data' || 
        name === 'earth_engine_process' || 
        name === 'earth_engine_export' || 
        name === 'earth_engine_system' ||
        name === 'earth_engine_map') {
      // Direct consolidated tool call
      sseResult = await callSSE(name, args);
    } else if (name === 'wildfire_risk_assessment') {
      // Call the geospatial model
      sseResult = await callSSE('earth_engine_process', {
        operation: 'model',
        modelType: 'wildfire',
        ...args
      });
    } else if (name === 'flood_risk_assessment') {
      sseResult = await callSSE('earth_engine_process', {
        operation: 'model',
        modelType: 'flood',
        ...args
      });
    } else if (name === 'agricultural_monitoring') {
      sseResult = await callSSE('earth_engine_process', {
        operation: 'model',
        modelType: 'agriculture',
        ...args
      });
    } else if (name === 'deforestation_detection') {
      sseResult = await callSSE('earth_engine_process', {
        operation: 'model',
        modelType: 'deforestation',
        ...args
      });
    } else if (name === 'water_quality_monitoring') {
      sseResult = await callSSE('earth_engine_process', {
        operation: 'model',
        modelType: 'water_quality',
        ...args
      });
    } else if (name === 'crop_classification') {
      // Call the crop classification tool directly
      process.stderr.write(`[MCP-SSE] Routing crop_classification to SSE endpoint\n`);
      sseResult = await callSSE('crop_classification', args);
    } else {
      sendError(message.id, -32602, `Unknown tool: ${name}`);
      return;
    }
    
    // Send result back
    sendResponse(message.id, {
      content: [{
        type: 'text',
        text: JSON.stringify(sseResult, null, 2)
      }]
    });
  } catch (error) {
    sendError(message.id, -32603, error.message);
  }
}

// Log to stderr for debugging
process.stderr.write('[MCP-SSE] Complete Bridge ready with all tools and models\n');
