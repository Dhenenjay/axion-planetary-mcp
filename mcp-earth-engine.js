#!/usr/bin/env node

const readline = require('readline');
const http = require('http');

// Create interface for stdio
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Tool definitions
const TOOL_DEFINITIONS = [
  {
    name: 'search_catalog',
    description: 'Search the Google Earth Engine data catalog',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (e.g., "sentinel-2", "landsat", "modis")' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_band_names',
    description: 'Get band names for an Earth Engine dataset',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string', description: 'Dataset ID (e.g., "COPERNICUS/S2_SR_HARMONIZED")' }
      },
      required: ['datasetId']
    }
  },
  {
    name: 'filter_collection',
    description: 'Filter an image collection by date and region',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string', description: 'Dataset ID' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        region: { 
          type: 'object', 
          description: 'GeoJSON geometry',
          properties: {
            type: { type: 'string' },
            coordinates: { type: 'array' }
          }
        }
      },
      required: ['datasetId', 'startDate', 'endDate']
    }
  },
  {
    name: 'calculate_ndvi',
    description: 'Calculate NDVI (Normalized Difference Vegetation Index)',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: { type: 'string', description: 'Image or collection ID' },
        redBand: { type: 'string', description: 'Red band name (default: B4)' },
        nirBand: { type: 'string', description: 'NIR band name (default: B8)' }
      },
      required: ['imageId']
    }
  },
  {
    name: 'get_map_url',
    description: 'Get a map visualization URL for an image',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: { type: 'string', description: 'Image or collection ID' },
        visParams: {
          type: 'object',
          description: 'Visualization parameters',
          properties: {
            bands: { type: 'array', items: { type: 'string' } },
            min: { type: 'number' },
            max: { type: 'number' },
            palette: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      required: ['imageId']
    }
  },
  {
    name: 'calculate_statistics',
    description: 'Calculate statistics for an image',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: { type: 'string', description: 'Image or collection ID' },
        region: { 
          type: 'object', 
          description: 'GeoJSON geometry',
          properties: {
            type: { type: 'string' },
            coordinates: { type: 'array' }
          }
        },
        scale: { type: 'number', description: 'Scale in meters (default: 30)' }
      },
      required: ['imageId']
    }
  },
  {
    name: 'create_composite',
    description: 'Create a cloud-free composite image from a collection',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string', description: 'Dataset ID (e.g., "COPERNICUS/S2_SR_HARMONIZED")' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        region: { 
          type: 'object', 
          description: 'GeoJSON geometry',
          properties: {
            type: { type: 'string' },
            coordinates: { type: 'array' }
          }
        },
        method: { 
          type: 'string', 
          description: 'Composite method (median, mean, min, max, mosaic)',
          enum: ['median', 'mean', 'min', 'max', 'mosaic']
        },
        cloudMask: { type: 'boolean', description: 'Apply cloud masking (default: true)' }
      },
      required: ['datasetId', 'startDate', 'endDate']
    }
  },
  {
    name: 'get_composite_map',
    description: 'Get a visualization URL for a composite image',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string', description: 'Dataset ID' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        region: { 
          type: 'object', 
          description: 'GeoJSON geometry',
          properties: {
            type: { type: 'string' },
            coordinates: { type: 'array' }
          }
        },
        visParams: {
          type: 'object',
          description: 'Visualization parameters',
          properties: {
            bands: { type: 'array', items: { type: 'string' } },
            min: { type: 'number' },
            max: { type: 'number' },
            palette: { type: 'array', items: { type: 'string' } }
          }
        }
      },
      required: ['datasetId', 'startDate', 'endDate']
    }
  },
  {
    name: 'get_thumbnail',
    description: 'Generate a direct viewable thumbnail image URL',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string', description: 'Dataset ID for composite creation' },
        imageId: { type: 'string', description: 'Specific image ID' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        region: { 
          type: 'object', 
          description: 'GeoJSON geometry',
          properties: {
            type: { type: 'string' },
            coordinates: { type: 'array' }
          }
        },
        dimensions: { type: 'string', description: 'Image dimensions (e.g., "512x512", "1024x768")' },
        format: { type: 'string', description: 'Image format (png or jpg)', enum: ['png', 'jpg'] },
        visParams: {
          type: 'object',
          description: 'Visualization parameters',
          properties: {
            bands: { type: 'array', items: { type: 'string' } },
            min: { type: 'number' },
            max: { type: 'number' },
            palette: { type: 'array', items: { type: 'string' } }
          }
        }
      }
    }
  },
  {
    name: 'export_geotiff',
    description: 'Export full resolution GeoTIFF with download link',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string', description: 'Dataset ID for composite creation' },
        imageId: { type: 'string', description: 'Specific image ID' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        region: { 
          type: 'object', 
          description: 'GeoJSON geometry for export area',
          properties: {
            type: { type: 'string' },
            coordinates: { type: 'array' }
          }
        },
        bands: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Specific bands to export (e.g., ["B4", "B3", "B2"])'
        },
        scale: { type: 'number', description: 'Pixel resolution in meters (default: 10 for Sentinel-2)' },
        fileName: { type: 'string', description: 'Output file name (without extension)' },
        crs: { type: 'string', description: 'Coordinate Reference System (default: EPSG:4326)' },
        maxPixels: { type: 'number', description: 'Maximum number of pixels to export' }
      }
    }
  },
  {
    name: 'export_to_drive',
    description: 'Export GeoTIFF to Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string', description: 'Dataset ID for composite creation' },
        imageId: { type: 'string', description: 'Specific image ID' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        region: { 
          type: 'object', 
          description: 'GeoJSON geometry for export area',
          properties: {
            type: { type: 'string' },
            coordinates: { type: 'array' }
          }
        },
        bands: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Specific bands to export'
        },
        scale: { type: 'number', description: 'Pixel resolution in meters' },
        folder: { type: 'string', description: 'Google Drive folder name' },
        fileName: { type: 'string', description: 'Output file name' }
      }
    }
  }
];

let buffer = '';
let initialized = false;

// Initialize Earth Engine on startup
async function initialize() {
  try {
    console.error(`[MCP] Initializing Earth Engine with key: ${EE_KEY_PATH}`);
    await initializeEarthEngine(EE_KEY_PATH);
    initialized = true;
    console.error('[MCP] Earth Engine initialized successfully');
  } catch (error) {
    console.error('[MCP] Failed to initialize Earth Engine:', error.message);
    process.exit(1);
  }
}

// Process incoming messages
rl.on('line', (line) => {
  buffer += line;
  
  try {
    const message = JSON.parse(buffer);
    buffer = '';
    handleMessage(message);
  } catch (e) {
    // Buffer incomplete message
  }
});

// Handle MCP messages
async function handleMessage(message) {
  try {
    if (message.method === 'initialize') {
      // Initialize Earth Engine if not already done
      if (!initialized) {
        await initialize();
      }
      
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
    } else if (message.method === 'tools/list') {
      sendResponse(message.id, { tools: TOOL_DEFINITIONS });
    } else if (message.method === 'prompts/list') {
      sendResponse(message.id, { prompts: [] });
    } else if (message.method === 'resources/list') {
      sendResponse(message.id, { resources: [] });
    } else if (message.method === 'tools/call') {
      await handleToolCall(message);
    } else if (message.method === 'notifications/initialized') {
      // Client notification, no response needed
    } else {
      sendError(message.id, -32601, `Method not found: ${message.method}`);
    }
  } catch (error) {
    console.error('[MCP] Error handling message:', error);
    sendError(message.id, -32603, error.message);
  }
}

// Handle tool calls
async function handleToolCall(message) {
  const { name, arguments: args } = message.params;
  
  try {
    let result;
    
    switch (name) {
      case 'search_catalog':
        result = await tools.searchCatalog(args.query);
        break;
        
      case 'get_band_names':
        result = await tools.getBandNames(args.datasetId);
        break;
        
      case 'filter_collection':
        result = await tools.filterCollection(args);
        break;
        
      case 'calculate_ndvi':
        result = await tools.calculateNDVI(args);
        break;
        
      case 'get_map_url':
        result = await tools.getMapUrl(args);
        break;
        
      case 'calculate_statistics':
        result = await tools.calculateStatistics(args);
        break;
        
      case 'create_composite':
        result = await tools.createComposite(args);
        break;
        
      case 'get_composite_map':
        // For composite map, we use getMapUrl with composite flag
        result = await tools.getMapUrl({
          datasetId: args.datasetId,
          startDate: args.startDate,
          endDate: args.endDate,
          region: args.region,
          visParams: args.visParams,
          composite: true
        });
        break;
        
      case 'get_thumbnail':
        result = await tools.getThumbnail(args);
        break;
        
      case 'export_geotiff':
        result = await tools.exportToDownload(args);
        break;
        
      case 'export_to_drive':
        result = await tools.exportToDrive(args);
        break;
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
    // Format result as MCP response
    sendResponse(message.id, {
      content: [{
        type: 'text',
        text: JSON.stringify(result, null, 2)
      }]
    });
  } catch (error) {
    console.error(`[MCP] Tool error (${name}):`, error);
    sendResponse(message.id, {
      content: [{
        type: 'text',
        text: `Error: ${error.message}`
      }]
    });
  }
}

// Send JSON-RPC response
function sendResponse(id, result) {
  const response = {
    jsonrpc: '2.0',
    id: id,
    result: result
  };
  console.log(JSON.stringify(response));
}

// Send JSON-RPC error
function sendError(id, code, message) {
  const error = {
    jsonrpc: '2.0',
    id: id,
    error: {
      code: code,
      message: message
    }
  };
  console.log(JSON.stringify(error));
}

// Initialize on startup
initialize().catch(error => {
  console.error('[MCP] Startup error:', error);
  process.exit(1);
});
