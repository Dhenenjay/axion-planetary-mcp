#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');

// Load environment variables
function loadEnvFile() {
  const envPath = path.join(__dirname, '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        const value = valueParts.join('=');
        if (key && value) {
          process.env[key] = value;
        }
      }
    }
  }
}

// Initialize environment
loadEnvFile();

// Polyfills for Earth Engine
global.XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;
if (typeof global.document === 'undefined') {
  global.document = {
    createElement: () => ({ 
      setAttribute: () => {},
      getElementsByTagName: () => [],
      parentNode: { insertBefore: () => {} }
    }),
    getElementsByTagName: () => [{ appendChild: () => {} }],
    head: { appendChild: () => {} },
    documentElement: {}
  };
}
if (typeof global.window === 'undefined') {
  global.window = {
    location: { href: '', protocol: 'https:' },
    document: global.document
  };
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

console.error('[Earth Engine MCP] Starting server with global shapefile support...');

// Initialize Earth Engine
let ee;
let isEarthEngineReady = false;

async function initializeEarthEngine() {
  try {
    ee = require('@google/earthengine');
    const { GoogleAuth } = require('google-auth-library');
    
    const keyJson = JSON.parse(Buffer.from(process.env.GEE_SA_KEY_JSON || '', 'base64').toString('utf8'));
    const auth = new GoogleAuth({
      credentials: keyJson,
      scopes: ['https://www.googleapis.com/auth/earthengine']
    });
    
    // Add fetch polyfill for Google Auth
    require('cross-fetch/polyfill');
    
    const client = await auth.getClient();
    const token = await client.getAccessToken();
    
    ee.data.setAuthToken('', 'Bearer', token.token, 3600);
    
    await new Promise((resolve, reject) => {
      ee.initialize(null, null, () => {
        isEarthEngineReady = true;
        console.error('[Earth Engine MCP] ✅ Earth Engine initialized successfully');
        resolve();
      }, (err) => {
        console.error('[Earth Engine MCP] ❌ Failed to initialize Earth Engine:', err);
        reject(err);
      });
    });
  } catch (error) {
    console.error('[Earth Engine MCP] ❌ Error initializing Earth Engine:', error);
    isEarthEngineReady = false;
  }
}

// Initialize on startup
initializeEarthEngine().catch(console.error);

// Global location search function with comprehensive support
async function findGlobalLocation(placeName) {
  if (!isEarthEngineReady) {
    throw new Error('Earth Engine not initialized');
  }
  
  console.error(`🌍 Searching globally for: "${placeName}"`);
  
  // Normalize the input
  const normalized = placeName.toLowerCase().trim();
  const titleCase = placeName.replace(/\w\S*/g, (txt) => 
    txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
  );
  const upperCase = placeName.toUpperCase();
  
  // Parse location with context (e.g., "Paris, France" or "Austin, Texas")
  let primary = placeName;
  let context = null;
  if (placeName.includes(',')) {
    const parts = placeName.split(',').map(p => p.trim());
    primary = parts[0];
    context = parts[1];
  }
  
  // Define all search strategies
  const strategies = [
    // Try exact matches in various datasets
    async () => {
      const datasets = [
        // Global Cities/Districts (FAO GAUL Level 2)
        {
          collection: 'FAO/GAUL/2015/level2',
          fields: ['ADM2_NAME'],
          level: 'City/District'
        },
        // Global States/Provinces (FAO GAUL Level 1)
        {
          collection: 'FAO/GAUL/2015/level1',
          fields: ['ADM1_NAME'],
          level: 'State/Province'
        },
        // Global Countries (FAO GAUL Level 0)
        {
          collection: 'FAO/GAUL/2015/level0',
          fields: ['ADM0_NAME'],
          level: 'Country'
        },
        // US Counties
        {
          collection: 'TIGER/2016/Counties',
          fields: ['NAME', 'NAMELSAD'],
          level: 'County'
        },
        // US States
        {
          collection: 'TIGER/2016/States',
          fields: ['NAME', 'STUSPS'],
          level: 'State'
        }
      ];
      
      for (const dataset of datasets) {
        for (const field of dataset.fields) {
          for (const variant of [placeName, titleCase, upperCase, normalized]) {
            try {
              const fc = new ee.FeatureCollection(dataset.collection);
              const filtered = fc.filter(ee.Filter.eq(field, variant));
              const count = await filtered.size().getInfo();
              
              if (count > 0) {
                const first = filtered.first();
                const geometry = first.geometry();
                console.error(`✅ Found "${placeName}" in ${dataset.collection} (${field})`);
                return {
                  geometry: geometry,
                  dataset: dataset.collection,
                  level: dataset.level
                };
              }
            } catch (e) {
              // Continue to next
            }
          }
        }
      }
      return null;
    },
    
    // Try with context if provided (e.g., "Paris, France")
    async () => {
      if (!context) return null;
      
      try {
        // Try city in country
        const fc = new ee.FeatureCollection('FAO/GAUL/2015/level2');
        const filtered = fc.filter(
          ee.Filter.and(
            ee.Filter.eq('ADM2_NAME', primary),
            ee.Filter.eq('ADM0_NAME', context)
          )
        );
        
        const count = await filtered.size().getInfo();
        if (count > 0) {
          const first = filtered.first();
          const geometry = first.geometry();
          console.error(`✅ Found "${primary}" in ${context}`);
          return {
            geometry: geometry,
            dataset: 'FAO/GAUL/2015/level2',
            level: 'City in Country'
          };
        }
      } catch (e) {
        // Try city in state/province
        try {
          const fc = new ee.FeatureCollection('FAO/GAUL/2015/level2');
          const filtered = fc.filter(
            ee.Filter.and(
              ee.Filter.eq('ADM2_NAME', primary),
              ee.Filter.eq('ADM1_NAME', context)
            )
          );
          
          const count = await filtered.size().getInfo();
          if (count > 0) {
            const first = filtered.first();
            const geometry = first.geometry();
            console.error(`✅ Found "${primary}" in state/province ${context}`);
            return {
              geometry: geometry,
              dataset: 'FAO/GAUL/2015/level2',
              level: 'City in State'
            };
          }
        } catch (e2) {
          // Not found
        }
      }
      
      return null;
    },
    
    // Try removing common suffixes
    async () => {
      const suffixes = [' city', ' county', ' district', ' province', ' state'];
      for (const suffix of suffixes) {
        if (normalized.endsWith(suffix)) {
          const cleaned = placeName.substring(0, placeName.length - suffix.length);
          const result = await findGlobalLocation(cleaned);
          if (result) return result;
        }
      }
      return null;
    }
  ];
  
  // Execute strategies in order
  for (const strategy of strategies) {
    try {
      const result = await strategy();
      if (result) {
        return result;
      }
    } catch (e) {
      // Continue to next strategy
    }
  }
  
  throw new Error(`Could not find location: "${placeName}". Try adding more context (e.g., "Paris, France" or "Austin, Texas")`);
}

// Complete tool definitions with global support
const ALL_TOOLS = [
  // Enhanced shapefile tool with global support
  {
    name: 'convert_place_to_shapefile_geometry',
    description: 'Convert ANY place name globally (city, state, country) to exact shapefile boundary. Supports international locations like Paris, Tokyo, Mumbai, São Paulo, etc.',
    inputSchema: {
      type: 'object',
      properties: {
        place_name: { 
          type: 'string', 
          description: 'Any place name globally (e.g., "Paris", "Tokyo", "Mumbai", "São Paulo", "London", "Berlin", "Paris, France", "Tokyo, Japan")' 
        }
      },
      required: ['place_name']
    },
    handler: async (args) => {
      try {
        const result = await findGlobalLocation(args.place_name);
        const geometry = result.geometry;
        const area = await geometry.area().getInfo();
        const perimeter = await geometry.perimeter().getInfo();
        const bounds = await geometry.bounds().getInfo();
        const centroid = await geometry.centroid().getInfo();
        const geoJson = await geometry.getInfo();
        
        // Extract bbox
        const coords = bounds.coordinates[0];
        const bbox = {
          west: Math.min(coords[0][0], coords[1][0], coords[2][0], coords[3][0]),
          south: Math.min(coords[0][1], coords[1][1], coords[2][1], coords[3][1]),
          east: Math.max(coords[0][0], coords[1][0], coords[2][0], coords[3][0]),
          north: Math.max(coords[0][1], coords[1][1], coords[2][1], coords[3][1])
        };
        
        return {
          success: true,
          place_name: args.place_name,
          geometry: geoJson,
          area_km2: Math.round(area / 1000000),
          perimeter_km: Math.round(perimeter / 1000),
          dataset: result.dataset,
          level: result.level,
          bbox: bbox,
          centroid: {
            lon: centroid.coordinates[0],
            lat: centroid.coordinates[1]
          },
          message: `Successfully found boundary for "${args.place_name}" from ${result.dataset}`
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  },
  
  // Collection filtering with global AOI support
  {
    name: 'filter_collection_by_date_and_region',
    description: 'Filter image collection by date and region. Automatically converts place names to boundaries.',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string' },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        region: { 
          type: ['string', 'object'],
          description: 'Place name (e.g., "Tokyo", "Paris, France") or GeoJSON'
        },
        cloud_cover_max: { type: 'number' }
      },
      required: ['collection_id', 'start_date', 'end_date', 'region']
    },
    handler: async (args) => {
      try {
        let geometry;
        
        // Convert place name to geometry if needed
        if (typeof args.region === 'string') {
          const result = await findGlobalLocation(args.region);
          geometry = result.geometry;
        } else {
          geometry = new ee.Geometry(args.region);
        }
        
        // Filter collection
        let collection = ee.ImageCollection(args.collection_id)
          .filterDate(args.start_date, args.end_date)
          .filterBounds(geometry);
        
        if (args.cloud_cover_max !== undefined) {
          collection = collection.filter(ee.Filter.lte('CLOUD_COVER', args.cloud_cover_max));
        }
        
        const count = await collection.size().getInfo();
        const imageList = await collection.limit(10).getInfo();
        
        return {
          success: true,
          count: count,
          images: imageList.features.slice(0, 5).map(f => ({
            id: f.id,
            date: f.properties.system_time_start ? 
              new Date(f.properties.system_time_start).toISOString() : 'unknown',
            cloud_cover: f.properties.CLOUD_COVER || f.properties.CLOUDY_PIXEL_PERCENTAGE || 'N/A'
          })),
          message: `Found ${count} images for the specified criteria`
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  },
  
  // Thumbnail generation with global AOI support
  {
    name: 'get_thumbnail_image',
    description: 'Get thumbnail URL for an image over any global region',
    inputSchema: {
      type: 'object',
      properties: {
        collection: { type: 'string' },
        dateStart: { type: 'string' },
        dateEnd: { type: 'string' },
        region: { 
          type: ['string', 'object'],
          description: 'Place name or GeoJSON'
        },
        visParams: { type: 'object' }
      },
      required: ['collection', 'region']
    },
    handler: async (args) => {
      try {
        let geometry;
        
        // Convert place name to geometry if needed
        if (typeof args.region === 'string') {
          const result = await findGlobalLocation(args.region);
          geometry = result.geometry;
        } else {
          geometry = new ee.Geometry(args.region);
        }
        
        // Get collection
        let collection = ee.ImageCollection(args.collection);
        
        if (args.dateStart && args.dateEnd) {
          collection = collection.filterDate(args.dateStart, args.dateEnd);
        }
        
        collection = collection.filterBounds(geometry);
        
        // Get median composite
        const image = collection.median().clip(geometry);
        
        // Default vis params for common satellites
        const defaultVis = {
          'COPERNICUS/S2_SR_HARMONIZED': { bands: ['B4', 'B3', 'B2'], min: 0, max: 3000 },
          'LANDSAT/LC08/C02/T1_L2': { bands: ['SR_B4', 'SR_B3', 'SR_B2'], min: 0, max: 0.3 },
          'MODIS/006/MOD09GA': { bands: ['sur_refl_b01', 'sur_refl_b04', 'sur_refl_b03'], min: 0, max: 3000 }
        };
        
        const visParams = args.visParams || defaultVis[args.collection] || { min: 0, max: 1 };
        
        // Generate thumbnail URL
        const url = image.getThumbURL({
          dimensions: 512,
          region: geometry,
          format: 'png',
          ...visParams
        });
        
        return {
          success: true,
          url: url,
          message: `Thumbnail generated for ${args.region}`
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  },
  
  // Export with global AOI support
  {
    name: 'export_image_to_drive',
    description: 'Export image to Google Drive for any global region',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string' },
        region: { 
          type: ['string', 'object'],
          description: 'Place name or GeoJSON'
        },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        file_name: { type: 'string' },
        scale: { type: 'number', default: 30 },
        folder: { type: 'string' }
      },
      required: ['collection_id', 'region', 'file_name']
    },
    handler: async (args) => {
      try {
        let geometry;
        
        // Convert place name to geometry if needed
        if (typeof args.region === 'string') {
          const result = await findGlobalLocation(args.region);
          geometry = result.geometry;
        } else {
          geometry = new ee.Geometry(args.region);
        }
        
        // Get collection
        let collection = ee.ImageCollection(args.collection_id);
        
        if (args.start_date && args.end_date) {
          collection = collection.filterDate(args.start_date, args.end_date);
        }
        
        collection = collection.filterBounds(geometry);
        
        // Get median composite
        const image = collection.median().clip(geometry);
        
        // Create export task
        const task = ee.batch.Export.image.toDrive({
          image: image,
          description: args.file_name,
          fileNamePrefix: args.file_name,
          region: geometry,
          scale: args.scale || 30,
          folder: args.folder || 'EarthEngine',
          maxPixels: 1e13
        });
        
        // Start the task
        task.start();
        
        // Get task info
        const taskId = task.id;
        
        return {
          success: true,
          taskId: taskId,
          message: `Export task started for ${args.region}. Check your Google Drive folder "${args.folder || 'EarthEngine'}" in a few minutes.`
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  },
  
  // Statistics calculation with global support
  {
    name: 'calculate_statistics',
    description: 'Calculate statistics (mean, min, max, etc.) for any global region',
    inputSchema: {
      type: 'object',
      properties: {
        collection_id: { type: 'string' },
        region: { 
          type: ['string', 'object'],
          description: 'Place name or GeoJSON'
        },
        start_date: { type: 'string' },
        end_date: { type: 'string' },
        band: { type: 'string' },
        reducer: { 
          type: 'string',
          enum: ['mean', 'median', 'min', 'max', 'stdDev', 'variance'],
          default: 'mean'
        },
        scale: { type: 'number', default: 30 }
      },
      required: ['collection_id', 'region', 'band']
    },
    handler: async (args) => {
      try {
        let geometry;
        
        // Convert place name to geometry if needed
        if (typeof args.region === 'string') {
          const result = await findGlobalLocation(args.region);
          geometry = result.geometry;
        } else {
          geometry = new ee.Geometry(args.region);
        }
        
        // Get collection
        let collection = ee.ImageCollection(args.collection_id);
        
        if (args.start_date && args.end_date) {
          collection = collection.filterDate(args.start_date, args.end_date);
        }
        
        collection = collection.filterBounds(geometry);
        
        // Select band and reduce
        const image = collection.select(args.band).median();
        
        // Choose reducer
        const reducers = {
          'mean': ee.Reducer.mean(),
          'median': ee.Reducer.median(),
          'min': ee.Reducer.min(),
          'max': ee.Reducer.max(),
          'stdDev': ee.Reducer.stdDev(),
          'variance': ee.Reducer.variance()
        };
        
        const reducer = reducers[args.reducer || 'mean'];
        
        // Calculate statistics
        const stats = image.reduceRegion({
          reducer: reducer,
          geometry: geometry,
          scale: args.scale || 30,
          maxPixels: 1e13
        });
        
        const result = await stats.getInfo();
        
        return {
          success: true,
          statistics: result,
          region: args.region,
          band: args.band,
          reducer: args.reducer || 'mean',
          message: `Calculated ${args.reducer || 'mean'} for ${args.band} in ${args.region}`
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  },
  
  // NDVI calculation with global support
  {
    name: 'calculate_ndvi',
    description: 'Calculate NDVI (vegetation index) for any global region',
    inputSchema: {
      type: 'object',
      properties: {
        region: { 
          type: ['string', 'object'],
          description: 'Place name or GeoJSON'
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
    },
    handler: async (args) => {
      try {
        let geometry;
        
        // Convert place name to geometry if needed
        if (typeof args.region === 'string') {
          const result = await findGlobalLocation(args.region);
          geometry = result.geometry;
        } else {
          geometry = new ee.Geometry(args.region);
        }
        
        // Satellite configurations
        const satellites = {
          'sentinel2': {
            collection: 'COPERNICUS/S2_SR_HARMONIZED',
            nir: 'B8',
            red: 'B4',
            scale: 10
          },
          'landsat8': {
            collection: 'LANDSAT/LC08/C02/T1_L2',
            nir: 'SR_B5',
            red: 'SR_B4',
            scale: 30
          },
          'modis': {
            collection: 'MODIS/006/MOD09GA',
            nir: 'sur_refl_b02',
            red: 'sur_refl_b01',
            scale: 500
          }
        };
        
        const config = satellites[args.satellite || 'sentinel2'];
        
        // Get collection
        let collection = ee.ImageCollection(config.collection);
        
        if (args.start_date && args.end_date) {
          collection = collection.filterDate(args.start_date, args.end_date);
        } else {
          // Default to last 3 months
          const end = new Date();
          const start = new Date(end.getTime() - 90 * 24 * 60 * 60 * 1000);
          collection = collection.filterDate(start.toISOString(), end.toISOString());
        }
        
        collection = collection.filterBounds(geometry);
        
        // Get median composite
        const image = collection.median().clip(geometry);
        
        // Calculate NDVI
        const ndvi = image.normalizedDifference([config.nir, config.red]).rename('NDVI');
        
        // Calculate statistics
        const stats = ndvi.reduceRegion({
          reducer: ee.Reducer.mean().combine(ee.Reducer.min(), '', true).combine(ee.Reducer.max(), '', true),
          geometry: geometry,
          scale: config.scale,
          maxPixels: 1e13
        });
        
        const result = await stats.getInfo();
        
        // Generate visualization URL
        const visParams = {
          min: -1,
          max: 1,
          palette: ['red', 'yellow', 'green']
        };
        
        const url = ndvi.getThumbURL({
          dimensions: 512,
          region: geometry,
          format: 'png',
          ...visParams
        });
        
        return {
          success: true,
          ndvi_stats: {
            mean: result.NDVI_mean,
            min: result.NDVI_min,
            max: result.NDVI_max
          },
          visualization_url: url,
          region: args.region,
          satellite: args.satellite || 'sentinel2',
          message: `NDVI calculated for ${args.region} using ${args.satellite || 'sentinel2'}`
        };
      } catch (error) {
        return {
          success: false,
          error: error.message
        };
      }
    }
  },
  
  // Search catalog
  {
    name: 'search_gee_catalog',
    description: 'Search Earth Engine data catalog',
    inputSchema: {
      type: 'object',
      properties: {
        keywords: { type: 'string' },
        type: { type: 'string', enum: ['image', 'imageCollection', 'table', 'any'] }
      },
      required: ['keywords']
    },
    handler: async (args) => {
      // Simplified catalog search - return common datasets
      const catalog = {
        'sentinel': ['COPERNICUS/S2_SR_HARMONIZED', 'COPERNICUS/S1_GRD'],
        'landsat': ['LANDSAT/LC08/C02/T1_L2', 'LANDSAT/LC09/C02/T1_L2'],
        'modis': ['MODIS/006/MOD09GA', 'MODIS/006/MCD43A4'],
        'elevation': ['USGS/SRTMGL1_003', 'COPERNICUS/DEM/GLO30'],
        'land cover': ['ESA/WorldCover/v100', 'MODIS/006/MCD12Q1'],
        'population': ['WorldPop/GP/100m/pop', 'CIESIN/GPWv411/GPW_Population_Density'],
        'climate': ['ECMWF/ERA5_LAND/MONTHLY', 'NASA/GLDAS/V021/NOAH/G025/T3H'],
        'boundaries': ['FAO/GAUL/2015/level0', 'FAO/GAUL/2015/level1', 'FAO/GAUL/2015/level2', 'TIGER/2016/Counties']
      };
      
      const results = [];
      const keyword = args.keywords.toLowerCase();
      
      for (const [key, datasets] of Object.entries(catalog)) {
        if (key.includes(keyword) || keyword.includes(key)) {
          results.push(...datasets.map(d => ({ id: d, type: key })));
        }
      }
      
      return {
        success: true,
        results: results.slice(0, 10),
        message: `Found ${results.length} datasets matching "${args.keywords}"`
      };
    }
  }
];

console.error(`[Earth Engine MCP] Configured with ${ALL_TOOLS.length} tools with global support`);

// Handle MCP requests
rl.on('line', async (line) => {
  try {
    const request = JSON.parse(line);
    
    if (request.method === 'initialize') {
      const response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'earth-engine-mcp-global',
            version: '1.0.0'
          }
        }
      };
      console.log(JSON.stringify(response));
    }
    
    else if (request.method === 'tools/list') {
      const response = {
        jsonrpc: '2.0',
        id: request.id,
        result: {
          tools: ALL_TOOLS.map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
          }))
        }
      };
      console.log(JSON.stringify(response));
    }
    
    else if (request.method === 'tools/call') {
      const toolName = request.params.name;
      const args = request.params.arguments || {};
      
      const tool = ALL_TOOLS.find(t => t.name === toolName);
      if (!tool) {
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32602,
            message: `Tool not found: ${toolName}`
          }
        };
        console.log(JSON.stringify(response));
        return;
      }
      
      console.error(`[Earth Engine MCP] Executing: ${toolName}`);
      
      try {
        const result = await tool.handler(args);
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            content: [{
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }]
          }
        };
        console.log(JSON.stringify(response));
      } catch (error) {
        const response = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32603,
            message: error.message
          }
        };
        console.log(JSON.stringify(response));
      }
    }
    
    else {
      const response = {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Method not found: ${request.method}`
        }
      };
      console.log(JSON.stringify(response));
    }
    
  } catch (error) {
    console.error('[Earth Engine MCP] Error handling request:', error);
    if (error.message.includes('JSON')) {
      // Not a JSON-RPC request, ignore
    } else {
      const response = {
        jsonrpc: '2.0',
        id: null,
        error: {
          code: -32700,
          message: 'Parse error'
        }
      };
      console.log(JSON.stringify(response));
    }
  }
});

console.error('====================================');
console.error('🌍 Earth Engine MCP Server Ready');
console.error('====================================');
console.error('✅ Global shapefile support enabled');
console.error('✅ Supports international locations:');
console.error('   • Countries: France, Japan, Brazil, India, etc.');
console.error('   • Cities: Paris, Tokyo, Mumbai, São Paulo, etc.');
console.error('   • With context: "Paris, France", "Tokyo, Japan"');
console.error('====================================');
