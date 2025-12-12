#!/usr/bin/env node

const readline = require('readline');
const http = require('http');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.error('[Earth Engine MCP] Starting STABLE server with essential tools only...');

// Essential tools only to prevent crashes
const ESSENTIAL_TOOLS = [
  // Primary shapefile tool
  {
    name: 'convert_place_to_shapefile_geometry',
    description: 'Convert any place name to exact shapefile boundary. Supports cities, states, countries globally.',
    inputSchema: {
      type: 'object',
      properties: {
        placeName: { 
          type: 'string', 
          description: 'Place name like Paris, Tokyo, California, France, etc.' 
        }
      },
      required: ['placeName']
    }
  },
  
  // Essential filtering tool
  {
    name: 'filter_collection_by_date_and_region',
    description: 'Filter satellite image collection by date range and geographic region',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: { 
          type: 'string',
          description: 'Collection ID like COPERNICUS/S2_SR_HARMONIZED'
        },
        start_date: { 
          type: 'string',
          description: 'Start date in YYYY-MM-DD format'
        },
        end_date: { 
          type: 'string',
          description: 'End date in YYYY-MM-DD format'
        },
        region: { 
          type: ['string', 'object'],
          description: 'Place name or GeoJSON geometry'
        },
        cloud_cover_max: { 
          type: 'number',
          description: 'Maximum cloud cover percentage (0-100)'
        }
      },
      required: ['collection_id', 'start_date', 'end_date', 'region']
    }
  },
  
  // Thumbnail generation
  {
    name: 'get_thumbnail_image',
    description: 'Generate a thumbnail image URL for visualization',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { 
          type: 'string',
          description: 'Collection ID'
        },
        dateStart: { type: 'string' },
        dateEnd: { type: 'string' },
        region: { type: ['string', 'object'] },
        visParams: { 
          type: 'object',
          description: 'Visualization parameters (bands, min, max, etc.)'
        }
      },
      required: ['collection', 'region']
    }
  },
  
  // Search catalog
  {
    name: 'search_gee_catalog',
    description: 'Search Earth Engine data catalog for datasets',
    inputSchema: {
      type: 'object',
      properties: {
        query: { 
          type: 'string',
          description: 'Search query like sentinel, landsat, elevation, etc.'
        }
      },
      required: ['query']
    }
  },
  
  // Calculate NDVI
  {
    name: 'calculate_ndvi',
    description: 'Calculate vegetation index (NDVI) for a region',
    inputSchema: {
      type: 'object',
      properties: {
        region: { 
          type: ['string', 'object'],
          description: 'Place name or geometry'
        },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        satellite: { 
          type: 'string',
          enum: ['sentinel2', 'landsat8', 'modis'],
          default: 'sentinel2'
        }
      },
      required: ['region']
    }
  }
];

console.error(`[Earth Engine MCP] Configured with ${ESSENTIAL_TOOLS.length} essential tools only`);

// Forward requests to the actual Next.js server
async function callServer(toolName, args) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      tool: toolName,
      arguments: args
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/mcp/sse',  // Correct endpoint
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      },
      timeout: 30000  // 30 second timeout
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          if (parsed.content && parsed.content[0]) {
            const result = JSON.parse(parsed.content[0].text);
            resolve(result);
          } else {
            resolve({ 
              success: false,
              error: 'Invalid response format from server'
            });
          }
        } catch (e) {
          console.error('[Earth Engine MCP] Parse error:', e.message);
          resolve({ 
            success: false,
            error: 'Failed to parse server response'
          });
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('[Earth Engine MCP] Connection error:', err.message);
      resolve({ 
        success: false,
        error: `Server connection failed: ${err.message}. Make sure the server is running on port 3000.`
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      resolve({ 
        success: false,
        error: 'Request timeout - operation took too long'
      });
    });
    
    req.write(data);
    req.end();
  });
}

// Handle MCP protocol messages
rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    
    if (message.method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { 
            tools: {},
            prompts: {},
            resources: {}
          },
          serverInfo: { 
            name: 'earth-engine-stable', 
            version: '1.0.0' 
          }
        }
      };
      console.log(JSON.stringify(response));
      console.error('[Earth Engine MCP] ✅ Initialized successfully');
      
    } else if (message.method === 'tools/list') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: { 
          tools: ESSENTIAL_TOOLS 
        }
      };
      console.log(JSON.stringify(response));
      console.error(`[Earth Engine MCP] Sent ${ESSENTIAL_TOOLS.length} essential tools`);
      
    } else if (message.method === 'prompts/list') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: { prompts: [] }
      };
      console.log(JSON.stringify(response));
      
    } else if (message.method === 'resources/list') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: { resources: [] }
      };
      console.log(JSON.stringify(response));
      
    } else if (message.method === 'tools/call') {
      const toolName = message.params.name;
      const args = message.params.arguments || {};
      
      console.error(`[Earth Engine MCP] 🔧 Calling tool: ${toolName}`);
      
      // Map tool names if needed (for backward compatibility)
      const toolMapping = {
        'convert_place_to_shapefile_geometry': 'convert_place_to_shapefile_geometry',
        'filter_collection_by_date_and_region': 'filter_collection_by_date_and_region',
        'get_thumbnail_image': 'get_thumbnail_image',
        'search_gee_catalog': 'search_gee_catalog',
        'calculate_ndvi': 'calculate_ndvi'
      };
      
      const mappedTool = toolMapping[toolName] || toolName;
      
      try {
        // Call the actual server
        const result = await callServer(mappedTool, args);
        
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          }
        };
        console.log(JSON.stringify(response));
        console.error(`[Earth Engine MCP] ✅ Tool ${toolName} completed`);
        
      } catch (error) {
        console.error(`[Earth Engine MCP] ❌ Tool error:`, error.message);
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify({
                success: false,
                error: error.message,
                tool: toolName
              })
            }]
          }
        };
        console.log(JSON.stringify(response));
      }
      
    } else if (message.method?.startsWith('notifications/')) {
      // Ignore notifications
      console.error(`[Earth Engine MCP] Notification: ${message.method}`);
      
    } else {
      // Unknown method
      console.error(`[Earth Engine MCP] Unknown method: ${message.method}`);
      if (message.id) {
        const response = {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: `Method not found: ${message.method}`
          }
        };
        console.log(JSON.stringify(response));
      }
    }
    
  } catch (e) {
    console.error('[Earth Engine MCP] ❌ Error handling message:', e.message);
    // Don't crash, just log the error
  }
});

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.error('[Earth Engine MCP] Shutting down...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[Earth Engine MCP] Shutting down...');
  process.exit(0);
});

console.error('====================================');
console.error('🌍 Earth Engine MCP STABLE Server');
console.error('====================================');
console.error('✅ Essential tools only (no crashes)');
console.error('✅ Global shapefile support');
console.error('✅ Proper error handling');
console.error('====================================');
console.error('Tools available:');
console.error('  🗺️ convert_place_to_shapefile_geometry');
console.error('  🛰️ filter_collection_by_date_and_region');
console.error('  🖼️ get_thumbnail_image');
console.error('  🔍 search_gee_catalog');
console.error('  🌱 calculate_ndvi');
console.error('====================================');
