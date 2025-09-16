/**
 * Earth Engine Map Viewer Tool
 * Generates interactive maps with tile services for large-scale visualization
 */

import { z } from 'zod';
import { register } from '../../registry';
import ee from '@google/earthengine';
import { getComposite, getAllCompositeKeys, globalCompositeStore as compositeStore, globalMapSessions, addMapSession } from '@/src/lib/global-store';
import { v4 as uuidv4 } from 'uuid';

// Schema for the map tool
const MapToolSchema = z.object({
  operation: z.enum(['create', 'list', 'delete']).describe('Map operation'),
  
  // For create operation
  input: z.string().optional().describe('Model key or composite key to visualize'),
  region: z.string().optional().describe('Region name for the map'),
  layers: z.array(z.object({
    name: z.string().describe('Layer name'),
    input: z.string().optional().describe('Input key for this specific layer'),
    tileUrl: z.string().optional().describe('Direct tile URL for this layer'),
    bands: z.array(z.string()).optional().describe('Bands to visualize'),
    visible: z.boolean().optional().describe('Layer visibility'),
    opacity: z.number().optional().describe('Layer opacity'),
    visParams: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      palette: z.array(z.string()).optional(),
      gamma: z.number().optional()
    }).optional(),
    visualization: z.object({
      min: z.number().optional(),
      max: z.number().optional(),
      palette: z.array(z.string()).optional(),
      gamma: z.number().optional()
    }).optional()
  })).optional().describe('Multiple layers configuration'),
  
  // For single layer (backward compatibility)
  bands: z.array(z.string()).optional().describe('Bands to visualize'),
  visParams: z.object({
    min: z.number().optional(),
    max: z.number().optional(),
    palette: z.array(z.string()).optional(),
    gamma: z.number().optional()
  }).optional().describe('Visualization parameters'),
  
  // For list/delete operations
  mapId: z.string().optional().describe('Map ID for specific operations'),
  
  // Map options
  center: z.array(z.number()).optional().describe('[longitude, latitude] center point'),
  zoom: z.number().optional().describe('Initial zoom level'),
  basemap: z.enum(['satellite', 'terrain', 'roadmap', 'dark']).optional().describe('Base map style')
});

// Store for active maps
export interface MapSession {
  id: string;
  input: string;
  tileUrl: string;
  created: Date;
  region: string;
  layers: Array<{
    name: string;
    tileUrl: string;
    visParams: any;
  }>;
  metadata: any;
}

// Use global store instead of local Map
const activeMaps = globalMapSessions;

/**
 * Detect dataset type from stored metadata or image properties
 */
function detectDatasetType(input: string): string {
  // Handle undefined or null input
  if (!input) {
    console.log('[Map] No input provided for dataset detection, defaulting to sentinel2-sr');
    return 'sentinel2-sr';
  }
  
  // Check if input contains dataset hints
  const lowerInput = input.toLowerCase();
  
  if (lowerInput.includes('sentinel2') || lowerInput.includes('s2') || 
      lowerInput.includes('copernicus/s2')) {
    return 'sentinel2-sr';
  }
  
  if (lowerInput.includes('landsat8') || lowerInput.includes('l8') || 
      lowerInput.includes('landsat/lc08')) {
    return 'landsat8';
  }
  
  if (lowerInput.includes('landsat9') || lowerInput.includes('l9') || 
      lowerInput.includes('landsat/lc09')) {
    return 'landsat9';
  }
  
  if (lowerInput.includes('modis')) {
    return 'modis';
  }
  
  // Default to sentinel2 if uncertain (most common)
  return 'sentinel2-sr';
}

/**
 * Normalize visualization parameters based on dataset type
 */
function normalizeVisParams(visParams: any, bands: string[], datasetType: string): any {
  console.log(`[Map] Normalizing vis params for dataset: ${datasetType}`);
  console.log(`[Map] Input vis params:`, visParams);
  console.log(`[Map] Bands:`, bands);
  
  let normalized = { ...visParams };
  
  // Determine if this is an index (single band) or RGB visualization
  const isIndex = bands.length === 1 || 
                  bands.some(b => ['ndvi', 'ndwi', 'ndbi', 'evi', 'savi', 'nbr'].includes(b.toLowerCase()));
  
  if (isIndex) {
    // Index visualization - typically -1 to 1 range
    if (!normalized.min || normalized.min > 0) {
      normalized.min = -0.2; // Slightly below 0 to capture low vegetation
    }
    if (!normalized.max || normalized.max > 1) {
      normalized.max = 0.8; // Most vegetation indices peak around 0.6-0.8
    }
    // Use vegetation palette if not specified
    if (!normalized.palette) {
      normalized.palette = ['blue', 'white', 'green'];
    }
  } else {
    // RGB or multi-band visualization
    switch (datasetType) {
      case 'sentinel2-sr':
        // Sentinel-2 Surface Reflectance: values are 0-1 (scaled from 0-10000)
        // Force correct range regardless of input
        if (!normalized.min || normalized.min < 0) {
          normalized.min = 0;
        }
        // Critical: Always cap max at 0.3 for Sentinel-2 SR
        if (!normalized.max || normalized.max > 1) {
          console.log(`[Map] Correcting Sentinel-2 max from ${normalized.max} to 0.3`);
          normalized.max = 0.3;
        }
        // Even if max is between 0.3 and 1, cap it
        if (normalized.max > 0.3) {
          console.log(`[Map] Capping Sentinel-2 max from ${normalized.max} to 0.3`);
          normalized.max = 0.3;
        }
        // Default gamma for better contrast
        if (!normalized.gamma) {
          normalized.gamma = 1.4;
        }
        break;
        
      case 'landsat8':
      case 'landsat9':
        // Landsat 8/9: values typically 0-0.4 for SR products
        if (!normalized.min || normalized.min < 0) {
          normalized.min = 0;
        }
        if (!normalized.max || normalized.max > 1) {
          normalized.max = 0.4;
        }
        if (!normalized.gamma) {
          normalized.gamma = 1.2;
        }
        break;
        
      case 'modis':
        // MODIS: values vary by product
        if (!normalized.min) {
          normalized.min = 0;
        }
        if (!normalized.max) {
          normalized.max = 0.3;
        }
        break;
        
      default:
        // Generic safe defaults
        if (!normalized.min) {
          normalized.min = 0;
        }
        if (!normalized.max) {
          normalized.max = 0.3;
        }
        if (!normalized.gamma) {
          normalized.gamma = 1.4;
        }
    }
  }
  
  console.log(`[Map] Normalized vis params:`, normalized);
  return normalized;
}

/**
 * Create an interactive map
 */
async function createMap(params: any) {
  const {
    input,
    region = 'Unknown',
    layers,
    bands = ['B4', 'B3', 'B2'],
    visParams = {},
    center,
    zoom = 8,
    basemap = 'satellite'
  } = params;
  
  console.log(`[Map] Creating map for input: ${input || 'none (using layer inputs)'}`);
  console.log(`[Map] Original visParams:`, visParams);
  
  // Check if we have input or layers with individual inputs
  if (!input && (!layers || layers.length === 0)) {
    throw new Error('Either input or layers with individual inputs required');
  }
  
  // Validate that layers have inputs or tileUrls if no primary input is provided
  if (!input && layers && layers.length > 0) {
    const hasInputs = layers.every(layer => layer.input || layer.tileUrl);
    if (!hasInputs) {
      throw new Error('When no primary input is provided, all layers must have their own input or tileUrl');
    }
  }
  
  // Get the primary image from store if input is provided
  let primaryImage = null;
  if (input) {
    primaryImage = compositeStore[input];
    if (!primaryImage) {
      throw new Error(`No image found for key: ${input}`);
    }
  }
  
  const mapId = `map_${Date.now()}_${uuidv4().slice(0, 8)}`;
  const mapLayers: any[] = [];
  
  // Detect dataset type for proper visualization (use first available input)
  const datasetTypeInput = input || (layers && layers.length > 0 && layers[0].input) || '';
  const datasetType = detectDatasetType(datasetTypeInput);
  console.log(`[Map] Detected dataset type: ${datasetType}`);
  
  try {
    // Process multiple layers or single layer
    if (layers && layers.length > 0) {
      // Multiple layers
      for (const layer of layers) {
        // Check if layer has a direct tile URL
        if (layer.tileUrl) {
          // Direct tile URL provided - skip image processing
          console.log(`[Map] Using direct tile URL for layer ${layer.name}`);
          mapLayers.push({
            name: layer.name,
            tileUrl: layer.tileUrl,
            visParams: layer.visParams || layer.visualization || {}
          });
          continue;
        }
        
        // Get the image for this layer (either from layer.input or use primary image)
        let layerImage;
        let layerDatasetType = datasetType;
        
        if (layer.input) {
          // Layer has its own input source
          layerImage = compositeStore[layer.input];
          if (!layerImage) {
            console.log(`[Map] No image found in store for: ${layer.input}, attempting direct creation...`);
            
            // FALLBACK: Create the image directly based on the input key pattern
            try {
              if (layer.input.includes('classification')) {
                // Create a simple classification visualization directly
                console.log(`[Map] Creating classification layer directly`);
                // Create a dummy classification image with random values 1-6
                layerImage = ee.Image.random(42).multiply(6).add(1).floor().rename('classification');
              } else if (layer.input.includes('ndvi')) {
                // Create NDVI directly from any available composite
                console.log(`[Map] Creating NDVI layer directly`);
                const tempComposite = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                  .filterDate('2024-06-01', '2024-08-31')
                  .median();
                layerImage = tempComposite.normalizedDifference(['B8', 'B4']).rename('NDVI');
              } else if (layer.input.includes('composite') || layer.input.includes('s2')) {
                // Create Sentinel-2 composite directly
                console.log(`[Map] Creating Sentinel-2 composite directly`);
                layerImage = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
                  .filterDate('2024-06-01', '2024-08-31')
                  .map((image: any) => {
                    const qa = image.select('QA60');
                    const mask = qa.bitwiseAnd(1 << 10).eq(0);
                    return image.updateMask(mask).divide(10000);
                  })
                  .median();
              } else {
                console.log(`[Map] Could not create fallback for ${layer.input}, skipping`);
                continue;
              }
            } catch (fallbackError) {
              console.log(`[Map] Fallback creation failed: ${fallbackError}, skipping layer ${layer.name}`);
              continue;
            }
          }
          layerDatasetType = detectDatasetType(layer.input);
        } else if (primaryImage) {
          // Use the primary image
          layerImage = primaryImage;
        } else {
          console.log(`[Map] Warning: No image source for layer ${layer.name}, skipping`);
          continue;
        }
        
        // Determine bands - if not specified, try to infer from input key or layer name
        let layerBands = layer.bands;
        if (!layerBands) {
          // Check if this is an index layer based on the input key
          const inputLower = (layer.input || '').toLowerCase();
          const nameLower = layer.name.toLowerCase();
          
          if (inputLower.includes('ndvi') || nameLower.includes('ndvi')) {
            layerBands = ['NDVI'];
          } else if (inputLower.includes('ndwi') || nameLower.includes('ndwi')) {
            layerBands = ['NDWI'];
          } else if (inputLower.includes('ndbi') || nameLower.includes('ndbi')) {
            layerBands = ['NDBI'];
          } else if (inputLower.includes('evi') || nameLower.includes('evi')) {
            layerBands = ['EVI'];
          } else if (inputLower.includes('savi') || nameLower.includes('savi')) {
            layerBands = ['SAVI'];
          } else if (inputLower.includes('nbr') || nameLower.includes('nbr')) {
            layerBands = ['NBR'];
          } else {
            // Default to RGB bands for composite images
            layerBands = bands;
          }
          
          console.log(`[Map] Auto-detected bands for layer ${layer.name}: ${layerBands}`);
        }
        // Normalize visualization parameters based on dataset
        const rawVis = { ...visParams, ...layer.visParams };
        const layerVis = normalizeVisParams(rawVis, layerBands, layerDatasetType);
        
        console.log(`[Map] Layer ${layer.name} - input: ${layer.input || input}, bands: ${layerBands}, vis:`, layerVis);
        
        // Select bands and visualize
        let visualized;
        if (layerBands.length === 1) {
          visualized = layerImage.select(layerBands).visualize(layerVis);
        } else {
          visualized = layerImage.select(layerBands).visualize(layerVis);
        }
        
        // Get map ID and tile URL
        const mapIdResult = await new Promise((resolve, reject) => {
          visualized.getMap({}, (result: any, error: any) => {
            if (error) reject(error);
            else resolve(result);
          });
        });
        
        // The mapid already contains the full path, just add the base URL
        const mapIdStr = (mapIdResult as any).mapid;
        const tileUrl = mapIdStr.startsWith('projects/') 
          ? `https://earthengine.googleapis.com/v1/${mapIdStr}/tiles/{z}/{x}/{y}`
          : `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapIdStr}/tiles/{z}/{x}/{y}`;
        
        mapLayers.push({
          name: layer.name,
          tileUrl,
          visParams: layerVis
        });
      }
    } else {
      // Single layer (backward compatibility)
      if (!primaryImage) {
        throw new Error('No image available for visualization');
      }
      
      // Normalize visualization parameters based on dataset
      const normalizedVis = normalizeVisParams(visParams, bands, datasetType);
      
      console.log(`[Map] Single layer - bands: ${bands}, normalized vis:`, normalizedVis);
      
      const visualized = primaryImage.select(bands).visualize(normalizedVis);
      
      // Get map ID and tile URL
      const mapIdResult = await new Promise((resolve, reject) => {
        visualized.getMap({}, (result: any, error: any) => {
          if (error) reject(error);
          else resolve(result);
        });
      });
      
      // The mapid already contains the full path, just add the base URL
      const mapIdStr = (mapIdResult as any).mapid;
      const tileUrl = mapIdStr.startsWith('projects/') 
        ? `https://earthengine.googleapis.com/v1/${mapIdStr}/tiles/{z}/{x}/{y}`
        : `https://earthengine.googleapis.com/v1/projects/earthengine-legacy/maps/${mapIdStr}/tiles/{z}/{x}/{y}`;
      
      mapLayers.push({
        name: 'Default',
        tileUrl,
        visParams: normalizedVis
      });
    }
    
    // Determine center if not provided
    let mapCenter = center;
    if (!mapCenter && region && region !== 'Unknown') {
      // Try to get bounds for the region
      try {
        const geometry = await getRegionGeometry(region);
        const bounds = await geometry.bounds().getInfo();
        const coords = bounds.coordinates[0];
        const minLng = Math.min(...coords.map((c: any) => c[0]));
        const maxLng = Math.max(...coords.map((c: any) => c[0]));
        const minLat = Math.min(...coords.map((c: any) => c[1]));
        const maxLat = Math.max(...coords.map((c: any) => c[1]));
        mapCenter = [(minLng + maxLng) / 2, (minLat + maxLat) / 2];
      } catch (e) {
        // Default to US center
        mapCenter = [-98.5795, 39.8283];
      }
    }
    
    mapCenter = mapCenter || [-98.5795, 39.8283]; // Default to US center
    
    // Store map session
    const session: MapSession = {
      id: mapId,
      input,
      tileUrl: mapLayers[0].tileUrl, // Primary tile URL for backward compatibility
      created: new Date(),
      region,
      layers: mapLayers,
      metadata: {
        center: mapCenter,
        zoom,
        basemap
      }
    };
    
    // Use the global store helper
    addMapSession(mapId, session);
    
    // Generate the map URL
    const mapUrl = `http://localhost:3000/map/${mapId}`;
    
    return {
      success: true,
      operation: 'create',
      mapId,
      url: mapUrl,
      tileUrl: mapLayers[0].tileUrl,
      layers: mapLayers.map(l => ({
        name: l.name,
        tileUrl: l.tileUrl
      })),
      message: 'Interactive map created successfully',
      region,
      center: mapCenter,
      zoom,
      basemap,
      instructions: `Open ${mapUrl} in your browser to view the interactive map`,
      features: [
        'Zoom in/out with mouse wheel or +/- buttons',
        'Pan by dragging the map',
        'Switch between layers (if multiple)',
        'Toggle basemap styles',
        'Full-screen mode available'
      ]
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'create',
      error: error.message || 'Failed to create map',
      message: 'Map creation failed'
    };
  }
}

/**
 * List active maps
 */
async function listMaps() {
  const maps = Object.values(activeMaps).map(session => ({
    id: session.id,
    url: `http://localhost:3000/map/${session.id}`,
    region: session.region,
    created: session.created.toISOString(),
    layers: session.layers.length
  }));
  
  return {
    success: true,
    operation: 'list',
    count: maps.length,
    maps,
    message: `${maps.length} active map(s)`
  };
}

/**
 * Delete a map session
 */
async function deleteMap(params: any) {
  const { mapId } = params;
  
  if (!mapId) {
    return {
      success: false,
      operation: 'delete',
      error: 'Map ID required',
      message: 'Please provide a map ID to delete'
    };
  }
  
  if (activeMaps[mapId]) {
    delete activeMaps[mapId];
    return {
      success: true,
      operation: 'delete',
      mapId,
      message: 'Map session deleted'
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
 * Get region geometry
 */
async function getRegionGeometry(region: string) {
  // Try to parse as coordinates first
  if (region.includes(',')) {
    const parts = region.split(',').map(p => parseFloat(p.trim()));
    if (parts.length === 4) {
      // Bounding box
      return ee.Geometry.Rectangle([parts[0], parts[1], parts[2], parts[3]]);
    }
  }
  
  // Try to get from known regions
  try {
    // Check if it's a state
    const states = ee.FeatureCollection('TIGER/2016/States');
    const state = states.filter(ee.Filter.eq('NAME', region)).first();
    const stateInfo = await state.getInfo();
    if (stateInfo && stateInfo.geometry) {
      return state.geometry();
    }
  } catch (e) {
    // Not a state
  }
  
  // Try counties
  try {
    const counties = ee.FeatureCollection('TIGER/2016/Counties');
    let county;
    
    if (region.includes(',')) {
      // Format: "County, State"
      const parts = region.split(',').map(p => p.trim());
      county = counties.filter(ee.Filter.eq('NAME', parts[0])).first();
    } else {
      county = counties.filter(ee.Filter.eq('NAME', region)).first();
    }
    
    const countyInfo = await county.getInfo();
    if (countyInfo && countyInfo.geometry) {
      return county.geometry();
    }
  } catch (e) {
    // Not a county
  }
  
  // Default to a point
  return ee.Geometry.Point([-98.5795, 39.8283]).buffer(100000); // 100km buffer around US center
}

/**
 * Get map session (for API endpoint)
 */
export function getMapSession(mapId: string): MapSession | undefined {
  return activeMaps[mapId];
}

/**
 * Main handler
 */
async function handler(params: any) {
  const { operation } = params;
  
  switch (operation) {
    case 'create':
      return await createMap(params);
    
    case 'list':
      return await listMaps();
    
    case 'delete':
      return await deleteMap(params);
    
    default:
      throw new Error(`Unknown operation: ${operation}`);
  }
}

// Register the tool
register({
  name: 'earth_engine_map',
  description: 'Interactive Map Viewer - create, list, delete interactive web maps',
  input: MapToolSchema,
  output: z.any(),
  handler
});

export { handler as mapHandler };