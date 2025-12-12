/**
 * AXION MAP - AWS-Native Interactive Map Tool
 * Rebuilt to match GEE earth_engine_map implementation pattern
 * 
 * Operations: create, list, delete
 * Creates interactive Leaflet maps with satellite imagery from STAC
 */

import { z } from 'zod';
import { register } from '../registry';
import { STACClient, parseBbox, formatDatetime, STACItem } from '@/src/aws/stac/client';
import http from 'http';
import https from 'https';
import { URL } from 'url';
import { storeMap, getMapBaseUrl } from './map-store';

const stac = new STACClient();

// ============================================================================
// GEOCODING (Nominatim - free, no API key)
// ============================================================================

async function geocodePlace(placeName: string): Promise<[number, number, number, number] | null> {
  return new Promise((resolve) => {
    const query = encodeURIComponent(placeName);
    const url = `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`;
    
    const req = https.get(url, {
      headers: { 'User-Agent': 'Axion-MCP/1.0' }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = JSON.parse(data);
          if (results && results.length > 0) {
            const r = results[0];
            // boundingbox is [south, north, west, east] in Nominatim
            const bbox: [number, number, number, number] = [
              parseFloat(r.boundingbox[2]), // west
              parseFloat(r.boundingbox[0]), // south
              parseFloat(r.boundingbox[3]), // east
              parseFloat(r.boundingbox[1])  // north
            ];
            console.error(`[Geocode] ${placeName} -> [${bbox.join(', ')}]`);
            resolve(bbox);
          } else {
            resolve(null);
          }
        } catch {
          resolve(null);
        }
      });
    });
    
    req.on('error', () => resolve(null));
    req.setTimeout(10000, () => { req.destroy(); resolve(null); });
  });
}

// ============================================================================
// MAP SESSION STORAGE
// ============================================================================

interface MapLayer {
  name: string;
  tileUrl: string;
  opacity: number;
  bounds?: [[number, number], [number, number]];
}

interface MapSession {
  id: string;
  title: string;
  created: Date;
  region: string;
  layers: MapLayer[];
  metadata: {
    center: [number, number];
    zoom: number;
    basemap: string;
  };
}

// Global session storage
const activeMaps: Record<string, MapSession> = {};

// ============================================================================
// GLOBAL LAYER REGISTRY - Any tool can register layers here
// ============================================================================

export interface RegisteredLayer {
  id: string;
  name: string;
  type: 'index' | 'classification' | 'model' | 'composite' | 'analysis' | 'custom';
  tileUrl: string;
  previewUrl?: string;
  metadata: {
    source: string;  // Tool that created it
    collection?: string;
    bbox?: number[];
    datetime?: string;
    description?: string;
    colormap?: string;
    legend?: Record<string, string>;
  };
  created: Date;
}

// Global registry of analysis layers
export const layerRegistry: Record<string, RegisteredLayer> = {};

/**
 * Register a layer from any analysis tool
 * Call this from axion_process, axion_classification, etc.
 */
export function registerLayer(layer: Omit<RegisteredLayer, 'id' | 'created'>): string {
  const id = `layer_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  layerRegistry[id] = {
    ...layer,
    id,
    created: new Date()
  };
  console.error(`[LayerRegistry] Registered: ${id} - ${layer.name}`);
  return id;
}

/**
 * Get all registered layers
 */
export function getRegisteredLayers(): RegisteredLayer[] {
  return Object.values(layerRegistry);
}

/**
 * Clear old layers (optional cleanup)
 */
export function clearOldLayers(maxAgeMs: number = 3600000) {
  const now = Date.now();
  for (const [id, layer] of Object.entries(layerRegistry)) {
    if (now - layer.created.getTime() > maxAgeMs) {
      delete layerRegistry[id];
    }
  }
}

// ============================================================================
// LOCAL MAP SERVER
// ============================================================================

let mapServer: http.Server | null = null;
let serverPort = 8765;

function getMapHtml(session: MapSession): string {
  const layersJson = JSON.stringify(session.layers);
  const center = session.metadata.center;
  const zoom = session.metadata.zoom;
  
  return `<!DOCTYPE html>
<html>
<head>
  <title>${session.title}</title>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    body { margin: 0; padding: 0; }
    #map { position: absolute; top: 0; bottom: 0; width: 100%; }
    .info { padding: 10px 14px; background: white; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.2); }
    .info h4 { margin: 0 0 8px; color: #333; }
    .layer-toggle { margin: 4px 0; }
    .layer-toggle label { cursor: pointer; margin-left: 4px; }
  </style>
</head>
<body>
  <div id="map"></div>
  <script>
    const map = L.map('map').setView([${center[1]}, ${center[0]}], ${zoom});
    
    // Basemaps
    const basemaps = {
      'Satellite': L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: '© Esri' }),
      'OpenStreetMap': L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }),
      'Terrain': L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { attribution: '© OpenTopoMap' }),
      'Dark': L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CARTO' })
    };
    
    basemaps['${session.metadata.basemap}'].addTo(map);
    
    // Data layers
    const layers = ${layersJson};
    const overlays = {};
    
    layers.forEach((layer, i) => {
      const tileLayer = L.tileLayer(layer.tileUrl, {
        opacity: layer.opacity || 1,
        crossOrigin: 'anonymous'
      });
      tileLayer.addTo(map);
      overlays[layer.name] = tileLayer;
    });
    
    // Controls
    L.control.layers(basemaps, overlays, { collapsed: false }).addTo(map);
    L.control.scale().addTo(map);
    
    // Info panel
    const info = L.control({ position: 'topright' });
    info.onAdd = function() {
      const div = L.DomUtil.create('div', 'info');
      div.innerHTML = '<h4>${session.title}</h4>' +
        '<div>Region: ${session.region}</div>' +
        '<div>Layers: ' + layers.length + '</div>' +
        '<div>Zoom: <span id="zoom">${zoom}</span></div>';
      return div;
    };
    info.addTo(map);
    
    map.on('zoomend', () => {
      document.getElementById('zoom').textContent = map.getZoom();
    });
  </script>
</body>
</html>`;
}

function ensureServerRunning(): string {
  if (mapServer) {
    return `http://localhost:${serverPort}`;
  }
  
  mapServer = http.createServer((req, res) => {
    const url = new URL(req.url || '/', `http://localhost:${serverPort}`);
    const path = url.pathname;
    
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET');
    
    // Root - list maps
    if (path === '/' || path === '') {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      let html = '<html><head><title>Axion Maps</title></head><body style="font-family:sans-serif;padding:20px;">';
      html += '<h1>🗺️ Axion Map Server</h1><h2>Active Maps:</h2><ul>';
      
      for (const [id, session] of Object.entries(activeMaps)) {
        html += `<li><a href="/map/${id}">${session.title}</a> - ${session.layers.length} layer(s)</li>`;
      }
      
      if (Object.keys(activeMaps).length === 0) {
        html += '<li><em>No active maps</em></li>';
      }
      
      html += '</ul></body></html>';
      res.end(html);
      return;
    }
    
    // Map viewer
    if (path.startsWith('/map/')) {
      const mapId = path.slice(5);
      const session = activeMaps[mapId];
      
      if (session) {
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(getMapHtml(session));
      } else {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<h1>Map not found</h1><p><a href="/">Back to list</a></p>');
      }
      return;
    }
    
    // API - session data
    if (path.startsWith('/api/session/')) {
      const mapId = path.slice(13);
      const session = activeMaps[mapId];
      res.writeHead(session ? 200 : 404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(session || { error: 'not found' }));
      return;
    }
    
    res.writeHead(404);
    res.end();
  });
  
  mapServer.listen(serverPort, 'localhost', () => {
    console.error(`[MapServer] Started at http://localhost:${serverPort}`);
  });
  
  mapServer.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      serverPort++;
      mapServer = null;
      ensureServerRunning();
    }
  });
  
  return `http://localhost:${serverPort}`;
}

// ============================================================================
// COLLECTION MAPPING
// ============================================================================

const COLLECTION_MAP: Record<string, string> = {
  'COPERNICUS/S2_SR_HARMONIZED': 'sentinel-2-l2a',
  'COPERNICUS/S2_SR': 'sentinel-2-l2a',
  'sentinel-2': 'sentinel-2-l2a',
  's2': 'sentinel-2-l2a',
  'LANDSAT/LC09/C02/T1_L2': 'landsat-c2-l2',
  'LANDSAT/LC08/C02/T1_L2': 'landsat-c2-l2',
  'landsat': 'landsat-c2-l2',
  'l8': 'landsat-c2-l2',
  'l9': 'landsat-c2-l2',
  'sentinel-1': 'sentinel-1-grd',
  's1': 'sentinel-1-grd',
  'naip': 'naip'
};

function resolveCollection(id: string): string {
  return COLLECTION_MAP[id.toLowerCase()] || COLLECTION_MAP[id] || id;
}

// ============================================================================
// TILE URL GENERATION
// ============================================================================

function buildTileUrl(item: STACItem, options: {
  assets?: string[];
  expression?: string;
  rescale?: string;
  colormap?: string;
  indexType?: string;
}): string | null {
  const titiler = process.env.TITILER_ENDPOINT || 'https://titiler.xyz';
  
  // If indexType is specified, use TiTiler STAC endpoint for computed indices
  if (options.indexType && INDEX_CONFIGS[options.indexType]) {
    const config = INDEX_CONFIGS[options.indexType];
    const itemLinks = (item as any).links as Array<{rel: string; href: string}> | undefined;
    const itemUrl = itemLinks?.find((l: {rel: string; href: string}) => l.rel === 'self')?.href;
    
    if (itemUrl) {
      // Build STAC tile URL with expression using asset names
      let tileUrl = `${titiler}/stac/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${encodeURIComponent(itemUrl)}`;
      
      // Add assets
      for (const asset of config.assets) {
        tileUrl += `&assets=${asset}`;
      }
      
      // CRITICAL: asset_as_band=True allows expressions to use asset names (nir, red, etc.)
      tileUrl += `&asset_as_band=True`;
      
      // Add expression if computing an index
      if (config.expression) {
        tileUrl += `&expression=${encodeURIComponent(config.expression)}`;
        tileUrl += `&rescale=${config.rescale}`;
        if (config.colormap) tileUrl += `&colormap_name=${config.colormap}`;
      } else {
        // RGB composite
        tileUrl += `&rescale=${config.rescale}`;
      }
      
      return tileUrl;
    }
    
    // Fallback to visual asset if STAC URL not available
    const visualUrl = item.assets?.visual?.href;
    if (visualUrl) {
      return `${titiler}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${encodeURIComponent(visualUrl)}`;
    }
  }
  
  // Get asset URL - prefer visual/TCI, fallback to COG assets
  let cogUrl: string | null = null;
  let useVisual = false;
  
  // Check for visual/TCI asset first (pre-rendered RGB)
  if (item.assets?.visual?.href) {
    cogUrl = item.assets.visual.href;
    useVisual = true;
  } else if (item.assets?.TCI?.href) {
    cogUrl = item.assets.TCI.href;
    useVisual = true;
  } else if (item.assets?.['visual-10m']?.href) {
    cogUrl = item.assets['visual-10m'].href;
    useVisual = true;
  }
  
  // Fallback to specified assets or first available
  if (!cogUrl && options.assets && options.assets.length > 0) {
    const assetKey = options.assets[0];
    cogUrl = item.assets?.[assetKey]?.href || null;
  }
  
  // Last resort: first asset
  if (!cogUrl && item.assets) {
    const assetKeys = Object.keys(item.assets);
    for (const key of assetKeys) {
      const href = item.assets[key]?.href;
      if (href && (href.endsWith('.tif') || href.endsWith('.tiff') || href.includes('cog'))) {
        cogUrl = href;
        break;
      }
    }
  }
  
  if (!cogUrl) return null;
  
  // Build TiTiler URL
  let tileUrl: string;
  
  if (options.expression) {
    // Band math
    tileUrl = `${titiler}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${encodeURIComponent(cogUrl)}&expression=${encodeURIComponent(options.expression)}`;
    if (options.rescale) tileUrl += `&rescale=${options.rescale}`;
    if (options.colormap) tileUrl += `&colormap_name=${options.colormap}`;
  } else if (useVisual) {
    // Visual asset is already RGB
    tileUrl = `${titiler}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${encodeURIComponent(cogUrl)}&rescale=0,255`;
  } else {
    // Single band or needs rescaling
    tileUrl = `${titiler}/cog/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${encodeURIComponent(cogUrl)}`;
    if (options.rescale) tileUrl += `&rescale=${options.rescale}`;
    else tileUrl += `&rescale=0,3000`; // Safe default for most data
  }
  
  return tileUrl;
}

// ============================================================================
// SCHEMA
// ============================================================================

// Index configurations for COMPUTED indices using TiTiler STAC endpoint
// Expression format uses asset names: (nir-red)/(nir+red)
const INDEX_CONFIGS: Record<string, { 
  assets: string[];    // Assets to load
  expression: string;  // Expression using asset names (e.g., nir, red)
  rescale: string;     // Rescale values
  colormap: string;    // Colormap name
  description: string;
}> = {
  ndvi: {
    assets: ['nir', 'red'],
    expression: '(nir-red)/(nir+red)',
    rescale: '-1,1',
    colormap: 'rdylgn',
    description: 'Vegetation Index (-1 to 1)'
  },
  evi: {
    assets: ['nir', 'red', 'blue'],
    expression: '2.5*(nir-red)/(nir+6*red-7.5*blue+10000)',
    rescale: '-1,1',
    colormap: 'viridis',
    description: 'Enhanced Vegetation Index'
  },
  ndwi: {
    assets: ['green', 'nir'],
    expression: '(green-nir)/(green+nir)',
    rescale: '-1,1',
    colormap: 'blues',
    description: 'Water Index'
  },
  mndwi: {
    assets: ['green', 'swir16'],
    expression: '(green-swir16)/(green+swir16)',
    rescale: '-1,1',
    colormap: 'blues',
    description: 'Modified Water Index'
  },
  ndbi: {
    assets: ['swir16', 'nir'],
    expression: '(swir16-nir)/(swir16+nir)',
    rescale: '-1,1',
    colormap: 'reds',
    description: 'Built-up Index'
  },
  savi: {
    assets: ['nir', 'red'],
    expression: '1.5*(nir-red)/(nir+red+5000)',
    rescale: '-1,1',
    colormap: 'ylgn',
    description: 'Soil-Adjusted Vegetation Index'
  },
  nbr: {
    assets: ['nir', 'swir22'],
    expression: '(nir-swir22)/(nir+swir22)',
    rescale: '-1,1',
    colormap: 'rdylgn',
    description: 'Burn Ratio'
  },
  ndsi: {
    assets: ['green', 'swir16'],
    expression: '(green-swir16)/(green+swir16)',
    rescale: '-1,1',
    colormap: 'blues',
    description: 'Snow Index'
  },
  fcc: {
    assets: ['nir', 'red', 'green'],
    expression: '',
    rescale: '0,5000',
    colormap: '',
    description: 'False Color Composite'
  },
  truecolor: {
    assets: ['red', 'green', 'blue'],
    expression: '',
    rescale: '0,3000',
    colormap: '',
    description: 'True Color (RGB)'
  },
  imagery: {
    assets: ['visual'],
    expression: '',
    rescale: '0,255',
    colormap: '',
    description: 'Satellite Imagery'
  }
};

const MapToolSchema = z.object({
  operation: z.enum(['view', 'layer', 'add', 'layers', 'create', 'list', 'delete', 'help']),
  
  // Create/View params
  region: z.string().optional().describe('Region name or bbox (west,south,east,north)'),
  bbox: z.union([z.string(), z.array(z.number())]).optional().describe('Bounding box: "west,south,east,north" or [w,s,e,n]'),
  collectionId: z.string().optional().describe('STAC collection: sentinel-2-l2a, landsat-c2-l2, etc.'),
  startDate: z.string().optional().describe('Start date: YYYY-MM-DD'),
  endDate: z.string().optional().describe('End date: YYYY-MM-DD'),
  cloudCoverMax: z.number().optional().describe('Max cloud cover % (0-100)'),
  
  // Layer params - add indices as layers
  layers: z.array(z.string()).optional()
    .describe('Layers to add: index names (ndvi, ndwi), layer IDs, or "all" for registered layers'),
  
  // Visualization
  assets: z.array(z.string()).optional().describe('Asset names to use for tiles'),
  expression: z.string().optional().describe('Band math expression'),
  rescale: z.string().optional().describe('Rescale range: "min,max"'),
  colormap: z.string().optional().describe('Colormap name for single-band'),
  
  // Map options
  center: z.array(z.number()).optional().describe('[longitude, latitude]'),
  zoom: z.number().optional().describe('Initial zoom level'),
  basemap: z.enum(['Satellite', 'OpenStreetMap', 'Terrain', 'Dark']).optional(),
  title: z.string().optional().describe('Map title'),
  
  // Layer operation params
  mapId: z.string().optional().describe('Map ID for layer/delete operations'),
  layerName: z.string().optional().describe('Custom layer name'),
  index: z.string().optional().describe('Index type to add: ndvi, ndwi, ndbi, etc.'),
  layerId: z.string().optional().describe('ID of registered layer to add'),
  tileUrl: z.string().optional().describe('Custom tile URL to add as layer'),
  opacity: z.number().optional().describe('Layer opacity 0-1')
});

// ============================================================================
// OPERATIONS
// ============================================================================

/**
 * View/create map with multiple index layers
 */
async function viewMap(params: any) {
  const {
    region = 'Unknown',
    bbox,
    collectionId = 'sentinel-2-l2a',
    startDate,
    endDate,
    cloudCoverMax = 20,
    layers: requestedLayers = ['imagery'],
    assets,
    expression,
    rescale,
    colormap,
    center,
    zoom = 11,
    basemap = 'Satellite',
    title
  } = params;
  
  // Parse bbox
  let effectiveBbox = parseBbox(bbox);
  
  // If no bbox, try to get from region name
  if (!effectiveBbox && region && region !== 'Unknown') {
    const regionBboxMap: Record<string, [number, number, number, number]> = {
      'california': [-124.48, 32.53, -114.13, 42.01],
      'texas': [-106.65, 25.84, -93.51, 36.50],
      'iowa': [-96.64, 40.37, -90.14, 43.50],
      'new york': [-74.26, 40.49, -73.70, 40.92],
      'florida': [-87.63, 24.52, -80.03, 31.00],
      'los angeles': [-118.67, 33.70, -117.65, 34.34],
      'san francisco': [-122.52, 37.71, -122.35, 37.83],
      'seattle': [-122.46, 47.49, -122.22, 47.73],
      'chicago': [-87.94, 41.64, -87.52, 42.02],
      'houston': [-95.79, 29.52, -95.01, 30.11],
      'denver': [-105.11, 39.61, -104.60, 39.91],
      'phoenix': [-112.32, 33.29, -111.93, 33.70],
      'usa': [-125.0, 24.0, -66.0, 50.0],
      'europe': [-10.0, 35.0, 40.0, 71.0],
      'amazon': [-73.0, -10.0, -50.0, 5.0],
      'sahara': [-10.0, 15.0, 35.0, 35.0]
    };
    
    const normalized = region.toLowerCase().trim();
    effectiveBbox = regionBboxMap[normalized];
    
    if (!effectiveBbox) {
      console.error(`[Map] Region "${region}" not in cache, trying geocode...`);
      const geocoded = await geocodePlace(region);
      if (geocoded) effectiveBbox = geocoded;
    }
  }
  
  if (!effectiveBbox) {
    return {
      success: false,
      operation: 'view',
      error: 'Could not find location',
      message: `Could not find "${region}". Try a different place name or provide bbox="west,south,east,north"`,
      hint: 'Examples: "Tokyo, Japan", "Paris, France", "Mumbai, India"'
    };
  }
  
  const collection = resolveCollection(collectionId);
  const datetime = formatDatetime(startDate, endDate);
  
  try {
    // Search STAC for imagery
    const items = await stac.searchItems({
      collections: [collection],
      bbox: effectiveBbox,
      datetime,
      limit: 1,
      query: cloudCoverMax ? { 'eo:cloud_cover': { lt: cloudCoverMax } } : undefined
    });
    
    if (items.length === 0) {
      return {
        success: false,
        operation: 'view',
        error: 'No imagery found',
        message: `No ${collection} imagery found for the specified area and date range`,
        suggestion: 'Try expanding the date range or increasing cloudCoverMax'
      };
    }
    
    const sourceItem = items[0];
    const itemDate = sourceItem.properties?.datetime?.split('T')[0] || 'unknown';
    const cloudCover = sourceItem.properties?.['eo:cloud_cover'];
    
    // Build layers based on requested indices
    const mapLayers: MapLayer[] = [];
    
    for (const layerType of requestedLayers) {
      if (layerType === 'imagery') {
        // Base imagery layer
        const tileUrl = buildTileUrl(sourceItem, { assets, expression, rescale, colormap });
        if (tileUrl) {
          mapLayers.push({
            name: `Imagery - ${itemDate}${cloudCover !== undefined ? ` (${cloudCover.toFixed(0)}% cloud)` : ''}`,
            tileUrl,
            opacity: 1.0
          });
        }
      } else if (INDEX_CONFIGS[layerType]) {
        // Index layer (NDVI, NDWI, etc.)
        const config = INDEX_CONFIGS[layerType];
        const tileUrl = buildTileUrl(sourceItem, { indexType: layerType });
        if (tileUrl) {
          mapLayers.push({
            name: `${layerType.toUpperCase()} - ${config.description}`,
            tileUrl,
            opacity: 0.85
          });
        }
      }
    }
    
    if (mapLayers.length === 0) {
      return {
        success: false,
        operation: 'view',
        error: 'Could not generate tile URLs',
        message: 'Found imagery but could not create tile URLs.'
      };
    }
    
    // Calculate map center
    const mapCenter: [number, number] = center || [
      (effectiveBbox[0] + effectiveBbox[2]) / 2,
      (effectiveBbox[1] + effectiveBbox[3]) / 2
    ];
    
    // Create NEW session with unique timestamp
    const timestamp = Date.now();
    const mapId = `map_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    const layerNames = requestedLayers.map((l: string) => l.toUpperCase()).join(', ');
    const mapTitle = title || `${region} - ${layerNames}`;
    
    const session: MapSession = {
      id: mapId,
      title: mapTitle,
      created: new Date(),
      region,
      layers: mapLayers,
      metadata: {
        center: mapCenter,
        zoom,
        basemap
      }
    };
    
    activeMaps[mapId] = session;
    
    // Store map HTML in centralized map store (works in Docker/Render)
    const mapHtml = getMapHtml(session);
    const mapUrl = storeMap(mapId, mapHtml);
    
    return {
      success: true,
      operation: 'view',
      mapId,
      url: mapUrl,
      title: mapTitle,
      region,
      sourceImage: {
        id: sourceItem.id,
        date: itemDate,
        cloudCover: cloudCover?.toFixed(1) + '%'
      },
      layers: mapLayers.map(l => ({ name: l.name })),
      layerCount: mapLayers.length,
      center: mapCenter,
      zoom,
      basemap,
      availableIndices: Object.keys(INDEX_CONFIGS),
      message: `Map created with ${mapLayers.length} layer(s)! Open: ${mapUrl}`,
      instructions: [
        'Click the URL to open the interactive map',
        'Use layer control (top right) to toggle layers',
        'Each index layer can be turned on/off independently'
      ]
    };
    
  } catch (error: any) {
    return {
      success: false,
      operation: 'view',
      error: error.message || 'Unknown error',
      message: 'Failed to create map'
    };
  }
}

/**
 * Add ANY layer to existing map - from registry, index, or custom URL
 */
async function addLayer(params: any) {
  const {
    mapId,
    index,
    layerId,
    tileUrl: customTileUrl,
    layerName,
    opacity = 0.85,
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 20
  } = params;
  
  // If no mapId, create a new map first
  let session: MapSession;
  let targetMapId = mapId;
  
  if (!mapId) {
    // Show available maps and registered layers
    return {
      success: false,
      operation: 'layer',
      error: 'mapId required (or use "add" to create new map with layers)',
      activeMaps: Object.keys(activeMaps),
      registeredLayers: Object.values(layerRegistry).map(l => ({
        id: l.id,
        name: l.name,
        type: l.type,
        source: l.metadata.source
      })),
      tip: 'Use operation "add" with layerId to create new map with registered layer'
    };
  }
  
  session = activeMaps[mapId];
  if (!session) {
    return {
      success: false,
      operation: 'layer',
      error: 'Map not found',
      mapId,
      activeMaps: Object.keys(activeMaps)
    };
  }
  
  let newLayer: MapLayer | null = null;
  
  // Option 1: Add from layer registry (from axion_process, axion_classification, etc.)
  if (layerId) {
    const registeredLayer = layerRegistry[layerId];
    if (!registeredLayer) {
      return {
        success: false,
        operation: 'layer',
        error: `Layer not found: ${layerId}`,
        availableLayers: Object.keys(layerRegistry)
      };
    }
    newLayer = {
      name: layerName || registeredLayer.name,
      tileUrl: registeredLayer.tileUrl,
      opacity
    };
  }
  // Option 2: Add custom tile URL directly
  else if (customTileUrl) {
    newLayer = {
      name: layerName || 'Custom Layer',
      tileUrl: customTileUrl,
      opacity
    };
  }
  // Option 3: Add predefined index (NDVI, NDWI, etc.)
  else if (index) {
    if (!INDEX_CONFIGS[index]) {
      return {
        success: false,
        operation: 'layer',
        error: 'Unknown index',
        availableIndices: Object.keys(INDEX_CONFIGS)
      };
    }
    
    const collection = resolveCollection(collectionId);
    const effectiveBbox = parseBbox(bbox) || [
      session.metadata.center[0] - 0.5,
      session.metadata.center[1] - 0.5,
      session.metadata.center[0] + 0.5,
      session.metadata.center[1] + 0.5
    ];
    
    try {
      const datetime = formatDatetime(startDate, endDate);
      const items = await stac.searchItems({
        collections: [collection],
        bbox: effectiveBbox,
        datetime,
        limit: 1,
        query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
      });
      
      if (items.length === 0) {
        return { success: false, operation: 'layer', error: 'No imagery found for index layer' };
      }
      
      const config = INDEX_CONFIGS[index];
      const tileUrl = buildTileUrl(items[0], { indexType: index });
      
      if (!tileUrl) {
        return { success: false, operation: 'layer', error: 'Could not generate tile URL' };
      }
      
      newLayer = {
        name: layerName || `${index.toUpperCase()} - ${config.description}`,
        tileUrl,
        opacity
      };
    } catch (error: any) {
      return { success: false, operation: 'layer', error: error.message };
    }
  }
  else {
    return {
      success: false,
      operation: 'layer',
      error: 'Specify layerId, tileUrl, or index',
      options: {
        layerId: 'ID from layer registry (from axion_process, axion_classification)',
        tileUrl: 'Custom tile URL template',
        index: 'Predefined index: ' + Object.keys(INDEX_CONFIGS).join(', ')
      },
      registeredLayers: Object.values(layerRegistry).map(l => ({ id: l.id, name: l.name }))
    };
  }
  
  if (newLayer) {
    session.layers.push(newLayer);
    
    // Re-store updated map HTML in centralized store
    const mapHtml = getMapHtml(session);
    const mapUrl = storeMap(targetMapId, mapHtml);
    
    return {
      success: true,
      operation: 'layer',
      mapId: targetMapId,
      layerAdded: newLayer.name,
      totalLayers: session.layers.length,
      allLayers: session.layers.map(l => l.name),
      url: mapUrl,
      message: `Added layer "${newLayer.name}". Refresh map: ${mapUrl}`
    };
  }
  
  return { success: false, operation: 'layer', error: 'Could not create layer' };
}

/**
 * List all registered analysis layers available to add to maps
 */
function listRegisteredLayers() {
  const layers = Object.values(layerRegistry);
  
  return {
    success: true,
    operation: 'layers',
    count: layers.length,
    layers: layers.map(l => ({
      id: l.id,
      name: l.name,
      type: l.type,
      source: l.metadata.source,
      description: l.metadata.description,
      created: l.created.toISOString(),
      hasPreview: !!l.previewUrl
    })),
    usage: {
      addToMap: { operation: 'layer', mapId: 'map_xxx', layerId: 'layer_xxx' },
      createMapWithLayers: { operation: 'add', layerId: 'layer_xxx', region: 'San Francisco' }
    },
    message: `${layers.length} analysis layer(s) available to add to maps`
  };
}

/**
 * Create new map with registered layer(s)
 */
async function addLayerToNewMap(params: any) {
  const {
    layerId,
    layers: layerIds,
    region,
    bbox,
    zoom = 11,
    basemap = 'Satellite',
    title
  } = params;
  
  const targetLayerIds = layerIds || (layerId ? [layerId] : []);
  
  if (targetLayerIds.length === 0 && targetLayerIds[0] !== 'all') {
    return {
      success: false,
      operation: 'add',
      error: 'layerId or layers required',
      registeredLayers: Object.values(layerRegistry).map(l => ({ id: l.id, name: l.name, type: l.type })),
      example: { operation: 'add', layerId: 'layer_xxx', region: 'San Francisco' }
    };
  }
  
  // Get layers to add
  const layersToAdd: RegisteredLayer[] = [];
  
  if (targetLayerIds[0] === 'all') {
    layersToAdd.push(...Object.values(layerRegistry));
  } else {
    for (const id of targetLayerIds) {
      const layer = layerRegistry[id];
      if (layer) layersToAdd.push(layer);
    }
  }
  
  if (layersToAdd.length === 0) {
    return {
      success: false,
      operation: 'add',
      error: 'No valid layers found',
      registeredLayers: Object.keys(layerRegistry)
    };
  }
  
  // Determine bbox from layers or params
  let effectiveBbox = parseBbox(bbox);
  if (!effectiveBbox && layersToAdd[0].metadata.bbox) {
    effectiveBbox = layersToAdd[0].metadata.bbox as [number, number, number, number];
  }
  
  // Geocode region if needed
  if (!effectiveBbox && region) {
    const geocoded = await geocodePlace(region);
    if (geocoded) effectiveBbox = geocoded;
  }
  
  if (!effectiveBbox) {
    effectiveBbox = [-122.5, 37.5, -122.0, 38.0]; // Default to SF area
  }
  
  const mapCenter: [number, number] = [
    (effectiveBbox[0] + effectiveBbox[2]) / 2,
    (effectiveBbox[1] + effectiveBbox[3]) / 2
  ];
  
  // Create map layers
  const mapLayers: MapLayer[] = layersToAdd.map(l => ({
    name: l.name,
    tileUrl: l.tileUrl,
    opacity: 0.85
  }));
  
  // Create session
  const timestamp = Date.now();
  const mapId = `map_${timestamp}_${Math.random().toString(36).slice(2, 6)}`;
  const mapTitle = title || `Analysis Map - ${layersToAdd.map(l => l.name).join(', ')}`;
  
  const session: MapSession = {
    id: mapId,
    title: mapTitle,
    created: new Date(),
    region: region || 'Analysis Results',
    layers: mapLayers,
    metadata: {
      center: mapCenter,
      zoom,
      basemap
    }
  };
  
  activeMaps[mapId] = session;
  
  // Store in centralized map store (works in Docker/Render)
  const mapHtml = getMapHtml(session);
  const mapUrl = storeMap(mapId, mapHtml);
  
  return {
    success: true,
    operation: 'add',
    mapId,
    url: mapUrl,
    title: mapTitle,
    layers: mapLayers.map(l => l.name),
    layerCount: mapLayers.length,
    center: mapCenter,
    zoom,
    message: `Map created with ${mapLayers.length} analysis layer(s)! Open: ${mapUrl}`
  };
}

/**
 * Create a new interactive map (legacy - wraps viewMap)
 */
async function createMap(params: any) {
  // Map create to view for backwards compatibility
  return viewMap({ ...params, layers: ['imagery'] });
}

/**
 * List active maps
 */
function listMaps() {
  const baseUrl = getMapBaseUrl();
  
  const maps = Object.values(activeMaps).map(session => ({
    mapId: session.id,
    title: session.title,
    url: `${baseUrl}/map/${session.id}`,
    region: session.region,
    layers: session.layers.length,
    created: session.created.toISOString()
  }));
  
  return {
    success: true,
    operation: 'list',
    count: maps.length,
    maps,
    serverUrl: baseUrl,
    message: `${maps.length} active map(s)`
  };
}

/**
 * Delete a map
 */
function deleteMap(params: any) {
  const { mapId } = params;
  
  if (!mapId) {
    return {
      success: false,
      operation: 'delete',
      error: 'mapId required',
      message: 'Please provide the map ID to delete'
    };
  }
  
  if (activeMaps[mapId]) {
    delete activeMaps[mapId];
    return {
      success: true,
      operation: 'delete',
      mapId,
      message: `Map '${mapId}' deleted`
    };
  } else {
    return {
      success: false,
      operation: 'delete',
      mapId,
      error: 'Map not found',
      message: `No active map with ID: ${mapId}`
    };
  }
}

/**
 * Help operation
 */
function showHelp() {
  return {
    success: true,
    operation: 'help',
    tool: 'axion_map',
    description: 'Interactive maps with ANY analysis results - like ArcGIS layer stacking',
    operations: {
      view: {
        description: 'Create map with multiple index layers',
        params: { region: 'Place name', layers: '["ndvi", "ndwi", "imagery"]' },
        example: { operation: 'view', region: 'San Francisco', layers: ['ndvi', 'ndwi', 'ndbi'] }
      },
      layer: {
        description: 'Add ANY layer to existing map (from registry, index, or custom URL)',
        params: {
          mapId: 'Map to add layer to',
          layerId: 'ID from layer registry (analysis results)',
          index: 'Predefined index (ndvi, ndwi, etc.)',
          tileUrl: 'Custom tile URL'
        },
        example: { operation: 'layer', mapId: 'map_xxx', layerId: 'layer_xxx' }
      },
      add: {
        description: 'Create NEW map with registered analysis layer(s)',
        params: { layerId: 'Layer ID or "all"', region: 'Region name' },
        example: { operation: 'add', layerId: 'layer_xxx', region: 'San Francisco' }
      },
      layers: {
        description: 'List all registered analysis layers (from axion_process, axion_classification)',
        example: { operation: 'layers' }
      },
      list: { description: 'List active maps' },
      delete: { description: 'Delete a map', params: { mapId: 'Map ID' } }
    },
    workflow: {
      step1: 'Run analysis: axion_process → ndvi, classification, model, etc.',
      step2: 'Layers auto-register with IDs',
      step3: 'View layers: axion_map operation="layers"',
      step4: 'Add to map: axion_map operation="layer" mapId="..." layerId="..."',
      step5: 'Or create new map: axion_map operation="add" layerId="..."'
    },
    registeredLayers: Object.values(layerRegistry).map(l => ({ id: l.id, name: l.name, type: l.type })),
    availableIndices: Object.keys(INDEX_CONFIGS),
    tip: 'Any analysis tool can register layers. Use operation="layers" to see available.'
  };
}

// ============================================================================
// REGISTER TOOL
// ============================================================================

register({
  name: 'axion_map',
  description: `Interactive Map with multi-layer support. Operations: view (create map with NDVI/NDWI/NDBI/etc layers stacked), layer (add index to existing map), create, list, delete, help. Stack multiple indices on ONE map!`,
  input: MapToolSchema,
  output: z.any(),
  handler: async (params) => {
    try {
      const { operation } = params;
      
      if (!operation) {
        return {
          success: false,
          error: 'operation parameter required',
          availableOperations: ['view', 'layer', 'create', 'list', 'delete', 'help'],
          example: { operation: 'view', region: 'San Francisco', layers: ['ndvi', 'ndwi', 'ndbi'] },
          tip: 'Use "view" with layers array to stack multiple indices on one map'
        };
      }
      
      // Normalize params
      const normalizedParams = {
        ...params,
        collectionId: params.collectionId || params.collection_id || params.datasetId || params.dataset_id,
        startDate: params.startDate || params.start_date,
        endDate: params.endDate || params.end_date,
        cloudCoverMax: params.cloudCoverMax ?? params.cloud_cover_max ?? 20,
        mapId: params.mapId || params.map_id,
        layerName: params.layerName || params.layer_name
      };
      
      switch (operation) {
        case 'view':
          return await viewMap(normalizedParams);
        case 'layer':
          return await addLayer(normalizedParams);
        case 'add':
          return await addLayerToNewMap(normalizedParams);
        case 'layers':
          return listRegisteredLayers();
        case 'create':
          return await createMap(normalizedParams);
        case 'list':
          return listMaps();
        case 'delete':
          return deleteMap(normalizedParams);
        case 'help':
          return showHelp();
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`,
            availableOperations: ['view', 'layer', 'add', 'layers', 'create', 'list', 'delete', 'help']
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
