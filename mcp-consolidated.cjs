#!/usr/bin/env node

const readline = require('readline');
const http = require('http');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.error('[Earth Engine MCP] Starting CONSOLIDATED server with 6 super tools...');

// The consolidated super tools that replace all 30+ individual tools
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
  },
  {
    name: 'earth_engine_map',
    description: 'Create interactive maps with Earth Engine layers, visualizations and analysis',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'The map operation to perform: create, layer, style, export, or analyze'
        },
        // Map configuration
        center_lat: { type: 'number', description: 'Center latitude for the map' },
        center_lon: { type: 'number', description: 'Center longitude for the map' },
        zoom: { type: 'number', description: 'Initial zoom level (1-20)' },
        basemap: { type: 'string', description: 'Base map style (satellite, terrain, roadmap, hybrid)' },
        // Layers
        layers: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              collection: { type: 'string' },
              visualization: { type: 'object' },
              opacity: { type: 'number' }
            }
          },
          description: 'Map layers configuration'
        },
        // Analysis
        analysis_type: {
          type: 'string',
          description: 'Type of map analysis (split, swipe, timeseries, comparison)'
        },
        // Export
        width: { type: 'number', description: 'Map width in pixels for export' },
        height: { type: 'number', description: 'Map height in pixels for export' },
        format: { type: 'string', description: 'Export format (png, jpg, html)' }
      },
      required: ['operation']
    }
  },
  {
    name: 'crop_classification',
    description: 'Comprehensive crop classification and agricultural analysis using machine learning',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          description: 'Classification operation: classify, train, validate, or analyze'
        },
        region: { type: 'string', description: 'Region for analysis (place name or GeoJSON)' },
        year: { type: 'number', description: 'Year for analysis' },
        classifier_type: {
          type: 'string',
          description: 'ML classifier type (randomForest, svm, cart, naiveBayes)'
        },
        crop_types: {
          type: 'array',
          items: { type: 'string' },
          description: 'Crop types to classify'
        },
        training_data: { type: 'string', description: 'Training data asset ID or automatic sampling' },
        validation_split: { type: 'number', description: 'Validation data percentage (0-1)' },
        include_indices: {
          type: 'boolean',
          description: 'Include spectral indices in classification'
        },
        export_results: {
          type: 'boolean',
          description: 'Export classification results'
        }
      },
      required: ['operation', 'region']
    }
  }
];

console.error(`[Earth Engine MCP] Loaded ${CONSOLIDATED_TOOLS.length} consolidated super tools`);
console.error('[Earth Engine MCP] These 6 tools replace all 30+ individual tools');

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
      console.error('[Earth Engine MCP] Make sure the Next.js server is running on port 3000');
      console.error('[Earth Engine MCP] Run: npm run start:next');
      resolve({ error: { message: `Server not available: ${err.message}. Run 'npm run start:next' first.` } });
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
            protocolVersion: '2024-11-05',
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
                text: JSON.stringify(result.result || result, null, 2)
              }]
            }
          }));
        }
        break;
        
      default:
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
    console.error('[Earth Engine MCP] Error processing message:', e.message);
  }
});

console.error('[Earth Engine MCP] ✅ Server ready for connections');
console.error('[Earth Engine MCP] ⚠️  Make sure Next.js server is running on port 3000');