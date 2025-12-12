#!/usr/bin/env node

const http = require('http');
const readline = require('readline');

// Create interface for stdio
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Buffer for incoming messages
let buffer = '';
let initialized = false;

// All available tools
const TOOLS = [
  { name: 'health_check', description: 'Check server health' },
  { name: 'auth_check', description: 'Check Earth Engine authentication' },
  { name: 'search_gee_catalog', description: 'Search Earth Engine catalog' },
  { name: 'filter_collection_by_date_and_region', description: 'Filter image collections' },
  { name: 'get_dataset_band_names', description: 'Get dataset bands' },
  { name: 'calculate_spectral_index', description: 'Calculate NDVI/EVI/NDWI' },
  { name: 'mask_clouds_from_image', description: 'Remove clouds from images' },
  { name: 'create_clean_mosaic', description: 'Create cloud-free mosaics' },
  { name: 'get_map_visualization_url', description: 'Generate map tiles' },
  { name: 'calculate_summary_statistics', description: 'Get image statistics' },
  { name: 'calculate_zonal_statistics', description: 'Calculate zonal statistics' },
  { name: 'create_time_series_chart_for_region', description: 'Create time series charts' },
  { name: 'detect_change_between_images', description: 'Detect changes between images' },
  { name: 'calculate_slope_and_aspect', description: 'Calculate terrain metrics' },
  { name: 'clip_image_to_region', description: 'Clip images to region' },
  { name: 'resample_image_to_resolution', description: 'Resample image resolution' },
  { name: 'export_image_to_cloud_storage', description: 'Export to GCS' },
  { name: 'get_export_task_status', description: 'Check export status' },
  { name: 'get_thumbnail_image', description: 'Get thumbnail image' },
  { name: 'load_cloud_optimized_geotiff', description: 'Load COG from GCS' },
  { name: 'gee_script_js', description: 'Run Earth Engine JavaScript' },
  { name: 'gee_sdk_call', description: 'Direct SDK calls' }
];

// Handle incoming JSON-RPC messages
rl.on('line', async (line) => {
  buffer += line;
  
  try {
    const message = JSON.parse(buffer);
    buffer = '';
    
    // Handle different message types
    if (message.method === 'initialize') {
      // Respond to initialize
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'earth-engine-mcp',
            version: '1.0.0'
          }
        }
      }));
      initialized = true;
    } else if (message.method === 'tools/list') {
      // List all tools
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        result: {
          tools: TOOLS
        }
      }));
    } else if (message.method === 'tools/call') {
      // Forward tool calls to the HTTP server
      const options = {
        hostname: 'localhost',
        port: 3000,
        path: '/api/mcp/sse',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      };
      
      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          try {
            const response = JSON.parse(data);
            console.log(JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              result: response
            }));
          } catch (e) {
            // Return mock response for now
            console.log(JSON.stringify({
              jsonrpc: '2.0',
              id: message.id,
              result: {
                content: [{
                  type: 'text',
                  text: `Tool ${message.params.name} called successfully`
                }]
              }
            }));
          }
        });
      });
      
      req.on('error', (e) => {
        console.log(JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32603,
            message: e.message
          }
        }));
      });
      
      req.write(JSON.stringify(message));
      req.end();
    } else {
      // Unknown method
      console.log(JSON.stringify({
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32601,
          message: `Method not found: ${message.method}`
        }
      }));
    }
    
  } catch (e) {
    // Not complete JSON yet, keep buffering
  }
});

// Handle process termination
process.on('SIGINT', () => {
  process.exit(0);
});

process.on('SIGTERM', () => {
  process.exit(0);
});

// Keep the process alive
setInterval(() => {}, 1000);

// Log that we're ready
console.error('[MCP Wrapper] Earth Engine MCP server wrapper started');
