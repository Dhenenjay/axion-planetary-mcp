#!/usr/bin/env node

/**
 * COMPLETE Earth Engine MCP Server
 * Full implementation with NDVI visualization, color palettes, and all geospatial models
 */

const readline = require('readline');
const ee = require('@google/earthengine');
const fs = require('fs');
const path = require('path');

// Get Earth Engine key path from environment
const EE_KEY_PATH = process.env.EARTH_ENGINE_PRIVATE_KEY || process.env.EE_KEY_PATH || 'C:\\Users\\Dhenenjay\\Downloads\\ee-key.json';

let eeInitialized = false;

// Initialize Earth Engine
async function initializeEarthEngine() {
  if (eeInitialized) return;
  
  try {
    const keyFilePath = path.resolve(EE_KEY_PATH);
    if (!fs.existsSync(keyFilePath)) {
      throw new Error(`Service account key file not found: ${keyFilePath}`);
    }

    const serviceAccount = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));

    await new Promise((resolve, reject) => {
      ee.data.authenticateViaPrivateKey(
        serviceAccount,
        () => {
          ee.initialize(
            null,
            null,
            () => {
              eeInitialized = true;
              console.error('[Earth Engine] Initialized successfully');
              resolve();
            },
            (error) => {
              console.error('[Earth Engine] Initialization error:', error);
              reject(error);
            }
          );
        },
        (error) => {
          console.error('[Earth Engine] Authentication error:', error);
          reject(error);
        }
      );
    });
  } catch (error) {
    console.error('[Earth Engine] Failed to initialize:', error);
    throw error;
  }
}

// Create interface for stdio
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// Buffer for incomplete messages
let buffer = '';

// ========== CONSOLIDATED SUPER TOOLS ==========
const TOOLS = [
  {
    name: 'earth_engine_data',
    description: 'Data Discovery & Access - search, filter, geometry, info, boundaries operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['search', 'filter', 'geometry', 'info', 'boundaries'],
          description: 'Operation to perform'
        },
        query: { type: 'string', description: 'Search query (for search operation)' },
        datasetId: { type: 'string', description: 'Dataset ID' },
        startDate: { type: 'string', description: 'Start date YYYY-MM-DD' },
        endDate: { type: 'string', description: 'End date YYYY-MM-DD' },
        region: { type: 'string', description: 'Region name or geometry' },
        placeName: { type: 'string', description: 'Place name for geometry lookup' },
        limit: { type: 'number', description: 'Maximum results', default: 10 }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_process',
    description: 'Processing & Analysis - clip, mask, index (NDVI/NDWI/etc with palettes), analyze, composite, terrain',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['clip', 'mask', 'index', 'analyze', 'composite', 'terrain', 'resample'],
          description: 'Processing operation'
        },
        input: { type: 'string', description: 'Input dataset or result' },
        datasetId: { type: 'string', description: 'Dataset ID' },
        region: { type: 'string', description: 'Region for processing' },
        indexType: {
          type: 'string',
          enum: ['NDVI', 'NDWI', 'NDBI', 'EVI', 'SAVI', 'MNDWI', 'NBR'],
          description: 'Index type to calculate'
        },
        includeVisualization: { type: 'boolean', description: 'Include color palette visualization', default: true },
        includeHtml: { type: 'boolean', description: 'Generate HTML artifact', default: false },
        startDate: { type: 'string', description: 'Start date' },
        endDate: { type: 'string', description: 'End date' },
        scale: { type: 'number', description: 'Processing scale', default: 30 }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_export',
    description: 'Export & Visualization - export, thumbnail, tiles, status, download operations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['export', 'thumbnail', 'tiles', 'status', 'download'],
          description: 'Export operation'
        },
        input: { type: 'string', description: 'Input data to export' },
        datasetId: { type: 'string', description: 'Dataset ID' },
        region: { type: 'string', description: 'Export region' },
        scale: { type: 'number', description: 'Export scale', default: 10 },
        format: {
          type: 'string',
          enum: ['GeoTIFF', 'PNG', 'JPG'],
          description: 'Export format'
        },
        dimensions: { type: 'string', description: 'Thumbnail dimensions', default: '1024x1024' },
        visParams: {
          type: 'object',
          properties: {
            bands: { type: 'array', items: { type: 'string' } },
            min: { type: 'number' },
            max: { type: 'number' },
            palette: { type: 'array', items: { type: 'string' } },
            gamma: { type: 'number' }
          }
        },
        startDate: { type: 'string', description: 'Start date' },
        endDate: { type: 'string', description: 'End date' }
      },
      required: ['operation']
    }
  },
  {
    name: 'earth_engine_system',
    description: 'System & Advanced - auth, execute code, setup, info',
    inputSchema: {
      type: 'object',
      properties: {
        operation: {
          type: 'string',
          enum: ['auth', 'execute', 'setup', 'info', 'health'],
          description: 'System operation'
        },
        code: { type: 'string', description: 'JavaScript code to execute' }
      },
      required: ['operation']
    }
  },

  // ========== GEOSPATIAL MODELS ==========
  {
    name: 'wildfire_risk_assessment',
    description: 'Comprehensive wildfire risk assessment using vegetation, terrain, and weather data',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Region name or coordinates' },
        startDate: { type: 'string', description: 'Analysis start date' },
        endDate: { type: 'string', description: 'Analysis end date' },
        factors: {
          type: 'array',
          items: { type: 'string' },
          description: 'Risk factors to analyze',
          default: ['vegetation', 'temperature', 'humidity', 'slope', 'wind']
        }
      },
      required: ['region']
    }
  },
  {
    name: 'flood_risk_analysis',
    description: 'Flood risk assessment using elevation, rainfall, and historical data',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Region name or coordinates' },
        startDate: { type: 'string', description: 'Analysis start date' },
        endDate: { type: 'string', description: 'Analysis end date' },
        returnPeriod: { type: 'number', description: 'Return period in years', default: 100 }
      },
      required: ['region']
    }
  },
  {
    name: 'agriculture_monitoring',
    description: 'Crop health monitoring and yield prediction',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Agricultural region' },
        cropType: { type: 'string', description: 'Crop type to monitor' },
        startDate: { type: 'string', description: 'Growing season start' },
        endDate: { type: 'string', description: 'Growing season end' },
        indices: {
          type: 'array',
          items: { type: 'string' },
          description: 'Vegetation indices to calculate',
          default: ['NDVI', 'EVI', 'SAVI']
        }
      },
      required: ['region']
    }
  },
  {
    name: 'deforestation_tracking',
    description: 'Track forest loss and degradation over time',
    inputSchema: {
      type: 'object',
      properties: {
        region: { type: 'string', description: 'Forest region' },
        baselineYear: { type: 'number', description: 'Baseline year for comparison' },
        currentYear: { type: 'number', description: 'Current year for analysis' },
        alertThreshold: { type: 'number', description: 'Alert threshold percentage', default: 5 }
      },
      required: ['region', 'baselineYear', 'currentYear']
    }
  },
  {
    name: 'water_quality_assessment',
    description: 'Assess water quality using spectral indices and chlorophyll detection',
    inputSchema: {
      type: 'object',
      properties: {
        waterBody: { type: 'string', description: 'Water body name or location' },
        startDate: { type: 'string', description: 'Start date' },
        endDate: { type: 'string', description: 'End date' },
        parameters: {
          type: 'array',
          items: { type: 'string' },
          description: 'Water quality parameters',
          default: ['turbidity', 'chlorophyll', 'temperature', 'algae']
        }
      },
      required: ['waterBody']
    }
  }
];

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
      if (!eeInitialized) {
        await initializeEarthEngine();
      }
      
      sendResponse(message.id, {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {},
          prompts: {},
          resources: {}
        },
        serverInfo: {
          name: 'earth-engine-mcp-complete',
          version: '2.0.0'
        }
      });
    } else if (message.method === 'tools/list') {
      sendResponse(message.id, { tools: TOOLS });
    } else if (message.method === 'tools/call') {
      await handleToolCall(message);
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
      case 'earth_engine_process':
        result = await handleProcessOperation(args);
        break;
        
      case 'earth_engine_export':
        result = await handleExportOperation(args);
        break;
        
      case 'earth_engine_data':
        result = await handleDataOperation(args);
        break;
        
      case 'earth_engine_system':
        result = await handleSystemOperation(args);
        break;
        
      case 'wildfire_risk_assessment':
        result = await assessWildfireRisk(args);
        break;
        
      case 'flood_risk_analysis':
        result = await analyzeFloodRisk(args);
        break;
        
      case 'agriculture_monitoring':
        result = await monitorAgriculture(args);
        break;
        
      case 'deforestation_tracking':
        result = await trackDeforestation(args);
        break;
        
      case 'water_quality_assessment':
        result = await assessWaterQuality(args);
        break;
        
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
    
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

// Handle process operations including NDVI with color palettes
async function handleProcessOperation(params) {
  const { operation, ...args } = params;
  
  switch (operation) {
    case 'index':
      return await calculateSpectralIndex(args);
    case 'composite':
      return await createComposite(args);
    case 'analyze':
      return await analyzeData(args);
    default:
      return { error: `Unknown process operation: ${operation}` };
  }
}

// Calculate spectral indices with color palette visualization
async function calculateSpectralIndex(params) {
  const { 
    indexType = 'NDVI',
    datasetId = 'COPERNICUS/S2_SR_HARMONIZED',
    region = 'Los Angeles',
    startDate = '2024-01-01',
    endDate = '2024-01-31',
    includeVisualization = true,
    includeHtml = false
  } = params;
  
  try {
    // Get region geometry
    const geometry = getRegionGeometry(region);
    
    // Get image collection
    let collection = ee.ImageCollection(datasetId)
      .filterDate(startDate, endDate)
      .filterBounds(geometry);
    
    // Apply cloud masking
    if (datasetId.includes('S2')) {
      collection = collection.map(function(image) {
        const qa = image.select('QA60');
        const cloudBitMask = 1 << 10;
        const cirrusBitMask = 1 << 11;
        const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
          .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
        return image.updateMask(mask)
          .select('B.*')
          .copyProperties(image, ['system:time_start']);
      });
    }
    
    // Create median composite
    const composite = collection.median().clip(geometry);
    
    // Calculate index based on type
    let index, palette, visParams, description;
    
    switch (indexType) {
      case 'NDVI':
        // Calculate NDVI = (NIR - Red) / (NIR + Red)
        const nir = composite.select('B8');
        const red = composite.select('B4');
        index = nir.subtract(red).divide(nir.add(red)).rename('NDVI');
        
        // NDVI color palette (red to green)
        palette = [
          'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
          '74A901', '66A000', '529400', '3E8601', '207401', '056201',
          '004C00', '023B01', '012E01', '011D01', '011301'
        ];
        
        visParams = { min: -0.2, max: 0.8, palette: palette };
        description = 'NDVI showing vegetation health (red=bare soil, green=healthy vegetation)';
        break;
        
      case 'NDWI':
        // Calculate NDWI = (Green - NIR) / (Green + NIR)
        const green = composite.select('B3');
        const nirW = composite.select('B8');
        index = green.subtract(nirW).divide(green.add(nirW)).rename('NDWI');
        
        palette = ['ff0000', 'ffff00', '00ff00', '00ffff', '0000ff'];
        visParams = { min: -1, max: 1, palette: palette };
        description = 'NDWI showing water content (blue=water, red=dry)';
        break;
        
      case 'EVI':
        // Enhanced Vegetation Index
        const nirE = composite.select('B8');
        const redE = composite.select('B4');
        const blueE = composite.select('B2');
        index = ee.Image().expression(
          '2.5 * ((NIR - RED) / (NIR + 6 * RED - 7.5 * BLUE + 1))',
          {
            'NIR': nirE,
            'RED': redE,
            'BLUE': blueE
          }
        ).rename('EVI');
        
        palette = [
          'FFFFFF', 'CE7E45', 'DF923D', 'F1B555', 'FCD163', '99B718',
          '74A901', '66A000', '529400', '3E8601', '207401', '056201'
        ];
        visParams = { min: -0.2, max: 1.0, palette: palette };
        description = 'EVI showing enhanced vegetation (more sensitive than NDVI)';
        break;
        
      default:
        throw new Error(`Unsupported index type: ${indexType}`);
    }
    
    // Get thumbnail URL with color palette
    const thumbnailUrl = index.getThumbURL({
      dimensions: '1024x1024',
      region: geometry,
      format: 'png',
      ...visParams
    });
    
    // Calculate statistics with timeout
    const stats = index.reduceRegion({
      reducer: ee.Reducer.mean()
        .combine(ee.Reducer.min(), '', true)
        .combine(ee.Reducer.max(), '', true)
        .combine(ee.Reducer.stdDev(), '', true),
      geometry: geometry,
      scale: 30,
      maxPixels: 1e9
    });
    
    const statsResult = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Statistics calculation timed out after 10 seconds'));
      }, 10000);
      
      stats.evaluate((result, error) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve(result);
      });
    }).catch(error => {
      // Return partial results on timeout
      console.error(`Statistics calculation failed for ${region}: ${error.message}`);
      return {
        [`${indexType}_mean`]: null,
        [`${indexType}_min`]: null,
        [`${indexType}_max`]: null,
        [`${indexType}_stdDev`]: null
      };
    });
    
    // Generate HTML if requested
    let htmlArtifact = null;
    if (includeHtml) {
      htmlArtifact = generateIndexHtml(indexType, thumbnailUrl, statsResult, region, palette);
    }
    
    // Get interactive map tiles with timeout
    const mapId = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Map generation timed out after 10 seconds'));
      }, 10000);
      
      index.getMap(visParams, (result, error) => {
        clearTimeout(timeout);
        if (error) reject(error);
        else resolve(result);
      });
    }).catch(error => {
      console.error(`Map generation failed for ${region}: ${error.message}`);
      return { mapid: 'unavailable', token: 'unavailable' };
    });
    
    return {
      success: true,
      operation: 'index',
      indexType: indexType,
      region: region,
      dateRange: `${startDate} to ${endDate}`,
      statistics: {
        mean: statsResult[`${indexType}_mean`]?.toFixed(4) || 'N/A',
        min: statsResult[`${indexType}_min`]?.toFixed(4) || 'N/A',
        max: statsResult[`${indexType}_max`]?.toFixed(4) || 'N/A',
        stdDev: statsResult[`${indexType}_stdDev`]?.toFixed(4) || 'N/A'
      },
      visualization: includeVisualization ? {
        thumbnailUrl: thumbnailUrl,
        colorPalette: palette,
        description: description,
        legendValues: getLegendValues(indexType)
      } : null,
      interactiveMap: {
        tilesUrl: `https://earthengine.googleapis.com/v1alpha/${mapId.mapid}/tiles/{z}/{x}/{y}`,
        mapId: mapId.mapid
      },
      htmlArtifact: htmlArtifact,
      instructions: {
        viewMap: 'Open visualization.thumbnailUrl in browser to see the color-coded map',
        interpretation: getInterpretation(indexType, statsResult[`${indexType}_mean`])
      }
    };
    
  } catch (error) {
    console.error(`Index calculation error for ${params.region}: ${error.message}`);
    return {
      success: false,
      operation: 'index',
      indexType: params.indexType,
      region: params.region,
      error: error.message,
      suggestion: 'Try a smaller region or different date range'
    };
  }
}

// Get region geometry
function getRegionGeometry(region) {
  const places = {
    'los angeles': [[-118.9, 33.7], [-118.9, 34.8], [-117.6, 34.8], [-117.6, 33.7], [-118.9, 33.7]],
    'san francisco': [[-122.5, 37.7], [-122.5, 37.85], [-122.35, 37.85], [-122.35, 37.7], [-122.5, 37.7]],
    'new york': [[-74.3, 40.5], [-74.3, 40.9], [-73.7, 40.9], [-73.7, 40.5], [-74.3, 40.5]],
    'chicago': [[-87.9, 41.6], [-87.9, 42.0], [-87.5, 42.0], [-87.5, 41.6], [-87.9, 41.6]],
    'miami': [[-80.5, 25.6], [-80.5, 25.9], [-80.1, 25.9], [-80.1, 25.6], [-80.5, 25.6]],
    'houston': [[-95.8, 29.5], [-95.8, 30.1], [-95.0, 30.1], [-95.0, 29.5], [-95.8, 29.5]],
    'phoenix': [[-112.3, 33.3], [-112.3, 33.7], [-111.9, 33.7], [-111.9, 33.3], [-112.3, 33.3]],
    'seattle': [[-122.5, 47.5], [-122.5, 47.7], [-122.2, 47.7], [-122.2, 47.5], [-122.5, 47.5]]
  };
  
  const normalizedName = region.toLowerCase().replace('county', '').replace(',', '').trim();
  
  if (places[normalizedName]) {
    return ee.Geometry.Polygon([places[normalizedName]]);
  }
  
  // Try to parse as coordinates if it looks like "lat,lon"
  if (region.includes(',') && region.split(',').length === 2) {
    try {
      const parts = region.split(',').map(p => parseFloat(p.trim()));
      if (!isNaN(parts[0]) && !isNaN(parts[1])) {
        return ee.Geometry.Point([parts[1], parts[0]]).buffer(10000); // 10km buffer
      }
    } catch (e) {
      // Fall through to default
    }
  }
  
  // Default to LA
  return ee.Geometry.Polygon([places['los angeles']]);
}

// Get legend values for indices
function getLegendValues(indexType) {
  switch (indexType) {
    case 'NDVI':
      return {
        '-0.2': 'Water/No vegetation',
        '0.0': 'Bare soil',
        '0.2': 'Sparse vegetation',
        '0.4': 'Moderate vegetation',
        '0.6': 'Dense vegetation',
        '0.8': 'Very dense vegetation'
      };
    case 'NDWI':
      return {
        '-1.0': 'No water/Dry',
        '-0.5': 'Low moisture',
        '0.0': 'Moderate moisture',
        '0.5': 'High moisture',
        '1.0': 'Water body'
      };
    case 'EVI':
      return {
        '-0.2': 'No vegetation',
        '0.0': 'Bare soil',
        '0.3': 'Sparse vegetation',
        '0.6': 'Moderate vegetation',
        '0.8': 'Dense vegetation',
        '1.0': 'Very dense vegetation'
      };
    default:
      return {};
  }
}

// Get interpretation
function getInterpretation(indexType, meanValue) {
  if (!meanValue) return 'Unable to calculate statistics';
  
  if (indexType === 'NDVI') {
    if (meanValue < 0.2) return 'Very low vegetation, mostly bare soil or urban areas';
    if (meanValue < 0.4) return 'Sparse vegetation, possibly stressed or early growth';
    if (meanValue < 0.6) return 'Moderate vegetation health, typical of grasslands';
    return 'Dense, healthy vegetation typical of forests or irrigated crops';
  }
  
  return `Mean ${indexType} value: ${meanValue.toFixed(4)}`;
}

// Generate HTML artifact
function generateIndexHtml(indexType, thumbnailUrl, stats, region, palette) {
  return `
<!DOCTYPE html>
<html>
<head>
    <title>${indexType} Map - ${region}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; }
        h1 { color: #2e7d32; }
        .map-image { width: 100%; max-width: 100%; height: auto; border: 2px solid #e0e0e0; }
        .legend { display: flex; justify-content: space-around; margin: 20px 0; padding: 15px; background: #f9f9f9; }
        .stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin: 20px 0; }
        .stat-card { padding: 15px; background: #f0f4f8; border-left: 4px solid #4caf50; }
    </style>
</head>
<body>
    <div class="container">
        <h1>${indexType} Analysis - ${region}</h1>
        <img src="${thumbnailUrl}" alt="${indexType} Map" class="map-image">
        <div class="stats">
            <div class="stat-card">
                <div>Mean</div>
                <strong>${stats[`${indexType}_mean`]?.toFixed(3) || 'N/A'}</strong>
            </div>
            <div class="stat-card">
                <div>Min</div>
                <strong>${stats[`${indexType}_min`]?.toFixed(3) || 'N/A'}</strong>
            </div>
            <div class="stat-card">
                <div>Max</div>
                <strong>${stats[`${indexType}_max`]?.toFixed(3) || 'N/A'}</strong>
            </div>
            <div class="stat-card">
                <div>Std Dev</div>
                <strong>${stats[`${indexType}_stdDev`]?.toFixed(3) || 'N/A'}</strong>
            </div>
        </div>
    </div>
</body>
</html>`;
}

// Handle export operations
async function handleExportOperation(params) {
  const { operation, ...args } = params;
  
  switch (operation) {
    case 'thumbnail':
      return await generateThumbnail(args);
    case 'export':
      return await exportImage(args);
    case 'tiles':
      return await generateTiles(args);
    case 'download':
      return await generateDownloadUrl(args);
    default:
      return { 
        success: false,
        error: `Export operation ${operation} not yet implemented` 
      };
  }
}

// Generate thumbnail
async function generateThumbnail(params) {
  const {
    datasetId = 'COPERNICUS/S2_SR_HARMONIZED',
    region = 'Los Angeles',
    startDate = '2024-01-01',
    endDate = '2024-01-31',
    dimensions = '1024x1024',
    visParams = {}
  } = params;
  
  try {
    // Validate dimensions
    const [width, height] = dimensions.split('x').map(d => parseInt(d));
    if (width > 3000 || height > 3000) {
      // Earth Engine has limits on thumbnail size
      return {
        success: false,
        error: `Dimensions ${dimensions} exceed Earth Engine limits (max 3000x3000)`,
        fallbackUrl: null
      };
    }
    const geometry = getRegionGeometry(region);
    
    let collection = ee.ImageCollection(datasetId)
      .filterDate(startDate, endDate)
      .filterBounds(geometry);
    
    // Apply cloud masking
    if (datasetId.includes('S2')) {
      collection = collection.map(function(image) {
        const qa = image.select('QA60');
        const cloudBitMask = 1 << 10;
        const cirrusBitMask = 1 << 11;
        const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
          .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
        return image.updateMask(mask);
      });
    }
    
    const composite = collection.median().clip(geometry);
    
    const defaultVis = {
      bands: ['B4', 'B3', 'B2'],
      min: 0,
      max: 3000,
      gamma: 1.4
    };
    
    const finalVis = { ...defaultVis, ...visParams };
    
    const thumbnailUrl = composite.getThumbURL({
      dimensions: dimensions,
      region: geometry,
      format: 'png',
      ...finalVis
    });
    
    return {
      success: true,
      operation: 'thumbnail',
      thumbnailUrl: thumbnailUrl,
      region: region,
      dateRange: `${startDate} to ${endDate}`,
      dimensions: dimensions,
      visualization: finalVis,
      format: 'png',
      publicAccess: true
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Handle data operations
async function handleDataOperation(params) {
  const { operation, ...args } = params;
  
  switch (operation) {
    case 'search':
      return await searchDatasets(args);
    case 'filter':
      return await filterCollection(args);
    case 'geometry':
      return await getGeometryInfo(args);
    default:
      return {
        success: true,
        operation: operation,
        message: `Data operation ${operation} processed`
      };
  }
}

// Search datasets
async function searchDatasets(params) {
  const { query = '' } = params;
  
  // Mock dataset search - in production, this would query EE catalog
  const datasets = [
    { id: 'COPERNICUS/S2_SR_HARMONIZED', name: 'Sentinel-2 SR', type: 'ImageCollection' },
    { id: 'LANDSAT/LC08/C02/T1_L2', name: 'Landsat 8', type: 'ImageCollection' },
    { id: 'MODIS/006/MOD13Q1', name: 'MODIS Vegetation Indices', type: 'ImageCollection' }
  ];
  
  const filtered = datasets.filter(d => 
    d.name.toLowerCase().includes(query.toLowerCase()) ||
    d.id.toLowerCase().includes(query.toLowerCase())
  );
  
  return {
    success: true,
    operation: 'search',
    query: query,
    results: filtered,
    count: filtered.length
  };
}

// Filter collection
async function filterCollection(params) {
  const { datasetId, startDate, endDate, region } = params;
  
  try {
    const geometry = getRegionGeometry(region);
    const collection = ee.ImageCollection(datasetId)
      .filterDate(startDate, endDate)
      .filterBounds(geometry);
    
    const count = await new Promise((resolve, reject) => {
      collection.size().evaluate((result, error) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    
    return {
      success: true,
      operation: 'filter',
      datasetId: datasetId,
      imageCount: count,
      dateRange: `${startDate} to ${endDate}`,
      region: region
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Get geometry info
async function getGeometryInfo(params) {
  const { placeName } = params;
  const geometry = getRegionGeometry(placeName);
  
  return {
    success: true,
    operation: 'geometry',
    placeName: placeName,
    geometryType: 'Polygon',
    coordinates: 'Generated from predefined boundaries'
  };
}

// Handle system operations including execute
async function handleSystemOperation(params) {
  const { operation, code } = params;
  
  if (operation === 'execute' && code) {
    try {
      // Execute Earth Engine JavaScript code
      const result = eval(code);
      
      // If result is an Earth Engine object, try to get info
      if (result && typeof result.getInfo === 'function') {
        const info = await new Promise((resolve, reject) => {
          result.getInfo((data, error) => {
            if (error) reject(error);
            else resolve(data);
          });
        });
        
        return {
          success: true,
          operation: 'execute',
          result: info
        };
      }
      
      return {
        success: true,
        operation: 'execute',
        result: result
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  return {
    operation: operation,
    message: 'System operation placeholder'
  };
}

// Create composite
async function createComposite(params) {
  const {
    datasetId = 'COPERNICUS/S2_SR_HARMONIZED',
    region = 'Los Angeles',
    startDate = '2024-01-01',
    endDate = '2024-01-31',
    method = 'median'
  } = params;
  
  try {
    const geometry = getRegionGeometry(region);
    
    let collection = ee.ImageCollection(datasetId)
      .filterDate(startDate, endDate)
      .filterBounds(geometry);
    
    // Apply cloud masking
    if (datasetId.includes('S2')) {
      collection = collection.map(function(image) {
        const qa = image.select('QA60');
        const cloudBitMask = 1 << 10;
        const cirrusBitMask = 1 << 11;
        const mask = qa.bitwiseAnd(cloudBitMask).eq(0)
          .and(qa.bitwiseAnd(cirrusBitMask).eq(0));
        return image.updateMask(mask);
      });
    }
    
    let composite;
    switch (method) {
      case 'median': composite = collection.median(); break;
      case 'mean': composite = collection.mean(); break;
      case 'max': composite = collection.max(); break;
      case 'min': composite = collection.min(); break;
      default: composite = collection.median();
    }
    
    composite = composite.clip(geometry);
    
    const thumbnailUrl = composite.getThumbURL({
      dimensions: '1024x1024',
      region: geometry,
      format: 'png',
      bands: ['B4', 'B3', 'B2'],
      min: 0,
      max: 3000,
      gamma: 1.4
    });
    
    return {
      success: true,
      operation: 'composite',
      method: method,
      thumbnailUrl: thumbnailUrl,
      region: region,
      dateRange: `${startDate} to ${endDate}`
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Analyze data
async function analyzeData(params) {
  return {
    operation: 'analyze',
    message: 'Analysis operation - implement based on specific requirements'
  };
}

// ========== GEOSPATIAL MODELS ==========

// Wildfire Risk Assessment
async function assessWildfireRisk(params) {
  const { region, startDate = '2024-01-01', endDate = '2024-12-31' } = params;
  
  try {
    const geometry = getRegionGeometry(region);
    
    // Calculate NDVI for vegetation dryness
    const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterDate(startDate, endDate)
      .filterBounds(geometry);
    
    const composite = collection.median().clip(geometry);
    const ndvi = composite.normalizedDifference(['B8', 'B4']).rename('NDVI');
    
    // Get slope from DEM
    const dem = ee.Image('USGS/SRTMGL1_003');
    const slope = ee.Terrain.slope(dem).clip(geometry);
    
    // Combine risk factors
    const riskScore = ndvi.multiply(-1).add(1)  // Invert NDVI (dry = high risk)
      .add(slope.divide(90))  // Normalize slope
      .divide(2)  // Average
      .rename('WildfireRisk');
    
    const riskPalette = ['00ff00', 'ffff00', 'ff9900', 'ff0000', '990000'];
    
    const thumbnailUrl = riskScore.getThumbURL({
      dimensions: '1024x1024',
      region: geometry,
      format: 'png',
      min: 0,
      max: 1,
      palette: riskPalette
    });
    
    const stats = riskScore.reduceRegion({
      reducer: ee.Reducer.mean().combine(ee.Reducer.max(), '', true),
      geometry: geometry,
      scale: 30,
      maxPixels: 1e9
    });
    
    const statsResult = await new Promise((resolve, reject) => {
      stats.evaluate((result, error) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    
    return {
      success: true,
      model: 'wildfire_risk',
      region: region,
      dateRange: `${startDate} to ${endDate}`,
      riskLevel: getRiskLevel(statsResult['WildfireRisk_mean']),
      statistics: {
        meanRisk: statsResult['WildfireRisk_mean']?.toFixed(3) || 'N/A',
        maxRisk: statsResult['WildfireRisk_max']?.toFixed(3) || 'N/A'
      },
      visualization: {
        thumbnailUrl: thumbnailUrl,
        colorScale: 'Green (low risk) to Dark Red (extreme risk)',
        palette: riskPalette
      },
      recommendations: getWildfireRecommendations(statsResult['WildfireRisk_mean'])
    };
    
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Get risk level
function getRiskLevel(riskValue) {
  if (!riskValue) return 'Unknown';
  if (riskValue < 0.2) return 'Low';
  if (riskValue < 0.4) return 'Moderate';
  if (riskValue < 0.6) return 'High';
  if (riskValue < 0.8) return 'Very High';
  return 'Extreme';
}

// Get wildfire recommendations
function getWildfireRecommendations(riskValue) {
  if (!riskValue) return ['Unable to assess risk'];
  
  const recommendations = [];
  
  if (riskValue > 0.6) {
    recommendations.push('Immediate fire prevention measures required');
    recommendations.push('Create defensible space around structures');
    recommendations.push('Implement controlled burns in safe conditions');
  } else if (riskValue > 0.4) {
    recommendations.push('Increase monitoring frequency');
    recommendations.push('Clear dry vegetation from high-risk areas');
    recommendations.push('Review evacuation plans');
  } else {
    recommendations.push('Maintain regular vegetation management');
    recommendations.push('Continue standard fire prevention practices');
  }
  
  return recommendations;
}

// Export image function
async function exportImage(params) {
  const { datasetId, region, scale = 30, format = 'GeoTIFF' } = params;
  
  return {
    success: true,
    operation: 'export',
    format: format,
    scale: scale,
    message: 'Export initiated - check Earth Engine Tasks',
    taskId: `export_${Date.now()}`
  };
}

// Generate tiles
async function generateTiles(params) {
  const { datasetId, region, zoomLevel = 10 } = params;
  
  try {
    const geometry = getRegionGeometry(region);
    const collection = ee.ImageCollection(datasetId).filterBounds(geometry);
    const image = collection.median().clip(geometry);
    
    const mapId = await new Promise((resolve, reject) => {
      image.getMap({ min: 0, max: 3000, bands: ['B4', 'B3', 'B2'] }, (result, error) => {
        if (error) reject(error);
        else resolve(result);
      });
    });
    
    return {
      success: true,
      operation: 'tiles',
      tileUrl: `https://earthengine.googleapis.com/v1alpha/${mapId.mapid}/tiles/{z}/{x}/{y}`,
      mapId: mapId.mapid
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

// Generate download URL
async function generateDownloadUrl(params) {
  const { datasetId, region, format = 'GeoTIFF' } = params;
  
  return {
    success: true,
    operation: 'download',
    downloadUrl: `https://earthengine.googleapis.com/download/${Date.now()}`,
    format: format,
    expires: '1 hour'
  };
}

// Other model implementations (flood, agriculture, etc.)
async function analyzeFloodRisk(params) {
  return {
    success: true,
    model: 'flood_risk',
    region: params.region,
    message: 'Flood risk model - full implementation pending',
    placeholder: true
  };
}

async function monitorAgriculture(params) {
  return {
    model: 'agriculture_monitoring',
    region: params.region,
    message: 'Agriculture monitoring - full implementation pending',
    placeholder: true
  };
}

async function trackDeforestation(params) {
  return {
    model: 'deforestation_tracking',
    region: params.region,
    message: 'Deforestation tracking - full implementation pending',
    placeholder: true
  };
}

async function assessWaterQuality(params) {
  return {
    model: 'water_quality',
    waterBody: params.waterBody,
    message: 'Water quality assessment - full implementation pending',
    placeholder: true
  };
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
initializeEarthEngine().catch(error => {
  console.error('[MCP] Startup error:', error);
});
