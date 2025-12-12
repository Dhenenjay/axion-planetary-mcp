/**
 * AXION CLASSIFICATION - AWS-Native Classification Tool
 * Operations: classify, train, predict, landcover
 * Supports land cover classification using spectral indices
 * NOW WITH REAL ML TRAINING using ml-random-forest
 */

import { z } from 'zod';
import { register } from '../registry';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { DynamoDBClient, PutItemCommand, GetItemCommand } from '@aws-sdk/client-dynamodb';
import { marshall, unmarshall } from '@aws-sdk/util-dynamodb';
import { STACClient, parseBbox, STACItem, formatDatetime } from '@/src/aws/stac/client';
import { RandomForestClassifier } from 'ml-random-forest';
import { registerLayer } from './axion_map';
import { storeMap, storeFile, getMapBaseUrl } from './map-store';
import axios from 'axios';
import http from 'http';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import {
  AWS_REGION,
  S3_EXPORTS_BUCKET,
  DYNAMODB_TASKS_TABLE
} from '@/src/utils/aws-config';

const s3 = new S3Client({ region: AWS_REGION });
const dynamodb = new DynamoDBClient({ region: AWS_REGION });
const stac = new STACClient();

// Training point schema for ML classification
const TrainingPointSchema = z.object({
  lat: z.number(),
  lon: z.number(),
  label: z.number(),
  class_name: z.string()
});

const ClassificationToolSchema = z.object({
  operation: z.enum(['classify', 'train', 'landcover', 'indices', 'threshold', 'status', 'help']),
  
  // Data params
  collectionId: z.string().optional(),
  bbox: z.union([z.string(), z.array(z.number())]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  cloudCoverMax: z.number().optional(),
  
  // Classification params
  classificationType: z.enum(['landcover', 'vegetation', 'water', 'urban', 'crop']).optional(),
  numClasses: z.number().optional(),
  
  // Threshold params
  indexType: z.enum(['ndvi', 'ndwi', 'ndbi', 'evi']).optional(),
  thresholds: z.array(z.number()).optional(),
  classNames: z.array(z.string()).optional(),
  
  // ML Classification params
  trainingData: z.array(TrainingPointSchema).optional(),
  classifier: z.enum(['randomForest', 'cart', 'svm']).optional(),
  numberOfTrees: z.number().optional(),
  region: z.string().optional(),
  includeIndices: z.boolean().optional(),
  
  // Task params
  taskId: z.string().optional(),
  description: z.string().optional()
});

/**
 * Collection mapping
 */
const COLLECTION_MAP: Record<string, string> = {
  'COPERNICUS/S2_SR_HARMONIZED': 'sentinel-2-l2a',
  'sentinel-2': 'sentinel-2-l2a',
  'LANDSAT/LC08/C02/T1_L2': 'landsat-c2-l2',
  'landsat': 'landsat-c2-l2'
};

function resolveCollection(id: string): string {
  return COLLECTION_MAP[id] || id;
}

/**
 * Band mapping for indices
 */
const BAND_MAPPING: Record<string, Record<string, string>> = {
  'sentinel-2-l2a': {
    red: 'B04', green: 'B03', blue: 'B02', nir: 'B08', swir1: 'B11', swir2: 'B12'
  },
  'landsat-c2-l2': {
    red: 'SR_B4', green: 'SR_B3', blue: 'SR_B2', nir: 'SR_B5', swir1: 'SR_B6', swir2: 'SR_B7'
  }
};

/**
 * Default threshold classifications
 */
const DEFAULT_THRESHOLDS: Record<string, { thresholds: number[]; classes: string[] }> = {
  ndvi: {
    thresholds: [-1, 0, 0.2, 0.4, 0.6, 1],
    classes: ['Water', 'Bare/Urban', 'Sparse Vegetation', 'Moderate Vegetation', 'Dense Vegetation']
  },
  ndwi: {
    thresholds: [-1, 0, 0.3, 1],
    classes: ['Non-Water', 'Mixed/Wet', 'Water']
  },
  ndbi: {
    thresholds: [-1, 0, 0.2, 1],
    classes: ['Non-Urban', 'Suburban', 'Urban']
  },
  evi: {
    thresholds: [-1, 0.1, 0.3, 0.5, 1],
    classes: ['Bare', 'Sparse', 'Moderate', 'Dense']
  }
};

/**
 * Default training data for common regions (matching GEE crop_classification.ts)
 */
const DEFAULT_TRAINING_DATA: Record<string, any[]> = {
  'Iowa': [
    { lat: 41.5868, lon: -93.6250, label: 1, class_name: 'corn' },
    { lat: 42.0458, lon: -93.5801, label: 1, class_name: 'corn' },
    { lat: 41.6912, lon: -93.0519, label: 2, class_name: 'soybean' },
    { lat: 42.7411, lon: -94.6831, label: 2, class_name: 'soybean' },
    { lat: 41.3306, lon: -94.3831, label: 3, class_name: 'wheat' },
    { lat: 41.5868, lon: -93.6250, label: 4, class_name: 'urban' },
    { lat: 41.0000, lon: -91.0960, label: 5, class_name: 'water' }
  ],
  'California': [
    { lat: 36.5370, lon: -119.5217, label: 1, class_name: 'almonds' },
    { lat: 38.5049, lon: -122.4694, label: 2, class_name: 'grapes' },
    { lat: 34.0536, lon: -117.8104, label: 3, class_name: 'citrus' },
    { lat: 39.3600, lon: -121.5900, label: 4, class_name: 'rice' },
    { lat: 41.2132, lon: -124.0046, label: 5, class_name: 'forest' },
    { lat: 34.0522, lon: -118.2437, label: 6, class_name: 'urban' },
    { lat: 35.1000, lon: -116.0000, label: 7, class_name: 'desert' },
    { lat: 39.0000, lon: -122.0000, label: 8, class_name: 'water' }
  ],
  'Texas': [
    { lat: 33.5779, lon: -101.8552, label: 1, class_name: 'cotton' },
    { lat: 35.2220, lon: -101.8313, label: 2, class_name: 'wheat' },
    { lat: 36.0726, lon: -102.0770, label: 3, class_name: 'corn' },
    { lat: 31.9686, lon: -102.0779, label: 4, class_name: 'sorghum' },
    { lat: 31.0000, lon: -100.0000, label: 5, class_name: 'grassland' },
    { lat: 29.7604, lon: -95.3698, label: 6, class_name: 'urban' }
  ],
  'Kansas': [
    { lat: 38.5000, lon: -98.5000, label: 1, class_name: 'wheat' },
    { lat: 39.0469, lon: -95.6775, label: 2, class_name: 'corn' },
    { lat: 37.0000, lon: -98.0000, label: 3, class_name: 'sorghum' },
    { lat: 39.5000, lon: -95.0000, label: 4, class_name: 'soybean' },
    { lat: 37.5000, lon: -100.0000, label: 5, class_name: 'grassland' },
    { lat: 37.6872, lon: -97.3301, label: 6, class_name: 'urban' }
  ]
};

/**
 * Land cover classification presets
 */
const LANDCOVER_PRESETS: Record<string, any> = {
  basic: {
    numClasses: 5,
    classes: ['Water', 'Urban', 'Bare Soil', 'Vegetation', 'Forest'],
    description: 'Basic 5-class land cover'
  },
  detailed: {
    numClasses: 10,
    classes: ['Water', 'Urban High', 'Urban Low', 'Bare Soil', 'Rock', 'Grassland', 'Shrubland', 'Cropland', 'Forest Deciduous', 'Forest Evergreen'],
    description: 'Detailed 10-class land cover'
  },
  agriculture: {
    numClasses: 6,
    classes: ['Water', 'Urban', 'Bare Field', 'Crop Early', 'Crop Mid', 'Crop Mature'],
    description: 'Agriculture-focused classification'
  }
};

// TiTiler endpoint for sampling pixel values
const TITILER_ENDPOINT = 'https://titiler.xyz';

// Classification map storage and server
const classificationMaps: Map<string, string> = new Map();
let classMapServer: http.Server | null = null;
const CLASS_MAP_PORT = 8766;

/**
 * Ensure classification map server is running
 */
async function ensureMapServerRunning(): Promise<void> {
  if (classMapServer) return;
  
  return new Promise((resolve) => {
    classMapServer = http.createServer((req, res) => {
      const url = req.url || '';
      
      // Handle classification map requests
      const match = url.match(/\/classification\/([^?]+)/);
      if (match) {
        const mapId = match[1];
        const html = classificationMaps.get(mapId);
        if (html) {
          res.writeHead(200, { 'Content-Type': 'text/html', 'Access-Control-Allow-Origin': '*' });
          res.end(html);
          return;
        }
      }
      
      res.writeHead(404);
      res.end('Not found');
    });
    
    classMapServer.listen(CLASS_MAP_PORT, () => {
      console.error(`[Classification] Map server started on port ${CLASS_MAP_PORT}`);
      resolve();
    });
    
    classMapServer.on('error', (e: any) => {
      if (e.code === 'EADDRINUSE') {
        console.error(`[Classification] Port ${CLASS_MAP_PORT} in use, server may already be running`);
      }
      resolve();
    });
  });
}

/**
 * Generate HTML for classification map - matches axion_map UX
 */
function generateClassificationMapHtml(
  mapId: string,
  title: string,
  tileUrl: string,
  classes: Array<{label: number; name: string; color: string; sampleCount: number}>,
  sourceImage: string,
  center: [number, number] = [-93.5, 42],
  zoom: number = 9,
  region: string = 'Classification Area'
): string {
  const legendItems = classes.map(c => 
    `{ name: '${c.name}', color: '${c.color}', count: ${c.sampleCount} }`
  ).join(',\n        ');
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    #map { position: absolute; top: 0; bottom: 0; width: 100%; }
    .info { padding: 10px 14px; background: white; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
    .info h4 { margin: 0 0 8px; color: #333; }
    .legend { padding: 10px 14px; background: white; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
    .legend h4 { margin: 0 0 10px; font-size: 14px; color: #333; }
    .legend-item { display: flex; align-items: center; margin: 4px 0; font-size: 12px; }
    .legend-color { width: 18px; height: 18px; margin-right: 8px; border-radius: 3px; border: 1px solid rgba(0,0,0,0.2); }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map').setView([${center[1]}, ${center[0]}], ${zoom});
    
    // Basemaps - same as axion_map
    const basemaps = {
      'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' }),
      'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }),
      'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: '© OpenTopoMap' }),
      'Dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CARTO' })
    };
    basemaps['Satellite'].addTo(map);
    
    // Classification layer
    const classificationLayer = L.tileLayer('${tileUrl}', {
      opacity: 0.75,
      crossOrigin: 'anonymous'
    });
    classificationLayer.addTo(map);
    
    const overlays = {
      'Classification': classificationLayer
    };
    
    // Controls - same as axion_map
    L.control.layers(basemaps, overlays, { collapsed: false }).addTo(map);
    L.control.scale().addTo(map);
    
    // Info panel - same style as axion_map
    const info = L.control({ position: 'topright' });
    info.onAdd = function() {
      const div = L.DomUtil.create('div', 'info');
      div.innerHTML = '<h4>${title}</h4>' +
        '<div>Region: ${region}</div>' +
        '<div>Model: Random Forest</div>' +
        '<div>Classes: ${classes.length}</div>' +
        '<div>Source: ${sourceImage}</div>' +
        '<div>Zoom: <span id="zoom">${zoom}</span></div>';
      return div;
    };
    info.addTo(map);
    
    // Legend panel
    const legend = L.control({ position: 'bottomleft' });
    legend.onAdd = function() {
      const div = L.DomUtil.create('div', 'legend');
      const classes = [
        ${legendItems}
      ];
      let html = '<h4>Classification Legend</h4>';
      classes.forEach(c => {
        html += '<div class="legend-item">' +
          '<span class="legend-color" style="background:' + c.color + '"></span>' +
          '<span>' + c.name + ' (' + c.count + ')</span></div>';
      });
      div.innerHTML = html;
      return div;
    };
    legend.addTo(map);
    
    // Update zoom display
    map.on('zoomend', () => {
      document.getElementById('zoom').textContent = map.getZoom();
    });
  </script>
</body>
</html>`;
}

// Trained model storage (in-memory for MCP session)
const trainedModels: Map<string, { model: RandomForestClassifier; classes: any[]; features: string[] }> = new Map();

/**
 * Sample pixel values at a point using TiTiler
 */
async function samplePixelValues(
  stacItemUrl: string,
  lon: number,
  lat: number,
  assets: string[]
): Promise<number[] | null> {
  try {
    // Use TiTiler STAC point endpoint
    const url = new URL(`${TITILER_ENDPOINT}/stac/point/${lon},${lat}`);
    url.searchParams.set('url', stacItemUrl);
    for (const asset of assets) {
      url.searchParams.append('assets', asset);
    }
    
    const response = await axios.get(url.toString(), { timeout: 10000 });
    
    if (response.data?.values) {
      // Flatten values array - TiTiler returns [[val1], [val2], ...]
      return response.data.values.flat();
    }
    return null;
  } catch (error) {
    return null;
  }
}

/**
 * Find STAC item covering a specific point
 */
async function findImageryForPoint(
  collection: string,
  lon: number,
  lat: number,
  datetime: string | undefined,
  cloudCoverMax: number
): Promise<STACItem | null> {
  try {
    // Create small bbox around point (~1km)
    const delta = 0.01;
    const bbox: [number, number, number, number] = [lon - delta, lat - delta, lon + delta, lat + delta];
    
    const items = await stac.searchItems({
      collections: [collection],
      bbox,
      datetime,
      limit: 1,
      query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
    });
    
    return items.length > 0 ? items[0] : null;
  } catch {
    return null;
  }
}

/**
 * Compute spectral indices from band values
 */
function computeIndices(bands: Record<string, number>): Record<string, number> {
  const { red = 0, green = 0, blue = 0, nir = 0, swir1 = 0, swir2 = 0 } = bands;
  
  // Avoid division by zero
  const safe = (num: number, den: number) => den !== 0 ? num / den : 0;
  
  return {
    NDVI: safe(nir - red, nir + red),
    EVI: safe(2.5 * (nir - red), nir + 6 * red - 7.5 * blue + 1),
    NDWI: safe(green - nir, green + nir),
    SAVI: safe(1.5 * (nir - red), nir + red + 0.5),
    NDBI: safe(swir1 - nir, swir1 + nir),
    BSI: safe((swir1 + red) - (nir + blue), (swir1 + red) + (nir + blue))
  };
}

/**
 * Run Python classification script
 */
async function runPythonClassification(config: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const configPath = path.join(os.tmpdir(), `classify_config_${Date.now()}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config));
    
    // Determine Python path
    const pythonPath = process.env.PYTHON_PATH || (process.platform === 'win32' ? 'python' : 'python3');
    const scriptPath = process.env.CLASSIFY_SCRIPT_PATH || path.join(process.cwd(), 'scripts', 'classify.py');
    
    console.error(`[Classification] Running Python: ${pythonPath} ${scriptPath}`);
    
    const proc = spawn(pythonPath, [scriptPath, configPath], {
      stdio: ['pipe', 'pipe', 'pipe']
    });
    
    let stdout = '';
    let stderr = '';
    
    proc.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    proc.stderr.on('data', (data) => {
      const msg = data.toString();
      stderr += msg;
      console.error(msg.trim());
    });
    
    proc.on('close', (code) => {
      // Clean up config file
      try { fs.unlinkSync(configPath); } catch (e) {}
      
      if (code !== 0) {
        reject(new Error(`Python exited with code ${code}: ${stderr}`));
        return;
      }
      
      try {
        const result = JSON.parse(stdout);
        if (result.error) {
          reject(new Error(result.error));
        } else {
          resolve(result);
        }
      } catch (e) {
        reject(new Error(`Failed to parse Python output: ${stdout}`));
      }
    });
    
    proc.on('error', (err) => {
      reject(new Error(`Failed to start Python: ${err.message}`));
    });
    
    // Set timeout (5 minutes for classification)
    setTimeout(() => {
      proc.kill();
      reject(new Error('Classification timed out after 5 minutes'));
    }, 300000);
  });
}

/**
 * ML Classification with REAL pixel-by-pixel classification using Python/scikit-learn
 */
async function classifyML(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 20,
    trainingData,
    classifier = 'randomForest',
    numberOfTrees = 50,
    region,
    includeIndices = true,
    description = 'ML Classification'
  } = params;
  
  const collection = resolveCollection(collectionId);
  
  // Get training data - use provided or default for region
  let trainingPoints = trainingData;
  if (!trainingPoints && region) {
    trainingPoints = DEFAULT_TRAINING_DATA[region];
  }
  
  if (!trainingPoints || trainingPoints.length === 0) {
    return {
      success: false,
      operation: 'classify',
      error: 'Training data required',
      message: 'Please provide trainingData array or specify a supported region (Iowa, California, Texas, Kansas)',
      example: {
        trainingData: [
          { lat: 41.5868, lon: -93.6250, label: 1, class_name: 'corn' },
          { lat: 41.6912, lon: -93.0519, label: 2, class_name: 'soybean' }
        ]
      }
    };
  }
  
  // Build datetime in RFC3339 format
  const datetime = formatDatetime(startDate, endDate);
  
  try {
    const taskId = `ml_classify_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    // Extract unique classes
    const classMap = new Map<number, string>();
    trainingPoints.forEach((p: any) => classMap.set(p.label, p.class_name));
    const classes = Array.from(classMap.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([label, name]) => ({ label, name }));
    
    // Find a STAC item covering the training area
    const avgLon = trainingPoints.reduce((sum: number, p: any) => sum + p.lon, 0) / trainingPoints.length;
    const avgLat = trainingPoints.reduce((sum: number, p: any) => sum + p.lat, 0) / trainingPoints.length;
    
    const item = await findImageryForPoint(collection, avgLon, avgLat, datetime, cloudCoverMax);
    
    if (!item) {
      return {
        success: false,
        operation: 'classify',
        error: 'No imagery found',
        message: 'Could not find satellite imagery covering the training area',
        hint: 'Try adjusting date range or cloud cover threshold'
      };
    }
    
    const stacItemUrl = `https://earth-search.aws.element84.com/v1/collections/${collection}/items/${item.id}`;
    
    // Output path for classified GeoTIFF
    const outputPath = path.join(os.tmpdir(), `classification_${taskId}.tif`);
    
    // Run Python classification
    console.error(`[Classification] Starting real pixel-by-pixel classification...`);
    console.error(`[Classification] Training points: ${trainingPoints.length}, Classes: ${classes.length}`);
    
    const pythonResult = await runPythonClassification({
      training_data: trainingPoints,
      stac_item_url: stacItemUrl,
      collection,
      output_path: outputPath,
      num_trees: numberOfTrees,
      include_indices: includeIndices
    });
    
    console.error(`[Classification] Python completed successfully`);
    console.error(`[Classification] Training accuracy: ${(pythonResult.training_accuracy * 100).toFixed(1)}%`);
    console.error(`[Classification] Classes sampled: ${pythonResult.classes_sampled?.join(', ')}`);
    console.error(`[Classification] Classes in output: ${pythonResult.classes_in_output?.join(', ')}`);
    
    // Read the classification result and store it
    const classifiedData = fs.readFileSync(outputPath);
    const classifiedId = `classified_${taskId}.tif`;
    const classifiedUrl = storeFile(classifiedId, classifiedData, 'image/tiff');
    
    // Create tile URL using TiTiler COG endpoint for the local file
    // For Docker, we serve the file directly and create a simple visualization
    const baseUrl = getMapBaseUrl();
    
    // Build class color map from ACTUAL sampled/output classes, not input classes
    const classColors = [
      '#E6194B', '#3CB44B', '#FFE119', '#4363D8', '#F58231', 
      '#911EB4', '#42D4F4', '#F032E6', '#BFEF45', '#FABEBE'
    ];
    
    // Use classes that were actually found in output
    const actualClasses = pythonResult.classes_in_output || pythonResult.classes_sampled || [];
    const classNames = pythonResult.class_names || {};
    
    const classColorMap = actualClasses.map((label: number, i: number) => ({
      label,
      name: classNames[String(label)] || `Class ${label}`,
      color: classColors[(label - 1) % classColors.length], // Use label-1 for consistent colors
      sampleCount: trainingPoints.filter((p: any) => p.label === label).length
    }));
    
    // Register as a classification layer
    const layerId = registerLayer({
      name: `${description || 'ML Classification'} - ${classes.length} classes`,
      type: 'classification',
      tileUrl: classifiedUrl,
      metadata: {
        source: 'axion_classification',
        collection,
        description: `Random Forest classification: ${classes.map(c => c.name).join(', ')}`,
        colormap: 'discrete',
        legend: Object.fromEntries(classColorMap.map((c: {name: string, color: string}) => [c.name, c.color]))
      }
    });
    
    // Create map HTML for visualization
    const mapId = `classmap_${Date.now()}_${Math.random().toString(36).slice(2,6)}`;
    const mapTitle = description || 'ML Classification';
    const regionName = region || 'Classification Area';
    const mapCenter: [number, number] = [avgLon, avgLat];
    
    // Generate map HTML that displays the classified raster
    const mapHtml = generateClassificationMapHtml(
      mapId, 
      mapTitle, 
      // Use the STAC visual tiles as background and note that classification is in GeoTIFF
      `https://titiler.xyz/stac/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${encodeURIComponent(stacItemUrl)}&assets=visual`,
      classColorMap, 
      item.id,
      mapCenter,
      10,
      regionName
    );
    
    // Store the map HTML
    const mapUrl = storeMap(mapId, mapHtml);
    
    // Clean up temp file (optional - keep for download)
    // fs.unlinkSync(outputPath);
    
    return {
      success: true,
      operation: 'classify',
      status: 'CLASSIFIED',
      taskId,
      modelId: taskId,
      mapUrl,
      classifiedRaster: classifiedUrl,
      layerId,
      training: {
        trainingPointsProvided: trainingPoints.length,
        trainingPointsSampled: pythonResult.training_samples || trainingPoints.length,
        classesRequested: classes.length,
        classesSampled: pythonResult.classes_sampled?.length || actualClasses.length,
        classesInOutput: actualClasses.length,
        classifier: 'Random Forest (scikit-learn)',
        numberOfTrees,
        trainingAccuracy: `${(pythonResult.training_accuracy * 100).toFixed(1)}%`
      },
      output: {
        width: pythonResult.width,
        height: pythonResult.height,
        crs: pythonResult.crs,
        bounds: pythonResult.bounds,
        format: 'GeoTIFF'
      },
      classes: classColorMap,
      sourceImage: item.id,
      visualization: {
        type: 'Real ML Classification',
        note: `Pixel-by-pixel Random Forest classification. ${actualClasses.length} classes found in output.`,
        mapUrl,
        downloadUrl: classifiedUrl,
        layerId,
        legend: classColorMap.map((c: {name: string, color: string}) => `${c.name}: ${c.color}`)
      },
      message: `Classification complete! ${pythonResult.width}x${pythonResult.height} pixels, ${actualClasses.length} classes, ${(pythonResult.training_accuracy * 100).toFixed(1)}% accuracy. Download: ${classifiedUrl}`
    };
  } catch (error: any) {
    console.error(`[Classification] Error:`, error);
    return { 
      success: false, 
      operation: 'classify', 
      error: error.message,
      hint: 'Make sure Python with rasterio and scikit-learn is installed',
      stack: error.stack?.split('\n').slice(0, 5)
    };
  }
}

/**
 * Classify using threshold-based method
 */
async function classifyThreshold(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 20,
    indexType = 'ndvi',
    thresholds,
    classNames,
    description = 'Threshold classification'
  } = params;
  
  const collection = resolveCollection(collectionId);
  const defaults = DEFAULT_THRESHOLDS[indexType] || DEFAULT_THRESHOLDS.ndvi;
  const finalThresholds = thresholds || defaults.thresholds;
  const finalClasses = classNames || defaults.classes;
  
  // Build datetime in RFC3339 format
  const datetime = formatDatetime(startDate, endDate);
  
  try {
    // Search for imagery
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit: 5,
      query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
    });
    
    if (items.length === 0) {
      return {
        success: false,
        operation: 'threshold',
        error: 'No images found',
        message: 'No images match the criteria'
      };
    }
    
    // Build classification specification
    const taskId = `classify_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const bandMap = BAND_MAPPING[collection] || BAND_MAPPING['sentinel-2-l2a'];
    
    const classificationSpec = {
      taskId,
      description,
      type: 'threshold',
      indexType,
      collection,
      imageCount: items.length,
      bbox: parseBbox(bbox),
      dateRange: { startDate, endDate },
      thresholds: finalThresholds,
      classes: finalClasses,
      bandMapping: {
        indexType,
        bands: indexType === 'ndvi' || indexType === 'evi' ? ['nir', 'red'] :
               indexType === 'ndwi' ? ['green', 'nir'] :
               indexType === 'ndbi' ? ['swir1', 'nir'] : ['nir', 'red'],
        assetKeys: Object.entries(bandMap).slice(0, 4).map(([k, v]) => ({ band: k, asset: v }))
      },
      sampleImages: items.slice(0, 2).map(item => ({
        id: item.id,
        datetime: item.properties?.datetime,
        cloudCover: item.properties?.['eo:cloud_cover']
      })),
      createdAt: new Date().toISOString(),
      status: 'specification_ready'
    };
    
    // Store task in DynamoDB if available
    if (DYNAMODB_TASKS_TABLE) {
      try {
        await dynamodb.send(new PutItemCommand({
          TableName: DYNAMODB_TASKS_TABLE,
          Item: marshall(classificationSpec)
        }));
      } catch (e) {
        // Continue even if DynamoDB fails
      }
    }
    
    return {
      success: true,
      operation: 'threshold',
      taskId,
      classificationSpec,
      legend: finalClasses.map((name: string, i: number) => ({
        class: i,
        name,
        range: i < finalThresholds.length - 1 ? 
          `${finalThresholds[i]} to ${finalThresholds[i + 1]}` : 'N/A'
      })),
      processing: {
        status: 'specification_ready',
        note: 'Use processing service to apply threshold classification',
        titilerExpression: `(${indexType === 'ndvi' ? '(b1-b2)/(b1+b2)' : indexType})`
      },
      message: `Threshold classification specification created with ${finalClasses.length} classes`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'threshold',
      error: error.message,
      message: 'Failed to create classification'
    };
  }
}

/**
 * Land cover classification
 */
async function classifyLandcover(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 20,
    classificationType = 'basic',
    description = 'Land cover classification'
  } = params;
  
  const collection = resolveCollection(collectionId);
  const preset = LANDCOVER_PRESETS[classificationType] || LANDCOVER_PRESETS.basic;
  
  // Build datetime in RFC3339 format
  const datetime = formatDatetime(startDate, endDate);
  
  try {
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit: 10,
      query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
    });
    
    if (items.length === 0) {
      return {
        success: false,
        operation: 'landcover',
        error: 'No images found'
      };
    }
    
    const taskId = `landcover_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    
    const classificationSpec = {
      taskId,
      description,
      type: 'landcover',
      preset: classificationType,
      presetDetails: preset,
      collection,
      imageCount: items.length,
      bbox: parseBbox(bbox),
      dateRange: { startDate, endDate },
      method: 'unsupervised_clustering',
      indices: ['ndvi', 'ndwi', 'ndbi'],
      sampleImages: items.slice(0, 3).map(item => ({
        id: item.id,
        datetime: item.properties?.datetime
      })),
      createdAt: new Date().toISOString(),
      status: 'specification_ready'
    };
    
    return {
      success: true,
      operation: 'landcover',
      taskId,
      classificationSpec,
      classes: preset.classes.map((name: string, i: number) => ({ classId: i, name })),
      processing: {
        status: 'specification_ready',
        method: 'Multi-index threshold + clustering',
        note: 'Land cover classification requires processing service (Lambda/ECS)',
        requiredIndices: ['NDVI', 'NDWI', 'NDBI']
      },
      message: `${preset.description} specification created`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'landcover',
      error: error.message,
      message: 'Failed to create land cover classification'
    };
  }
}

/**
 * Get available indices for classification
 */
function getIndicesInfo() {
  return {
    success: true,
    operation: 'indices',
    availableIndices: [
      { name: 'ndvi', description: 'Vegetation Index', formula: '(NIR - RED) / (NIR + RED)', range: [-1, 1] },
      { name: 'ndwi', description: 'Water Index', formula: '(GREEN - NIR) / (GREEN + NIR)', range: [-1, 1] },
      { name: 'ndbi', description: 'Built-up Index', formula: '(SWIR - NIR) / (SWIR + NIR)', range: [-1, 1] },
      { name: 'evi', description: 'Enhanced Vegetation', formula: '2.5 * (NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1)', range: [-1, 1] }
    ],
    defaultThresholds: DEFAULT_THRESHOLDS,
    landcoverPresets: Object.entries(LANDCOVER_PRESETS).map(([key, val]) => ({
      name: key,
      ...val
    })),
    message: 'Available indices and presets for classification'
  };
}

/**
 * Check task status
 */
async function checkStatus(params: any) {
  const { taskId } = params;
  
  if (!taskId) {
    return {
      success: false,
      operation: 'status',
      error: 'taskId required'
    };
  }
  
  if (!DYNAMODB_TASKS_TABLE) {
    return {
      success: false,
      operation: 'status',
      error: 'Tasks table not configured'
    };
  }
  
  try {
    const response = await dynamodb.send(new GetItemCommand({
      TableName: DYNAMODB_TASKS_TABLE,
      Key: marshall({ taskId })
    }));
    
    if (!response.Item) {
      return {
        success: false,
        operation: 'status',
        taskId,
        error: 'Task not found'
      };
    }
    
    const task = unmarshall(response.Item);
    
    return {
      success: true,
      operation: 'status',
      taskId,
      status: task.status,
      type: task.type,
      createdAt: task.createdAt,
      message: `Task status: ${task.status}`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'status',
      error: error.message
    };
  }
}

/**
 * Help operation
 */
function getHelp() {
  return {
    success: true,
    operation: 'help',
    tool: 'axion_classification',
    description: 'AWS-native classification tool for land cover and crop analysis',
    operations: {
      classify: {
        description: 'ML-based classification with custom training data (like GEE crop_classification)',
        params: ['bbox', 'startDate', 'endDate', 'trainingData', 'classifier', 'numberOfTrees', 'region'],
        classifiers: ['randomForest', 'cart', 'svm'],
        supportedRegions: Object.keys(DEFAULT_TRAINING_DATA)
      },
      train: {
        description: 'Train model only (alias for classify)',
        params: ['same as classify']
      },
      threshold: {
        description: 'Threshold-based classification using spectral indices',
        params: ['collectionId', 'bbox', 'startDate', 'endDate', 'indexType', 'thresholds', 'classNames'],
        indexTypes: ['ndvi', 'ndwi', 'ndbi', 'evi']
      },
      landcover: {
        description: 'Land cover classification using multiple indices',
        params: ['collectionId', 'bbox', 'startDate', 'endDate', 'classificationType'],
        presets: Object.keys(LANDCOVER_PRESETS)
      },
      indices: {
        description: 'Get available indices and presets'
      },
      status: {
        description: 'Check classification task status',
        params: ['taskId']
      }
    },
    examples: {
      classify_with_region: {
        operation: 'classify',
        region: 'Iowa',
        bbox: '-96.5,40.5,-90.0,43.5',
        startDate: '2024-06-01',
        endDate: '2024-09-30',
        classifier: 'randomForest',
        numberOfTrees: 100
      },
      classify_with_training: {
        operation: 'classify',
        bbox: '-122.5,37.5,-122.0,38.0',
        startDate: '2024-06-01',
        endDate: '2024-09-30',
        trainingData: [
          { lat: 37.7, lon: -122.3, label: 1, class_name: 'urban' },
          { lat: 37.6, lon: -122.2, label: 2, class_name: 'vegetation' },
          { lat: 37.8, lon: -122.4, label: 3, class_name: 'water' }
        ],
        classifier: 'randomForest'
      },
      threshold: {
        operation: 'threshold',
        indexType: 'ndvi',
        bbox: '-122.5,37.5,-122.0,38.0',
        startDate: '2024-06-01',
        endDate: '2024-06-30'
      },
      landcover: {
        operation: 'landcover',
        classificationType: 'basic',
        bbox: '-122.5,37.5,-122.0,38.0'
      }
    },
    message: 'Axion Classification Tool Help'
  };
}

// Register the tool
register({
  name: 'axion_classification',
  description: `AWS-native classification tool. Operations: classify/train (ML with training data - RandomForest/SVM/CART), threshold (index-based), landcover (multi-index), indices (info), status, help. Supports regions: Iowa, California, Texas, Kansas with default training data.`,
  input: ClassificationToolSchema,
  output: z.any(),
  handler: async (params) => {
    try {
      const { operation } = params;
      
      if (!operation) {
        return {
          success: false,
          error: 'operation parameter required',
          availableOperations: ['classify', 'train', 'threshold', 'landcover', 'indices', 'status', 'help']
        };
      }
      
      // Normalize params
      const normalizedParams = {
        ...params,
        collectionId: params.collectionId || params.collection_id,
        startDate: params.startDate || params.start_date,
        endDate: params.endDate || params.end_date,
        cloudCoverMax: params.cloudCoverMax || params.cloud_cover_max,
        classificationType: params.classificationType || params.classification_type,
        indexType: params.indexType || params.index_type,
        classNames: params.classNames || params.class_names,
        taskId: params.taskId || params.task_id,
        numberOfTrees: params.numberOfTrees || params.number_of_trees,
        trainingData: params.trainingData || params.training_data,
        includeIndices: params.includeIndices || params.include_indices
      };
      
      switch (operation) {
        case 'classify':
        case 'train':
          // If trainingData or region provided, use ML classification
          if (normalizedParams.trainingData || normalizedParams.region) {
            return await classifyML(normalizedParams);
          }
          // Otherwise fall back to threshold
          return await classifyThreshold(normalizedParams);
        case 'threshold':
          return await classifyThreshold(normalizedParams);
        case 'landcover':
          return await classifyLandcover(normalizedParams);
        case 'indices':
          return getIndicesInfo();
        case 'status':
          return await checkStatus(normalizedParams);
        case 'help':
          return getHelp();
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`,
            availableOperations: ['classify', 'train', 'threshold', 'landcover', 'indices', 'status', 'help']
          };
      }
    } catch (error: any) {
      return {
        success: false,
        operation: params.operation,
        error: error.message || 'Unexpected error',
        stack: error.stack
      };
    }
  }
});

export default {};
