#!/usr/bin/env node

const readline = require('readline');
const http = require('http');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.error('[Earth Engine MCP] Starting server with all tools...');

// Complete tool definitions with proper schemas
const ALL_TOOLS = [
  // Shapefile tools
  {
    name: 'convert_place_to_shapefile_geometry',
    description: 'Convert any place name to exact shapefile boundary from Earth Engine datasets',
    inputSchema: {
      type: 'object',
      properties: {
        place_name: { type: 'string', description: 'Name like San Francisco, Los Angeles, California' }
      },
      required: ['place_name']
    }
  },
  {
    name: 'get_shapefile_boundary', 
    description: 'Get exact administrative boundary shapefile for any location',
    inputSchema: {
      type: 'object',
      properties: {
        placeName: { type: 'string' },
        level: { type: 'string', enum: ['county', 'state', 'country', 'auto'], default: 'auto' }
      },
      required: ['placeName']
    }
  },
  {
    name: 'use_shapefile_instead_of_bbox',
    description: 'Convert bounding box to exact administrative shapefile',
    inputSchema: {
      type: 'object',
      properties: {
        place: { type: 'string' }
      },
      required: ['place']
    }
  },
  {
    name: 'import_custom_shapefile',
    description: 'Import custom shapefile as Earth Engine asset',
    inputSchema: {
      type: 'object',
      properties: {
        geojson: { type: 'object' },
        name: { type: 'string' }
      },
      required: ['geojson', 'name']
    }
  },
  
  // Collection filtering
  {
    name: 'filter_collection_by_date_and_region',
    description: 'Filter image collection by date and region (auto-detects place names)',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        region: { type: ['string', 'object'] },
        cloud_cover_max: { type: 'number' }
      },
      required: ['collection_id', 'start_date', 'end_date', 'region']
    }
  },
  {
    name: 'smart_filter_collection',
    description: 'Intelligently filter using administrative boundaries when possible',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        filters: { type: 'object' }
      },
      required: ['collection']
    }
  },
  
  // Visualization
  {
    name: 'get_thumbnail_image',
    description: 'Get thumbnail URL for an image and region',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        dateStart: { type: 'string' },
        dateEnd: { type: 'string' },
        region: { type: ['string', 'object'] },
        visParams: { type: 'object' }
      },
      required: ['collection']
    }
  },
  {
    name: 'get_map_visualization_url',
    description: 'Get map tiles URL for visualization',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: { type: 'string' },
        visParams: { type: 'object' }
      },
      required: ['imageId']
    }
  },
  {
    name: 'create_clean_mosaic',
    description: 'Create cloud-free composite/mosaic',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        dateStart: { type: 'string' },
        dateEnd: { type: 'string' },
        region: { type: ['string', 'object'] },
        cloudCoverMax: { type: 'number' }
      },
      required: ['collection', 'dateStart', 'dateEnd', 'region']
    }
  },
  
  // Analysis
  {
    name: 'calculate_spectral_index',
    description: 'Calculate NDVI, EVI, or NDWI',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: { type: 'string' },
        index: { type: 'string', enum: ['NDVI', 'EVI', 'NDWI'] }
      },
      required: ['imageId', 'index']
    }
  },
  {
    name: 'calculate_summary_statistics',
    description: 'Calculate statistics over a region',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: { type: 'string' },
        region: { type: ['string', 'object'] },
        scale: { type: 'number' }
      },
      required: ['imageId', 'region']
    }
  },
  {
    name: 'detect_change_between_images',
    description: 'Detect changes between two images',
    inputSchema: {
      type: 'object',
      properties: {
        image1Id: { type: 'string' },
        image2Id: { type: 'string' },
        region: { type: ['string', 'object'] }
      },
      required: ['image1Id', 'image2Id']
    }
  },
  
  // Export
  {
    name: 'export_image_to_cloud_storage',
    description: 'Export image to Google Cloud Storage',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: { type: 'string' },
        region: { type: ['string', 'object'] },
        bucket: { type: 'string' },
        fileNamePrefix: { type: 'string' },
        scale: { type: 'number' }
      },
      required: ['imageId', 'region']
    }
  },
  
  // Other essential tools
  {
    name: 'search_gee_catalog',
    description: 'Search Earth Engine data catalog',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string' }
      },
      required: ['query']
    }
  },
  {
    name: 'get_dataset_band_names',
    description: 'Get band names for a dataset',
    inputSchema: {
      type: 'object',
      properties: {
        datasetId: { type: 'string' }
      },
      required: ['datasetId']
    }
  },
  {
    name: 'mask_clouds_from_image',
    description: 'Apply cloud masking to Sentinel-2 or Landsat',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: { type: 'string' }
      },
      required: ['imageId']
    }
  },
  {
    name: 'clip_image_to_region',
    description: 'Clip image to region (supports place names)',
    inputSchema: {
      type: 'object',
      properties: {
        imageId: { type: 'string' },
        region: { type: ['string', 'object'] }
      },
      required: ['imageId', 'region']
    }
  },
  {
    name: 'create_time_series_chart_for_region',
    description: 'Create time series chart for a region',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        region: { type: ['string', 'object'] },
        dateStart: { type: 'string' },
        dateEnd: { type: 'string' },
        band: { type: 'string' }
      },
      required: ['collection', 'region', 'dateStart', 'dateEnd']
    }
  }
];

console.error(`[Earth Engine MCP] Configured with ${ALL_TOOLS.length} tools`);

// Provide mock responses for testing
function getMockResponse(toolName, args) {
  const mockResponses = {
    'convert_place_to_shapefile_geometry': {
      place_name: args.place_name,
      geometry: { type: 'Polygon', coordinates: [[[-122.5, 37.7], [-122.4, 37.7], [-122.4, 37.8], [-122.5, 37.8], [-122.5, 37.7]]] },
      area_km2: 122,
      source: 'FAO GAUL',
      message: `Shapefile boundary for ${args.place_name}`
    },
    'get_thumbnail_image': {
      url: 'https://earthengine.googleapis.com/v1/projects/earthengine-legacy/thumbnails/mock-image',
      message: `Thumbnail generated for ${args.collection || 'image'}`,
      region: args.region
    },
    'filter_collection_by_date_and_region': {
      collection_id: args.collection_id,
      date_range: `${args.start_date} to ${args.end_date}`,
      region: args.region,
      image_count: 42,
      message: 'Collection filtered successfully'
    },
    'search_gee_catalog': {
      results: [
        { id: 'COPERNICUS/S2_SR_HARMONIZED', title: 'Sentinel-2 MSI: MultiSpectral Instrument, Level-2A' },
        { id: 'LANDSAT/LC09/C02/T1_L2', title: 'Landsat 9 Collection 2 Tier 1 Level-2' }
      ],
      query: args.query,
      message: `Found datasets matching "${args.query}"`
    }
  };
  
  return mockResponses[toolName] || {
    tool: toolName,
    args: args,
    status: 'completed',
    message: 'Tool executed successfully (mock response)'
  };
}

// Forward requests to Next.js server
async function callServer(method, params) {
  return new Promise((resolve) => {
    const data = JSON.stringify({
      jsonrpc: '2.0',
      method: method,
      params: params,
      id: Date.now()
    });
    
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: '/sse',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve(parsed);
        } catch (e) {
          console.error('[Earth Engine MCP] Failed to parse server response:', body.substring(0, 200));
          // Return error if parsing fails
          resolve({ 
            error: { 
              message: 'Failed to parse server response'
            } 
          });
        }
      });
    });
    
    req.on('error', (err) => {
      console.error('[Earth Engine MCP] Server connection failed:', err.message);
      // Return error if connection fails
      resolve({ 
        error: { 
          message: `Server connection failed: ${err.message}`
        } 
      });
    });
    
    req.write(data);
    req.end();
  });
}

// Handle MCP protocol
rl.on('line', async (line) => {
  try {
    const message = JSON.parse(line);
    
    if (message.method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'earth-engine', version: '3.0.0' }
        }
      };
      console.log(JSON.stringify(response));
      console.error('[Earth Engine MCP] Initialized');
      
    } else if (message.method === 'tools/list') {
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: { tools: ALL_TOOLS }
      };
      console.log(JSON.stringify(response));
      console.error(`[Earth Engine MCP] Sent ${ALL_TOOLS.length} tools`);
      
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
      console.error(`[Earth Engine MCP] Calling tool: ${message.params.name}`);
      console.error(`[Earth Engine MCP] With arguments:`, JSON.stringify(message.params.arguments).substring(0, 200));
      
      let resultData;
      
      // Try to forward to server
      try {
        const serverResponse = await callServer('tools/call', message.params);
        
        if (serverResponse.result) {
          resultData = serverResponse.result;
          console.error(`[Earth Engine MCP] Server returned result`);
        } else if (serverResponse.error) {
          console.error(`[Earth Engine MCP] Server error:`, serverResponse.error);
          resultData = {
            error: serverResponse.error.message || 'Server error',
            tool: message.params.name
          };
        } else {
          // Server didn't return expected format
          console.error(`[Earth Engine MCP] Unexpected server response format`);
          resultData = {
            error: 'Server returned unexpected format',
            tool: message.params.name
          };
        }
      } catch (err) {
        console.error(`[Earth Engine MCP] Error calling server:`, err.message);
        resultData = {
          error: err.message,
          tool: message.params.name
        };
      }
      
      const response = {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [{
            type: 'text',
            text: JSON.stringify(resultData)
          }]
        }
      };
      console.log(JSON.stringify(response));
      console.error(`[Earth Engine MCP] Tool ${message.params.name} completed`);
      
    } else if (message.method?.startsWith('notifications/')) {
      // Ignore notifications
      console.error(`[Earth Engine MCP] Notification: ${message.method}`);
    }
    
  } catch (e) {
    console.error('[Earth Engine MCP] Error:', e.message);
  }
});

console.error('[Earth Engine MCP] Ready with all tools including:');
console.error('  🗺️ Shapefile: convert_place_to_shapefile_geometry, get_shapefile_boundary');
console.error('  🖼️ Visualization: get_thumbnail_image, create_clean_mosaic, get_map_visualization_url');
console.error('  📊 Analysis: calculate_spectral_index, calculate_summary_statistics, detect_change');
console.error('  ☁️ Export: export_image_to_cloud_storage');
console.error('  🌍 And more!');
