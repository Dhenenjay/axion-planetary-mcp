#!/usr/bin/env node

/**
 * Simple MCP to SSE Bridge using raw stdio
 * Connects Claude Desktop to Earth Engine SSE endpoint
 */

const readline = require('readline');
const fetch = require('node-fetch');

const SSE_ENDPOINT = 'http://localhost:3000/api/mcp/sse';

// Create readline interface for stdio communication
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Buffer for incomplete messages
let buffer = '';

// Available tools
const TOOLS = [
  {
    name: 'earth_engine_auth_check',
    description: 'Check Earth Engine authentication status',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'earth_engine_search',
    description: 'Search Google Earth Engine data catalog',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query' },
        limit: { type: 'number', description: 'Max results', default: 10 }
      },
      required: ['query']
    }
  },
  {
    name: 'earth_engine_calculate_ndvi',
    description: 'Calculate NDVI for a region',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Region name' },
        startDate: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        endDate: { type: 'string', description: 'End date (YYYY-MM-DD)' }
      },
      required: ['region', 'startDate', 'endDate']
    }
  },
  {
    name: 'earth_engine_visualize',
    description: 'Generate visualization of Earth Engine data',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string', description: 'Dataset ID' },
        region: { type: 'string', description: 'Region to visualize' },
        startDate: { type: 'string', description: 'Start date' },
        endDate: { type: 'string', description: 'End date' }
      },
      required: ['datasetId', 'region']
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

// Call SSE endpoint
async function callSSE(tool, args) {
  try {
    const response = await fetch(SSE_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        tool: tool,
        arguments: args
      })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`SSE error (${response.status}): ${error}`);
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
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
          name: 'earth-engine-sse',
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
  
  try {
    let sseResult;
    
    switch (name) {
      case 'earth_engine_auth_check':
        sseResult = await callSSE('earth_engine_system', { operation: 'auth' });
        break;
        
      case 'earth_engine_search':
        sseResult = await callSSE('earth_engine_data', {
          operation: 'search',
          query: args.query,
          limit: args.limit || 10
        });
        break;
        
      case 'earth_engine_calculate_ndvi':
        sseResult = await callSSE('earth_engine_process', {
          operation: 'index',
          indexType: 'NDVI',
          datasetId: 'COPERNICUS/S2_SR_HARMONIZED',
          startDate: args.startDate,
          endDate: args.endDate,
          region: args.region
        });
        break;
        
      case 'earth_engine_visualize':
        sseResult = await callSSE('earth_engine_export', {
          operation: 'thumbnail',
          datasetId: args.datasetId,
          startDate: args.startDate || '2024-01-01',
          endDate: args.endDate || '2024-12-31',
          region: args.region,
          dimensions: 512,
          visParams: {
            bands: ['B4', 'B3', 'B2'],
            min: 0,
            max: 3000
          }
        });
        break;
        
      default:
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
process.stderr.write('[MCP-SSE] Bridge ready\n');
