import { register, z } from '../../registry';
import { STACClient, parseBbox } from '@/src/aws/stac/client';
import { DEFAULT_COLLECTIONS } from '@/src/utils/aws-config';

const client = new STACClient();

const DataToolSchema = z.object({
  operation: z.enum(['search', 'filter', 'geometry', 'info', 'boundaries']),
  // Search
  query: z.string().optional(),
  limit: z.number().optional().default(10),
  // Filter
  collectionId: z.string().optional(),
  datasetId: z.string().optional(), // alias of collectionId
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  bbox: z.union([z.array(z.number()).length(4), z.string()]).optional(), // "minLon,minLat,maxLon,maxLat"
  cloudCoverMax: z.number().optional(),
  // Info
  imageId: z.string().optional(),
});

type Params = z.infer<typeof DataToolSchema>;

function resolveCollectionId(p: Params): string | undefined {
  const id = p.collectionId || p.datasetId;
  if (!id) return undefined;
  // Map common GEE IDs to STAC collections (best-effort)
  if (/COPERNICUS\/S2/i.test(id)) return 'sentinel-2-l2a';
  if (/LANDSAT\/LC0[89]/i.test(id)) return 'landsat-c2-l2';
  if (/SENTINEL-1/i.test(id) || /COPERNICUS\/S1/i.test(id)) return 'sentinel-1-grd';
  return id;
}

register({
  name: 'axion_data',
  description: 'AWS/STAC data tool: search datasets, filter items, simple geometry, dataset info, boundaries list',
  input: DataToolSchema,
  output: z.any(),
  handler: async (params: Params) => {
    const op = params.operation;

    // Normalize
    const collectionId = resolveCollectionId(params);

    switch (op) {
      case 'search': {
        const q = (params.query || '').toLowerCase();
        const cols = await client.listCollections();
        const filtered = cols
          .filter(c => !q || c.id.toLowerCase().includes(q) || (c.title || '').toLowerCase().includes(q))
          .slice(0, params.limit || 10)
          .map(c => ({ id: c.id, title: c.title }));
        return { success: true, count: filtered.length, collections: filtered, defaults: DEFAULT_COLLECTIONS };
      }
      case 'info': {
        if (!collectionId) return { success: false, error: 'collectionId (or datasetId) required' };
        const col = await client.getCollection(collectionId);
        return { success: true, collection: col };
      }
      case 'filter': {
        if (!collectionId) return { success: false, error: 'collectionId (or datasetId) required' };
        const bbox = parseBbox(params.bbox as any);
        const datetime = params.startDate && params.endDate ? `${params.startDate}/${params.endDate}` : undefined;
        const query: Record<string, any> = {};
        if (typeof params.cloudCoverMax === 'number') query['eo:cloud_cover'] = { lt: params.cloudCoverMax };
        const items = await client.searchItems({ collections: [collectionId], bbox, datetime, limit: params.limit, query });
        const summary = items.slice(0, 5).map(i => ({
          id: i.id,
          datetime: i.properties?.datetime,
          bbox: i.bbox,
          quicklook: i.assets?.['rendered_preview']?.href || i.assets?.['thumbnail']?.href || null,
        }));
        return { success: true, collectionId, count: items.length, sample: summary };
      }
      case 'geometry': {
        // For AWS migration phase 1 we accept bbox or simple geojson string; admin boundaries move to S3 later
        const bbox = parseBbox(params.bbox as any);
        if (bbox) return { success: true, type: 'bbox', bbox };
        return { success: false, error: 'Provide bbox as "minLon,minLat,maxLon,maxLat" or [minLon,minLat,maxLon,maxLat]' };
      }
      case 'boundaries': {
        return {
          success: true,
          available: [
            { dataset: 'natural-earth-admin-0/1/2 (host on S3)', level: 'country/state/county' },
          ],
          message: 'Upload preprocessed GeoJSON boundaries to S3 and index in DynamoDB for name lookups.',
        };
      }
      default:
        return { success: false, error: `Unknown operation: ${op}` };
    }
  }
});
