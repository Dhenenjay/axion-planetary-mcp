#!/usr/bin/env node

const readline = require('readline');
const http = require('http');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.error('[Earth Engine MCP] Starting CONSOLIDATED server with 4 super tools...');

// The 4 consolidated super tools that replace all 30+ individual tools
const CONSOLIDATED_TOOLS = [
  {
    name: 'earth_engine_data',
    description: 'Handle Earth Engine data operations: search catalog, get info, filter collections, and geometry operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { 
          type: 'string',
          description: 'The data operation to perform: search, filter, geometry, info, or boundaries'
        },
        // Search catalog params
        query: { type: 'string', description: 'Search query for catalog' },
        // Get info params
        assetId: { type: 'string', description: 'Asset ID to get info for' },
        // Filter collection params
        collection_id: { type: 'string', description: 'Collection ID to filter' },
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
        // Geometry params
        region: { type: 'string', description: 'Region as place name or GeoJSON' },
        place_name: { type: 'string', description: 'Place name to convert to geometry' },
        geometry_type: { type: 'string', description: 'Type of geometry operation' },
        // Additional filters
        cloud_cover_max: { type: 'number', description: 'Maximum cloud cover percentage' },
        bands: { 
          type: 'array', 
          items: { type: 'string' },
          description: 'Bands to select'
        }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_process',
    description: 'Process and analyze Earth Engine data: spectral indices, statistics, composites, terrain, masking, and resampling',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { 
          type: 'string',
          description: 'The processing operation to perform: index, analyze, composite, terrain, clip, mask, or resample'
        },
        // Common params
        collection: { type: 'string', description: 'Collection ID or image ID' },
        imageId: { type: 'string', description: 'Image asset ID' },
        start_date: { type: 'string', description: 'Start date for collection filtering' },
        end_date: { type: 'string', description: 'End date for collection filtering' },
        region: { type: 'string', description: 'Region for processing' },
        // Index calculation
        index: { 
          type: 'string',
          description: 'Spectral index to calculate (NDVI, EVI, NDWI, NDBI, SAVI, MNDWI)'
        },
        // Statistics
        statistic: { 
          type: 'string',
          description: 'Statistical operation (mean, median, min, max, std, variance, sum)'
        },
        reducer: { type: 'string', description: 'Reducer type for statistics' },
        // Composite
        composite_type: {
          type: 'string',
          description: 'Type of composite to create (median, mean, mosaic, quality_mosaic, greenest)'
        },
        // Terrain
        terrain_type: {
          type: 'string',
          description: 'Terrain product to generate (elevation, slope, aspect, hillshade)'
        },
        // Masking
        mask_type: {
          type: 'string',
          description: 'Type of mask to apply (cloud, water, quality, threshold)'
        },
        threshold: { type: 'number', description: 'Threshold value for masking' },
        // Resampling
        scale: { type: 'number', description: 'Scale in meters for resampling' },
        projection: { type: 'string', description: 'Target projection' },
        resampling_method: {
          type: 'string',
          description: 'Resampling method (bilinear, bicubic, nearest)'
        }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_export',
    description: 'Export, visualize and share Earth Engine data: thumbnails, exports to cloud storage, map tiles, and download links',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { 
          type: 'string',
          description: 'The export operation to perform: thumbnail, export, tiles, status, or download'
        },
        // Common params
        collection: { type: 'string', description: 'Collection ID' },
        imageId: { type: 'string', description: 'Image asset ID' },
        start_date: { type: 'string', description: 'Start date' },
        end_date: { type: 'string', description: 'End date' },
        region: { type: 'string', description: 'Export region' },
        // Visualization
        visualization: {
          type: 'object',
          properties: {
            bands: { type: 'array', items: { type: 'string' } },
            min: { type: 'array', items: { type: 'number' } },
            max: { type: 'array', items: { type: 'number' } },
            palette: { type: 'array', items: { type: 'string' } },
            gamma: { type: 'number' }
          },
          description: 'Visualization parameters'
        },
        // Export params
        scale: { type: 'number', description: 'Export scale in meters (default: 10)' },
        crs: { type: 'string', description: 'Coordinate reference system (default: EPSG:4326)' },
        format: { 
          type: 'string',
          description: 'Export format (GeoTIFF, PNG, JPG, NPY, TFRecord)'
        },
        bucket: { type: 'string', description: 'GCS bucket name (default: earth-engine-exports-stoked-flame-455410-k2)' },
        folder: { type: 'string', description: 'Export folder (default: exports)' },
        filename_prefix: { type: 'string', description: 'Filename prefix for export' },
        // Task management
        task_id: { type: 'string', description: 'Export task ID to check status' },
        // Video export
        fps: { type: 'number', description: 'Frames per second for video export' },
        dimensions: { type: 'string', description: 'Video dimensions (e.g., 1920x1080)' }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_system',
    description: 'System and utility operations: authentication, custom code execution, external data loading, and server management',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { 
          type: 'string',
          description: 'The system operation to perform: auth, execute, setup, load, or system'
        },
        // Custom code execution
        code: { type: 'string', description: 'Custom Earth Engine JavaScript code to execute' },
        // External data
        data_source: {
          type: 'string',
          description: 'External data source type (shapefile, geojson, csv, kml)'
        },
        data_url: { type: 'string', description: 'URL to external data' },
        data_content: { type: 'string', description: 'Direct data content' },
        // Asset management
        asset_id: { type: 'string', description: 'Asset ID for operations' },
        asset_type: {
          type: 'string',
          description: 'Type of asset (Image, ImageCollection, Table, Folder)'
        },
        properties: { type: 'object', description: 'Asset properties' },
        // System
        include_details: { type: 'boolean', description: 'Include detailed information (default: false)' }
      },
      required: ['operation']
    }
  }
];

console.error(`[Earth Engine MCP] Loaded ${CONSOLIDATED_TOOLS.length} consolidated super tools`);
console.error('[Earth Engine MCP] These 4 tools replace all 30+ individual tools');

// Forward to Next.js server using the consolidated endpoint
async function callServer(toolName, args) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      tool: toolName,
      arguments: args
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/api/mcp/consolidated', // Use consolidated endpoint
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
    
    req.setTimeout(30000, () => { // Increased timeout for complex operations
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
            serverInfo: { 
              name: 'earth-engine-consolidated', 
              version: '2.0.0'
            }
          }
        }));
        console.error('[Earth Engine MCP] Initialized with consolidated tools');
        break;
        
      case 'tools/list':
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: { tools: CONSOLIDATED_TOOLS }
        }));
        console.error(`[Earth Engine MCP] Sent ${CONSOLIDATED_TOOLS.length} consolidated super tools`);
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
        const { name, arguments: args } = message.params;
        console.error(`[Earth Engine MCP] Calling tool: ${name}`);
        console.error(`[Earth Engine MCP] Arguments:`, JSON.stringify(args, null, 2));
        
        const startTime = Date.now();
        const result = await callServer(name, args);
        const duration = Date.now() - startTime;
        
        console.error(`[Earth Engine MCP] Tool ${name} completed in ${duration}ms`);
        
        if (result.error) {
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32603,
              message: result.error.message || 'Tool execution failed'
            }
          }));
        } else {
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            result: {
              content: [{
                type: 'text',
                text: typeof result === 'string' ? result : JSON.stringify(result, null, 2)
              }]
            }
          }));
        }
        break;
        
      default:
        // Only send error response if message has an id (is a request, not a notification)
        if (message.id !== undefined) {
          console.log(JSON.stringify({
            jsonrpc: '2.0',
            id: message.id,
            error: {
              code: -32601,
              message: `Method not found: ${message.method}`
            }
          }));
        } else {
          console.error(`[Earth Engine MCP] Received notification: ${message.method}`);
        }
    }
  } catch (e) {
    console.error('[Earth Engine MCP] Error:', e.message);
    // If we can't parse the message, just log it
    console.error('[Earth Engine MCP] Raw message:', line);
  }
});

console.error('[Earth Engine MCP] Ready for requests');
console.error('[Earth Engine MCP] ✅ Consolidated architecture prevents MCP client crashes');
console.error('[Earth Engine MCP] ✅ 87% reduction in tool count (30 → 4)');
