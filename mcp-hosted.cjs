#!/usr/bin/env node

/**
 * MCP-SSE Bridge for Hosted Service
 * Connects to the deployed Render service instead of localhost
 */

const readline = require('readline');
const https = require('https');
const { URL } = require('url');

// Get the API URL from environment or use the default Render URL
const API_BASE_URL = process.env.AXION_API_URL || 'https://axion-planetary-mcp.onrender.com';
const SSE_ENDPOINT = `${API_BASE_URL}/api/mcp/sse`;

console.error(`[MCP Bridge] Connecting to hosted service at ${API_BASE_URL}`);

// Create readline interface for stdio communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Prevent the readline interface from closing
rl.on('pause', () => {
  console.error('[MCP Bridge] Readline paused, resuming...');
  rl.resume();
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
          description: 'Map operation'
        },
        title: { type: 'string', description: 'Map title' },
        datasets: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              datasetId: { type: 'string' },
              visParams: { type: 'object' },
              name: { type: 'string' },
              opacity: { type: 'number' }
            }
          },
          description: 'Datasets to display'
        },
        region: { type: 'string', description: 'Region to display' },
        center: {
          type: 'object',
          properties: {
            lat: { type: 'number' },
            lng: { type: 'number' }
          },
          description: 'Map center coordinates'
        },
        zoom: { type: 'number', description: 'Initial zoom level', default: 8 },
        mapId: { type: 'string', description: 'Map ID for operations' }
      },
      required: ['operation']
    }
  }
];

// Pre-trained models
const MODELS = [
  {
    name: 'wildfire_risk_assessment',
    description: 'Assess wildfire risk using vegetation indices and terrain analysis',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Region name or coordinates' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        indices: {
          type: 'array',
          items: { type: 'string' },
          description: 'Vegetation indices to calculate'
        }
      },
      required: ['region']
    }
  },
  {
    name: 'flood_risk_assessment',
    description: 'Analyze flood risk using precipitation, elevation, and water indices',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Region name or coordinates' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        floodType: {
          type: 'string',
          enum: ['urban', 'coastal', 'riverine', 'snowmelt'],
          description: 'Type of flood to assess'
        }
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
        region: { type: 'string', description: 'Region name or coordinates' },
        cropType: { type: 'string', description: 'Type of crop' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        analysisType: {
          type: 'string',
          enum: ['health', 'irrigation', 'yield', 'stress'],
          description: 'Type of analysis'
        }
      },
      required: ['region']
    }
  },
  {
    name: 'deforestation_detection',
    description: 'Detect and monitor deforestation patterns',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Region name or coordinates' },
        baselineYear: { type: 'number', description: 'Baseline year for comparison' },
        currentYear: { type: 'number', description: 'Current year for analysis' },
        sensitivity: {
          type: 'string',
          enum: ['low', 'medium', 'high'],
          description: 'Detection sensitivity'
        }
      },
      required: ['region']
    }
  },
  {
    name: 'water_quality_analysis',
    description: 'Analyze water quality using spectral indices',
    inputSchema: {
      type: 'object',
      properties: {
        waterBody: { type: 'string', description: 'Name of water body' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        parameters: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['chlorophyll', 'turbidity', 'temperature', 'algae']
          },
          description: 'Water quality parameters'
        }
      },
      required: ['waterBody']
    }
  }
];

// Combine tools and models
const ALL_TOOLS = [...TOOLS, ...MODELS];

// Handle readline close event
rl.on('close', () => {
  console.error('[MCP Bridge] Readline interface closed');
  // Don't exit - let the process continue running
});

// Handle incoming messages from MCP client
rl.on('line', (line) => {
  try {
    // Each line should be a complete JSON message
    const message = JSON.parse(line);
    handleMessage(message);
  } catch (e) {
    // If it's not valid JSON, try to buffer it
    buffer += line;
    
    // Try to parse the buffer as complete JSON
    try {
      const message = JSON.parse(buffer);
      handleMessage(message);
      buffer = ''; // Clear buffer after successful parse
    } catch (bufferError) {
      // Still not valid, keep buffering
      // But prevent buffer from growing too large
      if (buffer.length > 100000) {
        console.error('[MCP Bridge] Buffer too large, clearing');
        buffer = '';
      }
    }
  }
});

// Handle different message types
async function handleMessage(message) {
  const { id, method, params } = message;
  
  console.error(`[MCP Bridge] Received ${method} request`);
  
  // Validate message structure
  if (!method) {
    console.error('[MCP Bridge] Invalid message: missing method');
    if (id !== undefined) {
      sendError(id, -32600, 'Invalid Request: missing method');
    }
    return;
  }
  
  switch (method) {
    case 'initialize':
      // Match the client's protocol version
      const clientVersion = params?.protocolVersion || '2025-06-18';
      sendResponse(id, {
        protocolVersion: clientVersion,
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'Axion Planetary MCP (Hosted)',
          version: '1.2.8'
        }
      });
      console.error('[MCP Bridge] Initialization complete, staying alive...');
      break;
      
    case 'initialized':
      // This is a notification, no response needed
      console.error('[MCP Bridge] Client confirmed initialization');
      break;
      
    case 'tools/list':
      sendResponse(id, {
        tools: ALL_TOOLS.map(tool => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        }))
      });
      break;
      
    case 'prompts/list':
      // We don't have prompts, return empty array
      sendResponse(id, {
        prompts: []
      });
      break;
      
    case 'resources/list':
      // We don't have resources, return empty array
      sendResponse(id, {
        resources: []
      });
      break;
      
    case 'tools/call':
      await handleToolCall(id, params);
      break;
      
    default:
      sendError(id, -32601, `Method not supported: ${method}`);
  }
}

// Send response back to MCP client
function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    result
  };
  // Only include id if it's defined
  if (id !== undefined) {
    response.id = id;
  }
  // Write directly to stdout with newline for proper JSON-RPC
  process.stdout.write(JSON.stringify(response) + '\n');
}

// Send error response
function sendError(id, code, message) {
  const response = {
    jsonrpc: '2.0',
    error: {
      code,
      message
    }
  };
  // Only include id if it's defined
  if (id !== undefined) {
    response.id = id;
  }
  // Write directly to stdout with newline for proper JSON-RPC
  process.stdout.write(JSON.stringify(response) + '\n');
}

// Make HTTPS request to hosted service
function makeRequest(data) {
  return new Promise((resolve, reject) => {
    const url = new URL(SSE_ENDPOINT);
    const postData = JSON.stringify(data);
    
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': postData.length
      }
    };
    
    const req = https.request(options, (res) => {
      let responseData = '';
      
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      
      res.on('end', () => {
        try {
          const result = JSON.parse(responseData);
          resolve(result);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${responseData}`));
        }
      });
    });
    
    req.on('error', (error) => {
      reject(error);
    });
    
    req.write(postData);
    req.end();
  });
}

// Handle tool execution
async function handleToolCall(id, params) {
  const { name: tool, arguments: args } = params;
  
  console.error(`[MCP Bridge] Executing tool: ${tool}`);
  
  try {
    // Make request to hosted service
    const result = await makeRequest({
      method: 'tools/call',
      params: {
        tool,
        arguments: args
      }
    });
    
    sendResponse(id, {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
        }
      ]
    });
  } catch (error) {
    console.error(`[MCP Bridge] Tool execution error:`, error);
    sendResponse(id, {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`
        }
      ],
      isError: true
    });
  }
}

// Health check
setInterval(async () => {
  try {
    const url = new URL(`${API_BASE_URL}/api/health`);
    https.get(url.href, (res) => {
      if (res.statusCode !== 200) {
        console.error(`[MCP Bridge] Health check failed: ${res.statusCode}`);
      }
    }).on('error', (err) => {
      console.error(`[MCP Bridge] Health check error:`, err.message);
    });
  } catch (error) {
    console.error(`[MCP Bridge] Health check error:`, error.message);
  }
}, 60000); // Check every minute

console.error('[MCP Bridge] Ready to receive commands from hosted service');

// Keep the process alive
process.stdin.resume();

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.error('[MCP Bridge] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[MCP Bridge] Shutting down...');
  process.exit(0);
});
