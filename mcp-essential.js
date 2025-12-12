#!/usr/bin/env node

const readline = require('readline');
const http = require('http');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.error('[Earth Engine MCP] Starting with essential tools only...');

// Only the most essential tools to avoid overloading
const ESSENTIAL_TOOLS = [
  {
    name: 'convert_place_to_shapefile_geometry',
    description: 'Convert place name to exact shapefile boundary',
    inputSchema: {
      type: 'object',
      properties: {
        place_name: { type: 'string' }
      },
      required: ['place_name']
    }
  },
  {
    name: 'filter_collection_by_date_and_region',
    description: 'Filter Earth Engine collection by date and region',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        region: { type: 'string' }
      },
      required: ['collection_id', 'start_date', 'end_date', 'region']
    }
  },
  {
    name: 'get_thumbnail_image',
    description: 'Get thumbnail URL for an image',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        dateStart: { type: 'string' },
        dateEnd: { type: 'string' },
        region: { type: 'string' }
      },
      required: ['collection']
    }
  },
  {
    name: 'create_clean_mosaic',
    description: 'Create cloud-free composite',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        dateStart: { type: 'string' },
        dateEnd: { type: 'string' },
        region: { type: 'string' }
      },
      required: ['collection', 'dateStart', 'dateEnd', 'region']
    }
  },
  {
    name: 'calculate_spectral_index',
    description: 'Calculate NDVI, EVI, or NDWI',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: { type: 'string' },
        index: { type: 'string' }
      },
      required: ['imageId', 'index']
    }
  },
  {
    name: 'search_gee_catalog',
    description: 'Search Earth Engine catalog',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  },
  {
    name: 'export_image_to_cloud_storage',
    description: 'Export satellite imagery composite as Cloud-Optimized GeoTIFF + boundary GeoJSON to Google Cloud Storage',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        region: { type: 'string' },
        scale: { type: 'number', default: 10 },
        bucket: { type: 'string', default: 'earth-engine-exports-stoked-flame-455410-k2' },
        folder: { type: 'string', default: 'exports' }
      },
      required: ['collection', 'start_date', 'end_date', 'region']
    }
  }
];

console.error(`[Earth Engine MCP] Loaded ${ESSENTIAL_TOOLS.length} essential tools`);

// Forward to Next.js server
async function callServer(toolName, args) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      tool: toolName,
      arguments: args
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/mcp/sse',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          console.error('[Earth Engine MCP] Parse error:', e.message);
          resolve({ error: { message: 'Invalid server response' } });
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('[Earth Engine MCP] Connection error:', err.message);
      resolve({ error: { message: err.message } });
    });
    
    req.setTimeout(10000, () => {
      req.destroy();
      resolve({ error: { message: 'Request timeout' } });
    });
    
    req.write(data);
    req.end();
  });
}

// Handle MCP protocol
rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    
    switch(message.method) {
      case 'initialize':
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2025-06-18',
            capabilities: { tools: {} },
            serverInfo: { name: 'earth-engine', version: '2.0.0' }
          }
        }));
        console.error('[Earth Engine MCP] Initialized');
        break;
        
      case 'tools/list':
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: { tools: ESSENTIAL_TOOLS }
        }));
        console.error(`[Earth Engine MCP] Sent ${ESSENTIAL_TOOLS.length} tools`);
        break;
        
      case 'prompts/list':
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: { prompts: [] }
        }));
        break;
        
      case 'resources/list':
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: { resources: [] }
        }));
        break;
        
      case 'tools/call':
        console.error(`[Earth Engine MCP] Calling: ${message.params.name}`);
        
        // Map parameters based on tool name
        let mappedArgs = { ...message.params.arguments };
        
        // Fix parameter mapping for each tool
        if (message.params.name === 'convert_place_to_shapefile_geometry' && message.params.arguments) {
          mappedArgs = {
            placeName: message.params.arguments.place_name
          };
        } else if (message.params.name === 'filter_collection_by_date_and_region' && message.params.arguments) {
          mappedArgs = {
            datasetId: message.params.arguments.collection_id,
            start: message.params.arguments.start_date,
            end: message.params.arguments.end_date,
            aoi: message.params.arguments.region,
            placeName: typeof message.params.arguments.region === 'string' ? message.params.arguments.region : undefined
          };
        } else if (message.params.name === 'search_gee_catalog' && message.params.arguments) {
          mappedArgs = {
            query: message.params.arguments.query
          };
        } else if (message.params.name === 'get_thumbnail_image' && message.params.arguments) {
          mappedArgs = {
            datasetId: message.params.arguments.collection,
            start: message.params.arguments.dateStart,
            end: message.params.arguments.dateEnd,
            aoi: message.params.arguments.region
          };
        } else if (message.params.name === 'create_clean_mosaic' && message.params.arguments) {
          mappedArgs = {
            datasetId: message.params.arguments.collection,
            start: message.params.arguments.dateStart,
            end: message.params.arguments.dateEnd
          };
        } else if (message.params.name === 'export_image_to_drive' && message.params.arguments) {
          // Simple parameter pass-through for export
          mappedArgs = message.params.arguments;
        } else if (message.params.name === 'calculate_spectral_index' && message.params.arguments) {
          mappedArgs = {
            imageId: message.params.arguments.imageId,
            index: message.params.arguments.index
          };
        }
        
        const serverResponse = await callServer(message.params.name, mappedArgs);
        
        // The server returns either { content: [...] } or { error: ... }
        if (serverResponse.error) {
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32603,
              message: serverResponse.error
            }
          }));
        } else if (serverResponse.content) {
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: serverResponse
          }));
        } else {
          // Fallback - wrap response in content array
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              content: [{
                type: 'text',
                text: JSON.stringify(serverResponse)
              }]
            }
          }));
        }
        console.error(`[Earth Engine MCP] Completed: ${message.params.name}`);
        break;
        
      default:
        if (!message.method?.startsWith('notifications/')) {
          console.error(`[Earth Engine MCP] Unknown method: ${message.method}`);
        }
    }
  } catch (e) {
    console.error('[Earth Engine MCP] Error:', e.message);
  }
});

console.error('[Earth Engine MCP] Ready with 7 essential tools:');
console.error('  • convert_place_to_shapefile_geometry');
console.error('  • filter_collection_by_date_and_region');
console.error('  • get_thumbnail_image');
console.error('  • create_clean_mosaic');
console.error('  • calculate_spectral_index');
console.error('  • search_gee_catalog');
console.error('  • export_image_to_drive (FIXED - stable version!)');
