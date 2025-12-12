/**
 * AXION DATA - AWS-Native Data Access Tool
 * Uses Element84 Earth Search STAC API instead of Google Earth Engine
 * Operations: search, filter, info, collections, boundaries
 */

import { z } from 'zod';
import { register } from '../registry';
import { STACClient, parseBbox, STACItem, STACCollection } from '@/src/aws/stac/client';

const stac = new STACClient();

// Main schema for the consolidated tool
const DataToolSchema = z.object({
  operation: z.enum(['search', 'filter', 'info', 'collections', 'boundaries']),
  
  // Search/filter params
  query: z.string().optional(),
  collections: z.array(z.string()).optional(),
  collectionId: z.string().optional(),
  bbox: z.union([z.string(), z.array(z.number())]).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  cloudCoverMax: z.number().optional(),
  limit: z.number().optional(),
  
  // Info params
  itemId: z.string().optional(),
  
  // Common
  includeDetails: z.boolean().optional()
});

/**
 * Collection mapping: GEE dataset IDs -> STAC collection IDs
 */
const COLLECTION_MAP: Record<string, string> = {
  // Sentinel-2
  'COPERNICUS/S2_SR_HARMONIZED': 'sentinel-2-l2a',
  'COPERNICUS/S2_SR': 'sentinel-2-l2a',
  'COPERNICUS/S2': 'sentinel-2-l2a',
  'sentinel-2': 'sentinel-2-l2a',
  
  // Landsat
  'LANDSAT/LC09/C02/T1_L2': 'landsat-c2-l2',
  'LANDSAT/LC08/C02/T1_L2': 'landsat-c2-l2',
  'landsat-8': 'landsat-c2-l2',
  'landsat-9': 'landsat-c2-l2',
  'landsat': 'landsat-c2-l2',
  
  // Sentinel-1
  'COPERNICUS/S1_GRD': 'sentinel-1-grd',
  'sentinel-1': 'sentinel-1-grd',
  
  // NAIP
  'USDA/NAIP/DOQQ': 'naip',
  'naip': 'naip',
  
  // DEM
  'COPERNICUS/DEM/GLO30': 'cop-dem-glo-30',
  'NASA/NASADEM_HGT': 'nasadem',
  'USGS/SRTMGL1_003': 'cop-dem-glo-30'
};

/**
 * Resolve collection ID - handles both GEE-style and STAC-style IDs
 */
function resolveCollection(id: string): string {
  return COLLECTION_MAP[id] || id;
}

/**
 * Search operation - find items in STAC catalog
 */
async function searchItems(params: any) {
  const { 
    query, 
    collections: inputCollections, 
    collectionId,
    bbox, 
    startDate, 
    endDate, 
    cloudCoverMax,
    limit = 10 
  } = params;
  
  // Determine collections to search
  let collections: string[] = [];
  
  if (inputCollections && inputCollections.length > 0) {
    collections = inputCollections.map(resolveCollection);
  } else if (collectionId) {
    collections = [resolveCollection(collectionId)];
  } else if (query) {
    // Map query to collection based on keywords
    const q = query.toLowerCase();
    if (q.includes('sentinel-2') || q.includes('s2') || q.includes('sentinel 2')) {
      collections = ['sentinel-2-l2a'];
    } else if (q.includes('landsat')) {
      collections = ['landsat-c2-l2'];
    } else if (q.includes('sentinel-1') || q.includes('s1') || q.includes('sar')) {
      collections = ['sentinel-1-grd'];
    } else if (q.includes('naip')) {
      collections = ['naip'];
    } else if (q.includes('dem') || q.includes('elevation')) {
      collections = ['cop-dem-glo-30'];
    }
  }
  
  // Build datetime range (RFC3339 format required)
  let datetime: string | undefined;
  if (startDate && endDate) {
    // Convert YYYY-MM-DD to RFC3339 format
    const start = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
    const end = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`;
    datetime = `${start}/${end}`;
  } else if (startDate) {
    const start = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
    datetime = `${start}/..`;
  } else if (endDate) {
    const end = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`;
    datetime = `../${end}`;
  }
  
  // Build query filter for cloud cover
  let queryFilter: Record<string, any> | undefined;
  if (cloudCoverMax !== undefined) {
    queryFilter = {
      'eo:cloud_cover': { lt: cloudCoverMax }
    };
  }
  
  try {
    const items = await stac.searchItems({
      collections: collections.length > 0 ? collections : undefined,
      bbox: parseBbox(bbox),
      datetime,
      limit,
      query: queryFilter
    });
    
    // Transform items to simplified format
    const results = items.map((item: STACItem) => ({
      id: item.id,
      collection: (item as any).collection,
      datetime: item.properties?.datetime,
      cloudCover: item.properties?.['eo:cloud_cover'],
      bbox: item.bbox,
      assets: Object.keys(item.assets || {}),
      thumbnailUrl: item.assets?.thumbnail?.href || item.assets?.overview?.href
    }));
    
    return {
      success: true,
      operation: 'search',
      count: results.length,
      items: results,
      searchParams: {
        collections: collections.length > 0 ? collections : 'all',
        bbox: bbox || 'global',
        datetime: datetime || 'any',
        cloudCoverMax: cloudCoverMax || 'any'
      },
      message: `Found ${results.length} items`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'search',
      error: error.message,
      message: 'Search failed'
    };
  }
}

/**
 * Filter operation - filter specific collection with criteria
 */
async function filterCollection(params: any) {
  const { 
    collectionId,
    collections: inputCollections,
    bbox, 
    startDate, 
    endDate, 
    cloudCoverMax,
    limit = 20 
  } = params;
  
  // Determine collection
  let collections: string[] = [];
  if (inputCollections && inputCollections.length > 0) {
    collections = inputCollections.map(resolveCollection);
  } else if (collectionId) {
    collections = [resolveCollection(collectionId)];
  } else {
    return {
      success: false,
      operation: 'filter',
      error: 'collectionId or collections required',
      message: 'Please specify a collection to filter'
    };
  }
  
  // Build datetime (RFC3339 format)
  let datetime: string | undefined;
  if (startDate && endDate) {
    const start = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
    const end = endDate.includes('T') ? endDate : `${endDate}T23:59:59Z`;
    datetime = `${start}/${end}`;
  } else if (startDate) {
    const start = startDate.includes('T') ? startDate : `${startDate}T00:00:00Z`;
    datetime = `${start}/..`;
  }
  
  // Cloud cover query
  let query: Record<string, any> | undefined;
  if (cloudCoverMax !== undefined) {
    query = { 'eo:cloud_cover': { lt: cloudCoverMax } };
  }
  
  try {
    const items = await stac.searchItems({
      collections,
      bbox: parseBbox(bbox),
      datetime,
      limit,
      query
    });
    
    // Get collection info for bands
    let bandInfo: string[] = [];
    try {
      const collectionInfo = await stac.getCollection(collections[0]);
      // Extract band info from item_assets or summaries
      const summaries = (collectionInfo as any).summaries || {};
      bandInfo = summaries['eo:bands']?.map((b: any) => b.name) || [];
    } catch {
      // Default bands based on collection
      if (collections[0] === 'sentinel-2-l2a') {
        bandInfo = ['B01', 'B02', 'B03', 'B04', 'B05', 'B06', 'B07', 'B08', 'B8A', 'B09', 'B11', 'B12', 'SCL'];
      } else if (collections[0] === 'landsat-c2-l2') {
        bandInfo = ['SR_B1', 'SR_B2', 'SR_B3', 'SR_B4', 'SR_B5', 'SR_B6', 'SR_B7', 'ST_B10', 'QA_PIXEL'];
      }
    }
    
    return {
      success: true,
      operation: 'filter',
      collection: collections[0],
      imageCount: items.length,
      bands: bandInfo,
      filters: {
        bbox: bbox || 'global',
        startDate: startDate || 'any',
        endDate: endDate || 'any',
        cloudCoverMax: cloudCoverMax || 'any'
      },
      items: items.slice(0, 5).map((item: STACItem) => ({
        id: item.id,
        datetime: item.properties?.datetime,
        cloudCover: item.properties?.['eo:cloud_cover']
      })),
      message: `Filtered collection: ${items.length} images found`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'filter',
      error: error.message,
      message: 'Filter failed'
    };
  }
}

/**
 * Collections operation - list available collections
 */
async function listCollections() {
  try {
    const collections = await stac.listCollections();
    
    // Group by category
    const optical = collections.filter((c: STACCollection) => 
      c.id.includes('sentinel-2') || c.id.includes('landsat') || c.id.includes('naip')
    );
    const radar = collections.filter((c: STACCollection) => c.id.includes('sentinel-1'));
    const dem = collections.filter((c: STACCollection) => c.id.includes('dem'));
    const other = collections.filter((c: STACCollection) => 
      !optical.includes(c) && !radar.includes(c) && !dem.includes(c)
    );
    
    return {
      success: true,
      operation: 'collections',
      totalCount: collections.length,
      categories: {
        optical: optical.map((c: STACCollection) => ({ id: c.id, title: c.title })),
        radar: radar.map((c: STACCollection) => ({ id: c.id, title: c.title })),
        elevation: dem.map((c: STACCollection) => ({ id: c.id, title: c.title })),
        other: other.slice(0, 10).map((c: STACCollection) => ({ id: c.id, title: c.title }))
      },
      popularCollections: [
        { id: 'sentinel-2-l2a', description: 'Sentinel-2 L2A surface reflectance, 10-60m, 5-day revisit' },
        { id: 'landsat-c2-l2', description: 'Landsat Collection 2 Level-2, 30m, 16-day revisit' },
        { id: 'sentinel-1-grd', description: 'Sentinel-1 GRD SAR imagery' },
        { id: 'cop-dem-glo-30', description: 'Copernicus DEM 30m global elevation' },
        { id: 'naip', description: 'NAIP aerial imagery (US only)' }
      ],
      message: `${collections.length} collections available`
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'collections',
      error: error.message,
      message: 'Failed to list collections'
    };
  }
}

/**
 * Info operation - get detailed info about a collection or item
 */
async function getInfo(params: any) {
  const { collectionId, itemId } = params;
  
  if (!collectionId && !itemId) {
    return {
      success: false,
      operation: 'info',
      error: 'collectionId or itemId required',
      message: 'Please specify what to get info about'
    };
  }
  
  try {
    if (collectionId) {
      const resolved = resolveCollection(collectionId);
      const collection = await stac.getCollection(resolved);
      
      // Extract useful info
      const extent = collection.extent || {};
      const temporal = extent.temporal?.interval?.[0] || [];
      const spatial = extent.spatial?.bbox?.[0] || [];
      
      return {
        success: true,
        operation: 'info',
        type: 'collection',
        id: collection.id,
        title: collection.title,
        description: collection.description,
        temporalExtent: {
          start: temporal[0] || 'unknown',
          end: temporal[1] || 'ongoing'
        },
        spatialExtent: spatial.length === 4 ? {
          west: spatial[0],
          south: spatial[1],
          east: spatial[2],
          north: spatial[3]
        } : 'global',
        message: `Collection info for ${collection.id}`
      };
    }
    
    // Item info would require knowing collection - simplified
    return {
      success: false,
      operation: 'info',
      error: 'Item info requires collectionId',
      message: 'Please provide collectionId along with itemId'
    };
  } catch (error: any) {
    return {
      success: false,
      operation: 'info',
      error: error.message,
      message: 'Failed to get info'
    };
  }
}

/**
 * Boundaries operation - info about available boundary data
 */
async function getBoundaries() {
  return {
    success: true,
    operation: 'boundaries',
    available: [
      {
        source: 'Natural Earth',
        levels: ['Countries (admin-0)', 'States/Provinces (admin-1)'],
        note: 'Boundary data stored in S3 bucket'
      },
      {
        source: 'GADM',
        levels: ['Country', 'State', 'District'],
        note: 'High-resolution administrative boundaries'
      }
    ],
    usage: 'Use axion_system with operation "boundary" to load specific boundaries',
    message: 'Boundary data available from Natural Earth and GADM'
  };
}

// Register the consolidated tool
register({
  name: 'axion_data',
  description: `AWS-native data access tool using STAC. Operations: search (find imagery), filter (filter collection), info (collection details), collections (list available), boundaries (admin boundaries info)`,
  input: DataToolSchema,
  output: z.any(),
  handler: async (params) => {
    try {
      const { operation } = params;
      
      if (!operation) {
        return {
          success: false,
          error: 'operation parameter required',
          availableOperations: ['search', 'filter', 'info', 'collections', 'boundaries'],
          example: '{ "operation": "search", "collectionId": "sentinel-2-l2a", "bbox": "-122.5,37.5,-122.0,38.0" }'
        };
      }
      
      // Normalize parameters (support both snake_case and camelCase)
      const normalizedParams = {
        ...params,
        collectionId: params.collectionId || params.collection_id || params.datasetId || params.dataset_id,
        startDate: params.startDate || params.start_date,
        endDate: params.endDate || params.end_date,
        cloudCoverMax: params.cloudCoverMax || params.cloud_cover_max,
        itemId: params.itemId || params.item_id
      };
      
      switch (operation) {
        case 'search':
          return await searchItems(normalizedParams);
        case 'filter':
          return await filterCollection(normalizedParams);
        case 'info':
          return await getInfo(normalizedParams);
        case 'collections':
          return await listCollections();
        case 'boundaries':
          return await getBoundaries();
        default:
          return {
            success: false,
            error: `Unknown operation: ${operation}`,
            availableOperations: ['search', 'filter', 'info', 'collections', 'boundaries']
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
