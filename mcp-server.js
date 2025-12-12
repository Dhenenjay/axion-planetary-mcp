#!/usr/bin/env node
/**
 * MCP Server Wrapper for Claude Desktop
 * This wrapper ensures the server starts properly with stdio transport
 */

// Direct invocation of the main function
process.env.GOOGLE_APPLICATION_CREDENTIALS = process.env.GOOGLE_APPLICATION_CREDENTIALS || 'C:\\Users\\Dhenenjay\\Downloads\\ee-key.json';

// Force the main function to run
process.argv[1] = import.meta.url.replace('file:///', '');

import('./dist/index.mjs').then(() => {
  console.error('MCP Server module loaded');
});

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const fs = require('fs');
const path = require('path');

// Create readline interface for stdio communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// All available Earth Engine tools
const TOOLS = [
  {
    name: 'health_check',
    description: 'Check if the Earth Engine MCP server is running',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'auth_check',
    description: 'Verify Earth Engine authentication status',
    inputSchema: {
      type: 'object',
      properties: {}
    }
  },
  {
    name: 'search_gee_catalog',
    description: 'Search the Google Earth Engine data catalog for datasets',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query (e.g., "Sentinel-2", "NDVI", "Landsat")'
        }
      },
      required: ['query']
    }
  },
  {
    name: 'filter_collection_by_date_and_region',
    description: 'Filter an Earth Engine image collection by date range and geographic region',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: {
          type: 'string',
          description: 'Dataset ID (e.g., "COPERNICUS/S2_SR")'
        },
        startDate: {
          type: 'string',
          description: 'Start date in YYYY-MM-DD format'
        },
        endDate: {
          type: 'string',
          description: 'End date in YYYY-MM-DD format'
        },
        region: {
          type: 'object',
          description: 'GeoJSON geometry for the region of interest'
        }
      },
      required: ['datasetId', 'startDate', 'endDate']
    }
  },
  {
    name: 'get_dataset_band_names',
    description: 'Get the band names for a specific Earth Engine dataset',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: {
          type: 'string',
          description: 'Dataset ID (e.g., "COPERNICUS/S2_SR")'
        }
      },
      required: ['datasetId']
    }
  },
  {
    name: 'calculate_spectral_index',
    description: 'Calculate spectral indices like NDVI, EVI, NDWI from satellite imagery',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: {
          type: 'string',
          description: 'Image ID or collection ID'
        },
        index: {
          type: 'string',
          description: 'Index type: NDVI, EVI, NDWI, etc.',
          enum: ['NDVI', 'EVI', 'NDWI', 'SAVI', 'MSAVI']
        }
      },
      required: ['imageId', 'index']
    }
  },
  {
    name: 'get_map_visualization_url',
    description: 'Generate a tile URL for visualizing Earth Engine imagery on a map',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: {
          type: 'string',
          description: 'Image ID to visualize'
        },
        visParams: {
          type: 'object',
          description: 'Visualization parameters (bands, min, max, palette)',
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
    name: 'calculate_summary_statistics',
    description: 'Calculate statistics (mean, min, max, std) for an image within a region',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: {
          type: 'string',
          description: 'Image ID'
        },
        region: {
          type: 'object',
          description: 'GeoJSON geometry for the region'
        },
        scale: {
          type: 'number',
          description: 'Scale in meters for the calculation'
        }
      },
      required: ['imageId']
    }
  }
];

// Message buffer for parsing JSON-RPC messages
let messageBuffer = '';

// Process incoming messages
rl.on('line', (line) => {
  messageBuffer += line + '\n';
  
  // Try to parse complete JSON messages
  try {
    const message = JSON.parse(messageBuffer);
    messageBuffer = '';
    handleMessage(message);
  } catch (e) {
    // Message not complete yet, continue buffering
    if (messageBuffer.length > 100000) {
      // Reset buffer if it gets too large
      messageBuffer = '';
      sendError(null, -32700, 'Parse error');
    }
  }
});

// Handle JSON-RPC messages
function handleMessage(message) {
  if (message.method === 'initialize') {
    handleInitialize(message);
  } else if (message.method === 'tools/list') {
    handleToolsList(message);
  } else if (message.method === 'tools/call') {
    handleToolCall(message);
  } else if (message.method === 'shutdown') {
    process.exit(0);
  } else {
    sendError(message.id, -32601, `Method not found: ${message.method}`);
  }
}

// Handle initialize request
function handleInitialize(message) {
  sendResponse(message.id, {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {}
    },
    serverInfo: {
      name: 'earth-engine-mcp',
      version: '1.0.0'
    }
  });
}

// Handle tools/list request
function handleToolsList(message) {
  sendResponse(message.id, {
    tools: TOOLS
  });
}

// Handle tool execution
async function handleToolCall(message) {
  const { name, arguments: args } = message.params;
  
  try {
    // For now, return mock responses
    // In production, these would call the actual Earth Engine API
    let result;
    
    switch (name) {
      case 'health_check':
        result = {
          content: [{
            type: 'text',
            text: 'Earth Engine MCP server is running and healthy'
          }]
        };
        break;
        
      case 'auth_check':
        result = {
          content: [{
            type: 'text',
            text: 'Earth Engine authentication is configured (mock response)'
          }]
        };
        break;
        
      case 'search_gee_catalog':
        result = {
          content: [{
            type: 'text',
            text: `Searching for: ${args.query}\n\nFound datasets:\n1. COPERNICUS/S2_SR - Sentinel-2 Surface Reflectance\n2. LANDSAT/LC08/C02/T1_L2 - Landsat 8 Collection 2 Tier 1\n3. MODIS/006/MOD13Q1 - MODIS Vegetation Indices`
          }]
        };
        break;
        
      case 'get_dataset_band_names':
        result = {
          content: [{
            type: 'text',
            text: `Bands for ${args.datasetId}:\n- B1: Coastal aerosol\n- B2: Blue\n- B3: Green\n- B4: Red\n- B5: Red Edge 1\n- B8: NIR\n- B11: SWIR 1\n- B12: SWIR 2`
          }]
        };
        break;
        
      default:
        result = {
          content: [{
            type: 'text',
            text: `Tool ${name} executed successfully with arguments: ${JSON.stringify(args)}`
          }]
        };
    }
    
    sendResponse(message.id, result);
  } catch (error) {
    sendError(message.id, -32603, `Tool execution error: ${error.message}`);
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

// Handle process termination
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Log to stderr for debugging
process.stderr.write('[Earth Engine MCP] Server started\n');
