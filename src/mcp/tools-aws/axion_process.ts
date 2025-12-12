/**
 * AXION PROCESS - AWS-Native Processing Tool
 * Operations: composite, ndvi, indices, stats, mosaic
 * Uses COG URLs from STAC for processing
 */

import { z } from 'zod';
import { register } from '../registry';
import { STACClient, parseBbox, formatDatetime, STACItem } from '@/src/aws/stac/client';
import { registerLayer } from './axion_map';

const stac = new STACClient();

const ProcessToolSchema = z.object({
  operation: z.enum(['composite', 'ndvi', 'indices', 'stats', 'mosaic', 'fcc', 'model', 'change_detect', 'terrain', 'mask_clouds', 'resample', 'help']),
  
  // Data selection params
  collectionId: z.string().optional(),
  bbox: z.union([z.string(), z.array(z.number())]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  cloudCoverMax: z.number().optional(),
  limit: z.number().optional(),
  
  // Processing params
  reducer: z.enum(['median', 'mean', 'min', 'max', 'mosaic']).optional(),
  indexType: z.enum(['ndvi', 'evi', 'ndwi', 'savi', 'ndbi', 'bsi', 'mndwi', 'ndsi', 'nbr']).optional(),
  bands: z.array(z.string()).optional(),
  
  // Model params
  modelType: z.enum(['wildfire', 'flood', 'agriculture', 'deforestation', 'water_quality']).optional(),
  region: z.string().optional(),
  
  // Change detection params
  beforeStartDate: z.string().optional(),
  beforeEndDate: z.string().optional(),
  afterStartDate: z.string().optional(),
  afterEndDate: z.string().optional(),
  
  // Terrain params
  demCollection: z.string().optional(),
  terrainOutputs: z.array(z.enum(['slope', 'aspect', 'hillshade', 'elevation'])).optional(),
  
  // Resample params
  targetResolution: z.number().optional(),
  resampleMethod: z.enum(['nearest', 'bilinear', 'cubic']).optional(),
  
  // Output params
  scale: z.number().optional(),
  outputFormat: z.enum(['cog', 'png', 'json']).optional()
});

/**
 * Collection to STAC ID mapping
 */
const COLLECTION_MAP: Record<string, string> = {
  'COPERNICUS/S2_SR_HARMONIZED': 'sentinel-2-l2a',
  'COPERNICUS/S2_SR': 'sentinel-2-l2a',
  'sentinel-2': 'sentinel-2-l2a',
  'LANDSAT/LC08/C02/T1_L2': 'landsat-c2-l2',
  'LANDSAT/LC09/C02/T1_L2': 'landsat-c2-l2',
  'landsat': 'landsat-c2-l2'
};

/**
 * Band mapping for different collections
 */
const BAND_MAPPING: Record<string, Record<string, string>> = {
  'sentinel-2-l2a': {
    red: 'B04',
    green: 'B03',
    blue: 'B02',
    nir: 'B08',
    swir1: 'B11',
    swir2: 'B12',
    rededge1: 'B05',
    rededge2: 'B06',
    rededge3: 'B07'
  },
  'landsat-c2-l2': {
    red: 'SR_B4',
    green: 'SR_B3',
    blue: 'SR_B2',
    nir: 'SR_B5',
    swir1: 'SR_B6',
    swir2: 'SR_B7'
  }
};

/**
 * Index formulas
 */
const INDEX_FORMULAS: Record<string, { formula: string; bands: string[]; description: string; interpretation: Record<string, string> }> = {
  ndvi: {
    formula: '(NIR - RED) / (NIR + RED)',
    bands: ['nir', 'red'],
    description: 'Normalized Difference Vegetation Index',
    interpretation: { '-1 to 0': 'Water', '0 to 0.2': 'Bare soil', '0.2 to 0.4': 'Sparse vegetation', '0.4 to 0.6': 'Moderate vegetation', '0.6 to 1': 'Dense vegetation' }
  },
  evi: {
    formula: '2.5 * (NIR - RED) / (NIR + 6*RED - 7.5*BLUE + 1)',
    bands: ['nir', 'red', 'blue'],
    description: 'Enhanced Vegetation Index',
    interpretation: { '-1 to 0': 'Non-vegetated', '0 to 0.2': 'Sparse', '0.2 to 0.4': 'Moderate', '0.4 to 1': 'Dense vegetation' }
  },
  ndwi: {
    formula: '(GREEN - NIR) / (GREEN + NIR)',
    bands: ['green', 'nir'],
    description: 'Normalized Difference Water Index',
    interpretation: { '-1 to -0.3': 'Dry land', '-0.3 to 0': 'Low water', '0 to 0.3': 'Moderate water', '0.3 to 1': 'Water bodies' }
  },
  savi: {
    formula: '1.5 * (NIR - RED) / (NIR + RED + 0.5)',
    bands: ['nir', 'red'],
    description: 'Soil Adjusted Vegetation Index',
    interpretation: { '-1 to 0': 'Non-vegetated', '0 to 0.2': 'Bare soil', '0.2 to 0.4': 'Sparse', '0.4 to 1': 'Dense vegetation' }
  },
  ndbi: {
    formula: '(SWIR1 - NIR) / (SWIR1 + NIR)',
    bands: ['swir1', 'nir'],
    description: 'Normalized Difference Built-up Index',
    interpretation: { '-1 to -0.3': 'Vegetation', '-0.3 to 0': 'Bare soil', '0 to 0.3': 'Mixed urban', '0.3 to 1': 'Dense urban' }
  },
  bsi: {
    formula: '((SWIR1 + RED) - (NIR + BLUE)) / ((SWIR1 + RED) + (NIR + BLUE))',
    bands: ['swir1', 'red', 'nir', 'blue'],
    description: 'Bare Soil Index',
    interpretation: { '-1 to -0.2': 'Dense vegetation', '-0.2 to 0.2': 'Sparse vegetation', '0.2 to 0.5': 'Bare soil', '0.5 to 1': 'Rock/sand' }
  },
  mndwi: {
    formula: '(GREEN - SWIR1) / (GREEN + SWIR1)',
    bands: ['green', 'swir1'],
    description: 'Modified Normalized Difference Water Index',
    interpretation: { '-1 to 0': 'Non-water', '0 to 0.3': 'Shallow water/wetland', '0.3 to 1': 'Deep water' }
  },
  ndsi: {
    formula: '(GREEN - SWIR1) / (GREEN + SWIR1)',
    bands: ['green', 'swir1'],
    description: 'Normalized Difference Snow Index',
    interpretation: { '-1 to 0': 'No snow', '0 to 0.4': 'Possible snow', '0.4 to 1': 'Snow/ice present' }
  },
  nbr: {
    formula: '(NIR - SWIR2) / (NIR + SWIR2)',
    bands: ['nir', 'swir2'],
    description: 'Normalized Burn Ratio',
    interpretation: { '-1 to -0.25': 'High severity burn', '-0.25 to -0.1': 'Moderate burn', '-0.1 to 0.1': 'Low burn/unburned', '0.1 to 1': 'Healthy vegetation' }
  }
};

/**
 * Resolve collection ID
 */
function resolveCollection(id: string): string {
  return COLLECTION_MAP[id] || id;
}

/**
 * Get COG URLs for assets from STAC items
 */
function getCogUrls(items: STACItem[], collection: string, bandNames: string[]): any[] {
  const bandMap = BAND_MAPPING[collection] || BAND_MAPPING['sentinel-2-l2a'];
  
  return items.map(item => {
    const urls: Record<string, string> = {};
    
    for (const bandName of bandNames) {
      const assetKey = bandMap[bandName];
      if (assetKey && item.assets?.[assetKey]) {
        urls[bandName] = item.assets[assetKey].href;
      }
    }
    
    return {
      itemId: item.id,
      datetime: item.properties?.datetime,
      cloudCover: item.properties?.['eo:cloud_cover'],
      cogUrls: urls
    };
  });
}

/**
 * Composite operation - create temporal composite
 */
async function createComposite(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 20,
    reducer = 'median',
    bands = ['red', 'green', 'blue', 'nir'],
    limit = 50
  } = params;
  
  const collection = resolveCollection(collectionId);
  
  // Build datetime (RFC3339 format)
  const datetime = formatDatetime(startDate, endDate);
  
  try {
    // Search for items
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit,
      query: cloudCoverMax !== undefined ? { 'eo:cloud_cover': { lt: cloudCoverMax } } : undefined
    });
    
    if (items.length === 0) {
      return {
        success: false,
        operation: 'composite',
        error: 'No images found',
        message: 'No images match the search criteria'
      };
    }
    
    // Get COG URLs for requested bands
    const cogData = getCogUrls(items, collection, bands);
    
    // Build composite specification (for use by TiTiler or processing service)
    const compositeSpec = {
      type: 'temporal_composite',
      collection,
      reducer,
      bands,
      imageCount: items.length,
      dateRange: {
        start: startDate || items[items.length - 1].properties?.datetime,
        end: endDate || items[0].properties?.datetime
      },
      bbox: parseBbox(bbox),
      cloudCoverMax
    };
    
    return {
      success: true,
      operation: 'composite',
      compositeSpec,
      imageCount: items.length,
      sampleImages: cogData.slice(0, 5),
      cogUrls: {
        note: 'COG URLs for direct access',
        firstImage: cogData[0]?.cogUrls || {}
      },
      processing: {
        status: 'specification_ready',
        note: 'Use TiTiler endpoint or processing service to generate actual composite',
        titilerExample: `${process.env.TITILER_ENDPOINT || 'https://titiler.xyz'}/cog/tiles/{z}/{x}/{y}?url={COG_URL}`
      },
      message: `Composite specification ready: ${items.length} images with ${reducer} reducer`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'composite',
      error: error.message,
      message: 'Failed to create composite'
    };
  }
}

/**
 * NDVI operation - compute NDVI
 */
async function computeNdvi(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 20,
    limit = 10
  } = params;
  
  const collection = resolveCollection(collectionId);
  
  // Build datetime (RFC3339 format)
  const datetime = formatDatetime(startDate, endDate);
  
  try {
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit,
      query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
    });
    
    if (items.length === 0) {
      return {
        success: false,
        operation: 'ndvi',
        error: 'No images found',
        message: 'No images match the search criteria'
      };
    }
    
    // Get NIR and RED band URLs
    const cogData = getCogUrls(items, collection, ['nir', 'red']);
    
    // Build tile URL for NDVI using proper STAC asset references
    const titiler = process.env.TITILER_ENDPOINT || 'https://titiler.xyz';
    const itemLinks = (items[0] as any).links as Array<{rel: string; href: string}> | undefined;
    const itemUrl = itemLinks?.find((l: {rel: string; href: string}) => l.rel === 'self')?.href;
    let tileUrl = '';
    if (itemUrl) {
      // Use assets=nir&assets=red then expression with b1, b2
      tileUrl = `${titiler}/stac/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${encodeURIComponent(itemUrl)}&assets=nir&assets=red&expression=${encodeURIComponent('(b1-b2)/(b1+b2)')}&rescale=-1,1&colormap_name=rdylgn`;
    }
    
    // Register as map layer
    let layerId = '';
    if (tileUrl) {
      layerId = registerLayer({
        name: `NDVI - ${items[0].properties?.datetime?.split('T')[0] || 'latest'}`,
        type: 'index',
        tileUrl,
        metadata: {
          source: 'axion_process',
          collection,
          bbox: parseBbox(bbox) || undefined,
          datetime: items[0].properties?.datetime,
          description: 'Normalized Difference Vegetation Index',
          colormap: 'rdylgn'
        }
      });
    }
    
    return {
      success: true,
      operation: 'ndvi',
      index: INDEX_FORMULAS.ndvi,
      collection,
      imageCount: items.length,
      sampleImages: cogData.slice(0, 3),
      layerId,
      tileUrl,
      processing: {
        status: 'urls_ready',
        formula: '(NIR - RED) / (NIR + RED)',
        note: 'Layer registered! Use axion_map to visualize.',
        titilerExpression: '(b1-b2)/(b1+b2)',
        exampleUrl: cogData[0] ? 
          `titiler/cog/tiles/{z}/{x}/{y}?url=${encodeURIComponent(cogData[0].cogUrls?.nir || '')}&expression=(b1-b2)/(b1+b2)` : 
          'No COG URLs available'
      },
      mapUsage: layerId ? {
        addToMap: { tool: 'axion_map', operation: 'layer', mapId: 'YOUR_MAP_ID', layerId },
        createNewMap: { tool: 'axion_map', operation: 'add', layerId }
      } : null,
      message: `NDVI ready for ${items.length} images${layerId ? ` - Layer ID: ${layerId}` : ''}`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'ndvi',
      error: error.message,
      message: 'Failed to compute NDVI'
    };
  }
}

/**
 * Indices operation - compute vegetation/spectral indices
 */
async function computeIndices(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    indexType = 'ndvi',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 20,
    limit = 10
  } = params;
  
  const collection = resolveCollection(collectionId);
  const indexInfo = INDEX_FORMULAS[indexType];
  
  if (!indexInfo) {
    return {
      success: false,
      operation: 'indices',
      error: `Unknown index type: ${indexType}`,
      availableIndices: Object.keys(INDEX_FORMULAS),
      message: 'Please specify a valid index type'
    };
  }
  
  // Build datetime
  let datetime: string | undefined;
  if (startDate && endDate) {
    datetime = `${startDate}/${endDate}`;
  }
  
  try {
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit,
      query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
    });
    
    if (items.length === 0) {
      return {
        success: false,
        operation: 'indices',
        error: 'No images found',
        message: 'No images match the search criteria'
      };
    }
    
    // Get COG URLs for required bands
    const cogData = getCogUrls(items, collection, indexInfo.bands);
    
    // Build tile URL for the index
    const titiler = process.env.TITILER_ENDPOINT || 'https://titiler.xyz';
    const bandMap = BAND_MAPPING[collection] || BAND_MAPPING['sentinel-2-l2a'];
    const itemLinks = (items[0] as any).links as Array<{rel: string; href: string}> | undefined;
    const itemUrl = itemLinks?.find((l: {rel: string; href: string}) => l.rel === 'self')?.href;
    
    // Index configurations with proper STAC asset names
    const indexConfigs: Record<string, { assets: string[]; expression: string; colormap: string }> = {
      ndvi: { assets: ['nir', 'red'], expression: '(b1-b2)/(b1+b2)', colormap: 'rdylgn' },
      evi: { assets: ['nir', 'red', 'blue'], expression: '2.5*(b1-b2)/(b1+6*b2-7.5*b3+1)', colormap: 'viridis' },
      ndwi: { assets: ['green', 'nir'], expression: '(b1-b2)/(b1+b2)', colormap: 'blues' },
      savi: { assets: ['nir', 'red'], expression: '1.5*(b1-b2)/(b1+b2+0.5)', colormap: 'ylgn' },
      ndbi: { assets: ['swir16', 'nir'], expression: '(b1-b2)/(b1+b2)', colormap: 'reds' },
      bsi: { assets: ['swir16', 'red', 'nir', 'blue'], expression: '((b1+b2)-(b3+b4))/((b1+b2)+(b3+b4))', colormap: 'oranges' },
      mndwi: { assets: ['green', 'swir16'], expression: '(b1-b2)/(b1+b2)', colormap: 'blues' },
      ndsi: { assets: ['green', 'swir16'], expression: '(b1-b2)/(b1+b2)', colormap: 'blues' },
      nbr: { assets: ['nir', 'swir22'], expression: '(b1-b2)/(b1+b2)', colormap: 'rdylgn' }
    };
    
    let tileUrl = '';
    const config = indexConfigs[indexType];
    if (itemUrl && config) {
      let url = `${titiler}/stac/tiles/WebMercatorQuad/{z}/{x}/{y}@2x.png?url=${encodeURIComponent(itemUrl)}`;
      for (const asset of config.assets) {
        url += `&assets=${asset}`;
      }
      url += `&expression=${encodeURIComponent(config.expression)}&rescale=-1,1&colormap_name=${config.colormap}`;
      tileUrl = url;
    }
    
    // Register as map layer
    let layerId = '';
    if (tileUrl && config) {
      layerId = registerLayer({
        name: `${indexType.toUpperCase()} - ${items[0].properties?.datetime?.split('T')[0] || 'latest'}`,
        type: 'index',
        tileUrl,
        metadata: {
          source: 'axion_process',
          collection,
          bbox: parseBbox(bbox) || undefined,
          datetime: items[0].properties?.datetime,
          description: indexInfo.description,
          colormap: config.colormap
        }
      });
    }
    
    return {
      success: true,
      operation: 'indices',
      indexType,
      indexInfo,
      layerId,
      tileUrl,
      collection,
      imageCount: items.length,
      requiredBands: indexInfo.bands,
      sampleImages: cogData.slice(0, 3),
      processing: {
        status: 'urls_ready',
        formula: indexInfo.formula,
        note: 'Layer registered! Use axion_map to visualize.'
      },
      mapUsage: layerId ? {
        addToMap: { tool: 'axion_map', operation: 'layer', mapId: 'YOUR_MAP_ID', layerId },
        createNewMap: { tool: 'axion_map', operation: 'add', layerId }
      } : null,
      message: `${indexInfo.description} ready for ${items.length} images${layerId ? ` - Layer ID: ${layerId}` : ''}`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'indices',
      error: error.message,
      message: 'Failed to compute indices'
    };
  }
}

/**
 * Stats operation - compute statistics for a region
 */
async function computeStats(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 20,
    bands = ['nir'],
    limit = 5
  } = params;
  
  if (!bbox) {
    return {
      success: false,
      operation: 'stats',
      error: 'bbox required for stats computation',
      message: 'Please provide a bounding box'
    };
  }
  
  const collection = resolveCollection(collectionId);
  
  // Build datetime
  let datetime: string | undefined;
  if (startDate && endDate) {
    datetime = `${startDate}/${endDate}`;
  }
  
  try {
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit,
      query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
    });
    
    if (items.length === 0) {
      return {
        success: false,
        operation: 'stats',
        error: 'No images found',
        message: 'No images match the search criteria'
      };
    }
    
    const cogData = getCogUrls(items, collection, bands);
    
    return {
      success: true,
      operation: 'stats',
      collection,
      bbox: parseBbox(bbox),
      imageCount: items.length,
      bands,
      sampleImages: cogData,
      processing: {
        status: 'specification_ready',
        note: 'Use TiTiler statistics endpoint to compute stats',
        titilerExample: `titiler/cog/statistics?url={COG_URL}&bounds={bbox}`
      },
      message: `Statistics ready for ${items.length} images over specified region`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'stats',
      error: error.message,
      message: 'Failed to compute stats'
    };
  }
}

/**
 * Mosaic operation - create mosaic from multiple images
 */
async function createMosaic(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 10,
    bands = ['red', 'green', 'blue'],
    limit = 20
  } = params;
  
  const collection = resolveCollection(collectionId);
  
  // Build datetime
  let datetime: string | undefined;
  if (startDate && endDate) {
    datetime = `${startDate}/${endDate}`;
  }
  
  try {
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit,
      query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
    });
    
    if (items.length === 0) {
      return {
        success: false,
        operation: 'mosaic',
        error: 'No images found',
        message: 'No images match the search criteria'
      };
    }
    
    const cogData = getCogUrls(items, collection, bands);
    
    // Build mosaic specification
    const mosaicSpec = {
      type: 'mosaic',
      collection,
      bands,
      imageCount: items.length,
      bbox: parseBbox(bbox),
      cogUrls: cogData.map(d => d.cogUrls)
    };
    
    return {
      success: true,
      operation: 'mosaic',
      mosaicSpec,
      imageCount: items.length,
      sampleImages: cogData.slice(0, 5),
      processing: {
        status: 'specification_ready',
        note: 'Use TiTiler mosaic endpoint to generate tiles',
        titilerMosaicExample: 'titiler/mosaicjson/tiles/{z}/{x}/{y}'
      },
      message: `Mosaic specification ready: ${items.length} images`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'mosaic',
      error: error.message,
      message: 'Failed to create mosaic'
    };
  }
}

/**
 * False Color Composite (FCC) operation
 */
async function createFCC(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 20,
    limit = 20
  } = params;
  
  const collection = resolveCollection(collectionId);
  const datetime = formatDatetime(startDate, endDate);
  
  try {
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit,
      query: cloudCoverMax !== undefined ? { 'eo:cloud_cover': { lt: cloudCoverMax } } : undefined
    });
    
    if (items.length === 0) {
      return { success: false, operation: 'fcc', error: 'No images found' };
    }
    
    // FCC bands based on collection
    let fccBands: string[];
    let visualization: any;
    
    if (collection === 'sentinel-2-l2a') {
      fccBands = ['nir', 'red', 'green']; // B08, B04, B03
      visualization = { bands: ['B08', 'B04', 'B03'], min: 0, max: 4000, description: 'NIR-Red-Green' };
    } else if (collection === 'landsat-c2-l2') {
      fccBands = ['nir', 'red', 'green']; // SR_B5, SR_B4, SR_B3
      visualization = { bands: ['SR_B5', 'SR_B4', 'SR_B3'], min: 0, max: 30000, description: 'NIR-Red-Green' };
    } else {
      return { success: false, operation: 'fcc', error: 'FCC only supported for Sentinel-2 and Landsat' };
    }
    
    const cogData = getCogUrls(items, collection, fccBands);
    
    return {
      success: true,
      operation: 'fcc',
      collection,
      imageCount: items.length,
      fccBands,
      visualization,
      sampleImages: cogData.slice(0, 3),
      interpretation: {
        'Bright Red': 'Healthy vegetation (high NIR reflectance)',
        'Pink/Light Red': 'Sparse or stressed vegetation',
        'White/Cyan': 'Urban areas, bare soil',
        'Blue/Dark': 'Water bodies',
        'Brown': 'Bare earth, fallow fields'
      },
      processing: {
        status: 'specification_ready',
        note: 'Use TiTiler with bands parameter for FCC visualization'
      },
      message: `False Color Composite ready: ${items.length} images`
    };
  } catch (error: any) {
    return { success: false, operation: 'fcc', error: error.message };
  }
}

/**
 * Geospatial model specifications - matches GEE model operations
 */
async function runModel(params: any) {
  const {
    modelType,
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 20,
    region,
    limit = 30
  } = params;
  
  if (!modelType) {
    return {
      success: false,
      operation: 'model',
      error: 'modelType required',
      availableModels: ['wildfire', 'flood', 'agriculture', 'deforestation', 'water_quality'],
      message: 'Please specify a model type'
    };
  }
  
  const collection = resolveCollection(collectionId);
  const datetime = formatDatetime(startDate, endDate);
  
  try {
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit,
      query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
    });
    
    if (items.length === 0) {
      return { success: false, operation: 'model', modelType, error: 'No images found' };
    }
    
    // Model-specific configurations
    const modelConfigs: Record<string, any> = {
      wildfire: {
        description: 'Wildfire Risk Assessment',
        requiredIndices: ['ndvi', 'ndwi', 'nbr'],
        factors: ['Temperature (MODIS LST)', 'Vegetation moisture (NDMI)', 'Fuel load (NDVI)', 'Terrain slope'],
        riskLevels: { '0.0-0.2': 'Very Low', '0.2-0.4': 'Low', '0.4-0.6': 'Moderate', '0.6-0.8': 'High', '0.8-1.0': 'Very High' },
        visualization: { palette: ['green', 'yellow', 'orange', 'red', 'darkred'] }
      },
      flood: {
        description: 'Flood Risk Assessment',
        requiredIndices: ['ndwi', 'mndwi'],
        factors: ['Precipitation', 'Elevation', 'Slope', 'Soil drainage', 'Impervious surfaces'],
        riskLevels: { '0.0-0.2': 'Very Low', '0.2-0.4': 'Low', '0.4-0.6': 'Moderate', '0.6-0.8': 'High', '0.8-1.0': 'Very High' },
        visualization: { palette: ['green', 'yellow', 'orange', 'blue', 'darkblue'] }
      },
      agriculture: {
        description: 'Agricultural Monitoring & Crop Health',
        requiredIndices: ['ndvi', 'evi', 'savi', 'ndwi'],
        analysisTypes: ['Crop health', 'Yield prediction', 'Irrigation monitoring', 'Disease risk', 'Soil analysis', 'Phenology'],
        cropMetrics: ['Peak NDVI', 'Mean NDVI', 'NDVI variability', 'Water stress index'],
        visualization: { palette: ['red', 'orange', 'yellow', 'lightgreen', 'darkgreen'] }
      },
      deforestation: {
        description: 'Deforestation Detection',
        requiredIndices: ['ndvi', 'nbr'],
        factors: ['Baseline forest cover', 'Current forest cover', 'NDVI change'],
        changeLevels: { '-1.0 to -0.3': 'Severe loss', '-0.3 to -0.1': 'Moderate loss', '-0.1 to 0.1': 'No change', '0.1 to 0.3': 'Regrowth', '0.3 to 1.0': 'Significant regrowth' },
        visualization: { palette: ['red', 'orange', 'yellow', 'white', 'lightgreen', 'green'] }
      },
      water_quality: {
        description: 'Water Quality Assessment',
        requiredIndices: ['ndwi', 'mndwi'],
        parameters: ['Chlorophyll-a', 'Turbidity', 'Algae index', 'Water clarity'],
        qualityLevels: { '0.0-0.2': 'Excellent', '0.2-0.4': 'Good', '0.4-0.6': 'Fair', '0.6-0.8': 'Poor', '0.8-1.0': 'Very Poor' },
        visualization: { palette: ['blue', 'cyan', 'green', 'yellow', 'red'] }
      }
    };
    
    const config = modelConfigs[modelType];
    if (!config) {
      return { success: false, operation: 'model', error: `Unknown model: ${modelType}` };
    }
    
    // Get COG URLs for required bands
    const allBands = ['red', 'green', 'blue', 'nir', 'swir1', 'swir2'];
    const cogData = getCogUrls(items, collection, allBands);
    
    const modelKey = `${modelType}_model_${Date.now()}`;
    
    return {
      success: true,
      operation: 'model',
      modelType,
      modelKey,
      description: config.description,
      collection,
      imageCount: items.length,
      bbox: parseBbox(bbox),
      dateRange: { startDate, endDate },
      modelConfig: config,
      requiredIndices: config.requiredIndices,
      sampleImages: cogData.slice(0, 3),
      processing: {
        status: 'specification_ready',
        steps: [
          `1. Calculate required indices: ${config.requiredIndices.join(', ')}`,
          '2. Apply model weights/thresholds',
          '3. Generate risk/assessment map',
          '4. Compute statistics'
        ],
        note: 'Use processing service to compute full model results'
      },
      visualization: config.visualization,
      message: `${config.description} model specification ready`
    };
  } catch (error: any) {
    return { success: false, operation: 'model', modelType, error: error.message };
  }
}

/**
 * Change detection between two time periods
 */
async function detectChange(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    beforeStartDate,
    beforeEndDate,
    afterStartDate,
    afterEndDate,
    bands = ['nir'],
    indexType = 'ndvi',
    cloudCoverMax = 20
  } = params;
  
  if (!bbox || !beforeStartDate || !afterStartDate) {
    return {
      success: false,
      operation: 'change_detect',
      error: 'bbox, beforeStartDate, and afterStartDate required',
      example: '{ "operation": "change_detect", "bbox": "...", "beforeStartDate": "2023-06-01", "beforeEndDate": "2023-06-30", "afterStartDate": "2024-06-01", "afterEndDate": "2024-06-30" }'
    };
  }
  
  const collection = resolveCollection(collectionId);
  const titilerEndpoint = process.env.TITILER_ENDPOINT || 'https://titiler.xyz';
  
  try {
    // Get before period images
    const beforeItems = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime: formatDatetime(beforeStartDate, beforeEndDate || beforeStartDate),
      limit: 10,
      query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
    });
    
    // Get after period images
    const afterItems = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime: formatDatetime(afterStartDate, afterEndDate || afterStartDate),
      limit: 10,
      query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
    });
    
    if (beforeItems.length === 0 || afterItems.length === 0) {
      return {
        success: false,
        operation: 'change_detect',
        error: `Missing imagery: before=${beforeItems.length}, after=${afterItems.length}`
      };
    }
    
    const beforeItem = beforeItems[0];
    const afterItem = afterItems[0];
    
    const indexConfig = INDEX_FORMULAS[indexType] || INDEX_FORMULAS.ndvi;
    const bandMap = BAND_MAPPING[collection] || BAND_MAPPING['sentinel-2-l2a'];
    
    const changeResult = {
      taskId: `change_${Date.now()}`,
      collection,
      indexType,
      beforePeriod: {
        imageId: beforeItem.id,
        datetime: beforeItem.properties?.datetime,
        cloudCover: beforeItem.properties?.['eo:cloud_cover']
      },
      afterPeriod: {
        imageId: afterItem.id,
        datetime: afterItem.properties?.datetime,
        cloudCover: afterItem.properties?.['eo:cloud_cover']
      },
      changeTypes: [
        { type: 'decrease', interpretation: 'Vegetation loss / degradation' },
        { type: 'increase', interpretation: 'Vegetation growth / recovery' },
        { type: 'stable', interpretation: 'No significant change' }
      ],
      formula: `${indexType}_after - ${indexType}_before`,
      indexFormula: indexConfig.formula
    };
    
    const nirBand = bandMap.nir || 'B08';
    const beforeNirUrl = beforeItem.assets?.[nirBand]?.href;
    const afterNirUrl = afterItem.assets?.[nirBand]?.href;
    
    const visualizationUrls: Record<string, string> = {};
    if (beforeNirUrl) {
      visualizationUrls.before = `${titilerEndpoint}/cog/preview.png?url=${encodeURIComponent(beforeNirUrl)}&rescale=0,10000&colormap_name=viridis`;
    }
    if (afterNirUrl) {
      visualizationUrls.after = `${titilerEndpoint}/cog/preview.png?url=${encodeURIComponent(afterNirUrl)}&rescale=0,10000&colormap_name=viridis`;
    }
    
    return {
      success: true,
      operation: 'change_detect',
      changeResult,
      visualizationUrls,
      applications: [
        'Deforestation monitoring',
        'Urban expansion tracking', 
        'Agricultural change detection',
        'Disaster damage assessment',
        'Vegetation recovery monitoring'
      ],
      message: `Change detection ready: ${beforeItem.properties?.datetime} → ${afterItem.properties?.datetime}`
    };
  } catch (error: any) {
    return { success: false, operation: 'change_detect', error: error.message };
  }
}

/**
 * Terrain analysis from DEM
 */
async function analyzeTerrain(params: any) {
  const {
    bbox,
    demCollection = 'cop-dem-glo-30',
    terrainOutputs = ['slope', 'aspect', 'hillshade', 'elevation']
  } = params;
  
  if (!bbox) {
    return {
      success: false,
      operation: 'terrain',
      error: 'bbox required',
      example: '{ "operation": "terrain", "bbox": "-122.5,37.5,-122.0,38.0" }'
    };
  }
  
  const titilerEndpoint = process.env.TITILER_ENDPOINT || 'https://titiler.xyz';
  
  try {
    const items = await stac.searchItems({
      collections: [demCollection],
      bbox: parseBbox(bbox),
      limit: 4
    });
    
    if (items.length === 0) {
      return {
        success: false,
        operation: 'terrain',
        error: `No DEM data found for collection: ${demCollection}`,
        availableCollections: ['cop-dem-glo-30', 'cop-dem-glo-90', 'alos-dem', 'nasadem']
      };
    }
    
    const demItem = items[0];
    const demUrl = demItem.assets?.data?.href || demItem.assets?.elevation?.href || Object.values(demItem.assets || {})[0]?.href;
    
    const terrainUrls: Record<string, any> = {};
    const bboxStr = parseBbox(bbox)?.join(',') || '';
    
    if (demUrl) {
      if (terrainOutputs.includes('elevation')) {
        terrainUrls.elevation = {
          preview: `${titilerEndpoint}/cog/preview.png?url=${encodeURIComponent(demUrl)}&colormap_name=terrain`,
          geotiff: `${titilerEndpoint}/cog/crop/${bboxStr}.tif?url=${encodeURIComponent(demUrl)}`,
          statistics: `${titilerEndpoint}/cog/statistics?url=${encodeURIComponent(demUrl)}`
        };
      }
      if (terrainOutputs.includes('slope')) {
        terrainUrls.slope = { note: 'Slope computation from DEM', demSource: demUrl, unit: 'degrees' };
      }
      if (terrainOutputs.includes('aspect')) {
        terrainUrls.aspect = { note: 'Aspect computation from DEM', demSource: demUrl, unit: 'degrees from north' };
      }
      if (terrainOutputs.includes('hillshade')) {
        terrainUrls.hillshade = { note: 'Hillshade computation from DEM', demSource: demUrl, azimuth: 315, altitude: 45 };
      }
    }
    
    return {
      success: true,
      operation: 'terrain',
      demCollection,
      demItem: { id: demItem.id, resolution: demCollection.includes('30') ? '30m' : '90m' },
      bbox: parseBbox(bbox),
      requestedOutputs: terrainOutputs,
      terrainUrls,
      availableProducts: [
        { name: 'elevation', description: 'Raw elevation values in meters' },
        { name: 'slope', description: 'Terrain slope in degrees' },
        { name: 'aspect', description: 'Terrain aspect (compass direction)' },
        { name: 'hillshade', description: 'Shaded relief visualization' }
      ],
      message: `Terrain analysis ready for ${demCollection}`
    };
  } catch (error: any) {
    return { success: false, operation: 'terrain', error: error.message };
  }
}

/**
 * Apply cloud masking to imagery
 */
async function maskClouds(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    cloudCoverMax = 100
  } = params;
  
  if (!bbox) {
    return { success: false, operation: 'mask_clouds', error: 'bbox required' };
  }
  
  const collection = resolveCollection(collectionId);
  
  try {
    const datetime = formatDatetime(startDate, endDate);
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit: 20,
      query: { 'eo:cloud_cover': { lt: cloudCoverMax } }
    });
    
    if (items.length === 0) {
      return { success: false, operation: 'mask_clouds', error: 'No images found' };
    }
    
    const maskInfo = collection.includes('sentinel-2') ? {
      maskBand: 'SCL',
      cloudValues: [3, 8, 9, 10],
      clearValues: [4, 5, 6, 7],
      description: 'Sentinel-2 Scene Classification Layer'
    } : {
      maskBand: 'QA_PIXEL',
      cloudBit: 3,
      shadowBit: 4,
      description: 'Landsat QA_PIXEL band'
    };
    
    const cloudStats = items.slice(0, 5).map(item => ({
      imageId: item.id,
      datetime: item.properties?.datetime,
      cloudCover: item.properties?.['eo:cloud_cover']
    }));
    
    const avgCloudCover = items.reduce((sum, i) => sum + (i.properties?.['eo:cloud_cover'] || 0), 0) / items.length;
    
    return {
      success: true,
      operation: 'mask_clouds',
      collection,
      imageCount: items.length,
      maskInfo,
      cloudStats,
      summary: {
        averageCloudCover: avgCloudCover.toFixed(1) + '%',
        lowestCloudCover: Math.min(...items.map(i => i.properties?.['eo:cloud_cover'] || 100)).toFixed(1) + '%'
      },
      message: `Cloud mask info ready for ${items.length} images (avg cloud: ${avgCloudCover.toFixed(1)}%)`
    };
  } catch (error: any) {
    return { success: false, operation: 'mask_clouds', error: error.message };
  }
}

/**
 * Resample imagery to different resolution
 */
async function resampleImage(params: any) {
  const {
    collectionId = 'sentinel-2-l2a',
    bbox,
    startDate,
    endDate,
    targetResolution = 30,
    resampleMethod = 'bilinear',
    bands = ['visual']
  } = params;
  
  if (!bbox) {
    return { success: false, operation: 'resample', error: 'bbox required' };
  }
  
  const collection = resolveCollection(collectionId);
  const titilerEndpoint = process.env.TITILER_ENDPOINT || 'https://titiler.xyz';
  
  try {
    const datetime = formatDatetime(startDate, endDate);
    const items = await stac.searchItems({
      collections: [collection],
      bbox: parseBbox(bbox),
      datetime,
      limit: 1,
      query: { 'eo:cloud_cover': { lt: 20 } }
    });
    
    if (items.length === 0) {
      return { success: false, operation: 'resample', error: 'No images found' };
    }
    
    const item = items[0];
    const bboxArr = parseBbox(bbox);
    
    const degToM = 111000;
    const widthDeg = bboxArr ? Math.abs(bboxArr[2] - bboxArr[0]) : 0.5;
    const heightDeg = bboxArr ? Math.abs(bboxArr[3] - bboxArr[1]) : 0.5;
    const widthPx = Math.round((widthDeg * degToM) / targetResolution);
    const heightPx = Math.round((heightDeg * degToM) / targetResolution);
    
    const resampledUrls: Record<string, string> = {};
    for (const band of bands) {
      const assetKey = band === 'visual' ? 'visual' : band;
      const cogUrl = item.assets?.[assetKey]?.href;
      if (cogUrl) {
        resampledUrls[band] = `${titilerEndpoint}/cog/preview.png?url=${encodeURIComponent(cogUrl)}&width=${widthPx}&height=${heightPx}&resampling=${resampleMethod}`;
      }
    }
    
    return {
      success: true,
      operation: 'resample',
      collection,
      sourceImage: { id: item.id, nativeResolution: collection.includes('sentinel') ? '10m' : '30m' },
      targetResolution: `${targetResolution}m`,
      resampleMethod,
      outputDimensions: { width: widthPx, height: heightPx },
      resampledUrls,
      availableMethods: ['nearest', 'bilinear', 'cubic'],
      message: `Resampling ready: native → ${targetResolution}m (${resampleMethod})`
    };
  } catch (error: any) {
    return { success: false, operation: 'resample', error: error.message };
  }
}

/**
 * Help operation
 */
function getHelp() {
  return {
    success: true,
    operation: 'help',
    tool: 'axion_process',
    description: 'AWS-native processing tool for satellite imagery',
    operations: {
      composite: {
        description: 'Create temporal composite from multiple images',
        params: ['collectionId', 'bbox', 'startDate', 'endDate', 'cloudCoverMax', 'reducer', 'bands'],
        reducers: ['median', 'mean', 'min', 'max', 'mosaic']
      },
      fcc: {
        description: 'Create False Color Composite (NIR-Red-Green)',
        params: ['collectionId', 'bbox', 'startDate', 'endDate'],
        interpretation: 'Red=vegetation, Cyan=urban, Blue=water'
      },
      ndvi: {
        description: 'Compute NDVI (Normalized Difference Vegetation Index)',
        params: ['collectionId', 'bbox', 'startDate', 'endDate', 'cloudCoverMax']
      },
      indices: {
        description: 'Compute vegetation/spectral indices',
        params: ['collectionId', 'bbox', 'startDate', 'endDate', 'indexType'],
        availableIndices: Object.entries(INDEX_FORMULAS).map(([k, v]) => ({ name: k, description: v.description }))
      },
      model: {
        description: 'Run geospatial analysis models',
        params: ['modelType', 'bbox', 'startDate', 'endDate', 'collectionId'],
        availableModels: [
          { name: 'wildfire', description: 'Wildfire risk assessment' },
          { name: 'flood', description: 'Flood risk assessment' },
          { name: 'agriculture', description: 'Agricultural monitoring & crop health' },
          { name: 'deforestation', description: 'Deforestation detection' },
          { name: 'water_quality', description: 'Water quality assessment' }
        ]
      },
      stats: {
        description: 'Compute statistics for a region',
        params: ['collectionId', 'bbox', 'startDate', 'endDate', 'bands']
      },
      mosaic: {
        description: 'Create mosaic from multiple images',
        params: ['collectionId', 'bbox', 'startDate', 'endDate', 'bands']
      },
      change_detect: {
        description: 'Detect changes between two time periods',
        params: ['collectionId', 'bbox', 'beforeStartDate', 'beforeEndDate', 'afterStartDate', 'afterEndDate', 'indexType']
      },
      terrain: {
        description: 'Terrain analysis (slope, aspect, hillshade) from DEM',
        params: ['bbox', 'demCollection', 'terrainOutputs'],
        availableDEMs: ['cop-dem-glo-30', 'cop-dem-glo-90', 'alos-dem', 'nasadem']
      },
      mask_clouds: {
        description: 'Get cloud masking information for imagery',
        params: ['collectionId', 'bbox', 'startDate', 'endDate']
      },
      resample: {
        description: 'Resample imagery to different resolution',
        params: ['collectionId', 'bbox', 'targetResolution', 'resampleMethod']
      }
    },
    examples: {
      fcc: {
        operation: 'fcc',
        collectionId: 'sentinel-2-l2a',
        bbox: '-122.5,37.5,-122.0,38.0',
        startDate: '2024-06-01',
        endDate: '2024-06-30'
      },
      model: {
        operation: 'model',
        modelType: 'wildfire',
        bbox: '-122.5,37.5,-122.0,38.0',
        startDate: '2024-06-01',
        endDate: '2024-08-31'
      },
      ndvi: {
        operation: 'ndvi',
        collectionId: 'sentinel-2-l2a',
        bbox: '-122.5,37.5,-122.0,38.0',
        startDate: '2024-06-01',
        endDate: '2024-06-30',
        cloudCoverMax: 20
      },
      composite: {
        operation: 'composite',
        collectionId: 'sentinel-2-l2a',
        bbox: '-122.5,37.5,-122.0,38.0',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        reducer: 'median'
      }
    },
    message: 'Axion Process Tool Help'
  };
}

// Register the tool
register({
  name: 'axion_process',
  description: `Complete processing tool - ArcGIS replacement. Operations: composite, fcc, ndvi, indices (9 types), model (5 types), stats, mosaic, change_detect (change detection), terrain (slope/aspect/hillshade), mask_clouds, resample, help`,
  input: ProcessToolSchema,
  output: z.any(),
  handler: async (params) => {
    try {
      const { operation } = params;
      
      if (!operation) {
        return {
          success: false,
          error: 'operation parameter required',
          availableOperations: ['composite', 'fcc', 'ndvi', 'indices', 'model', 'stats', 'mosaic', 'change_detect', 'terrain', 'mask_clouds', 'resample', 'help'],
          example: '{ "operation": "ndvi", "collectionId": "sentinel-2-l2a", "bbox": "-122.5,37.5,-122.0,38.0" }'
        };
      }
      
      // Normalize parameters
      const normalizedParams = {
        ...params,
        collectionId: params.collectionId || params.collection_id || params.datasetId,
        startDate: params.startDate || params.start_date,
        endDate: params.endDate || params.end_date,
        cloudCoverMax: params.cloudCoverMax || params.cloud_cover_max,
        indexType: params.indexType || params.index_type,
        modelType: params.modelType || params.model_type,
        beforeStartDate: params.beforeStartDate || params.before_start_date,
        beforeEndDate: params.beforeEndDate || params.before_end_date,
        afterStartDate: params.afterStartDate || params.after_start_date,
        afterEndDate: params.afterEndDate || params.after_end_date,
        demCollection: params.demCollection || params.dem_collection,
        terrainOutputs: params.terrainOutputs || params.terrain_outputs,
        targetResolution: params.targetResolution || params.target_resolution,
        resampleMethod: params.resampleMethod || params.resample_method
      };
      
      switch (operation) {
        case 'composite':
          return await createComposite(normalizedParams);
        case 'fcc':
          return await createFCC(normalizedParams);
        case 'ndvi':
          return await computeNdvi(normalizedParams);
        case 'indices':
          return await computeIndices(normalizedParams);
        case 'model':
          return await runModel(normalizedParams);
        case 'stats':
          return await computeStats(normalizedParams);
        case 'mosaic':
          return await createMosaic(normalizedParams);
        case 'change_detect':
        case 'change':
        case 'detect_change':
          return await detectChange(normalizedParams);
        case 'terrain':
        case 'dem':
        case 'slope':
          return await analyzeTerrain(normalizedParams);
        case 'mask_clouds':
        case 'cloud_mask':
          return await maskClouds(normalizedParams);
        case 'resample':
          return await resampleImage(normalizedParams);
        case 'help':
          return getHelp();
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`,
            availableOperations: ['composite', 'fcc', 'ndvi', 'indices', 'model', 'stats', 'mosaic', 'change_detect', 'terrain', 'mask_clouds', 'resample', 'help']
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
