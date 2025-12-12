import axios, { AxiosInstance } from 'axios';
import { STAC_ENDPOINT } from '@/src/utils/aws-config';

export interface STACLink { rel: string; href: string; }
export interface STACCollection {
  id: string;
  title?: string;
  description?: string;
  extent?: any;
  links?: STACLink[];
}
export interface STACItem {
  id: string;
  bbox?: number[];
  geometry?: any;
  properties?: Record<string, any>;
  assets?: Record<string, { href: string; title?: string; type?: string }>;
}

export type SearchParams = {
  collections?: string[];
  bbox?: [number, number, number, number];
  datetime?: string; // e.g. 2024-06-01/2024-06-30
  limit?: number;
  query?: Record<string, any>; // e.g. { "eo:cloud_cover": { lt: 20 } }
};

export class STACClient {
  private http: AxiosInstance;
  private endpoint: string;

  constructor(endpoint = STAC_ENDPOINT) {
    this.endpoint = endpoint.replace(/\/$/, '');
    this.http = axios.create({ baseURL: this.endpoint, timeout: 20000 });
  }

  async listCollections(): Promise<STACCollection[]> {
    const { data } = await this.http.get('/collections');
    return (data.collections || []) as STACCollection[];
  }

  async getCollection(id: string): Promise<STACCollection> {
    const { data } = await this.http.get(`/collections/${encodeURIComponent(id)}`);
    return data as STACCollection;
  }

  async searchItems(params: SearchParams): Promise<STACItem[]> {
    const body: Record<string, any> = {};
    if (params.collections) body.collections = params.collections;
    if (params.bbox) body.bbox = params.bbox;
    if (params.datetime) body.datetime = params.datetime;
    if (params.limit) body.limit = params.limit;
    
    // Element84 uses filter extension with CQL2 syntax, not query
    // Skip query param for now - filter by cloud cover post-search if needed
    // if (params.query) body.query = params.query;

    const { data } = await this.http.post('/search', body);
    let features = (data.features || []) as STACItem[];
    
    // Post-filter by cloud cover if query specified
    if (params.query?.['eo:cloud_cover']?.lt !== undefined) {
      const maxCloud = params.query['eo:cloud_cover'].lt;
      features = features.filter(f => {
        const cc = f.properties?.['eo:cloud_cover'];
        return cc === undefined || cc < maxCloud;
      });
    }
    
    return features;
  }
}

export function parseBbox(input?: string | number[]): [number, number, number, number] | undefined {
  if (!input) return undefined;
  if (Array.isArray(input) && input.length === 4) return input as [number, number, number, number];
  if (typeof input === 'string') {
    const m = input.match(/\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*),\s*(-?\d+\.?\d*)\s*/);
    if (m) return [parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]), parseFloat(m[4])];
  }
  return undefined;
}

/**
 * Format datetime range for STAC API (RFC3339 format)
 */
export function formatDatetime(startDate?: string, endDate?: string): string | undefined {
  if (!startDate && !endDate) return undefined;
  
  const toRfc3339 = (date: string, isEnd = false) => {
    if (date.includes('T')) return date;
    return isEnd ? `${date}T23:59:59Z` : `${date}T00:00:00Z`;
  };
  
  if (startDate && endDate) {
    return `${toRfc3339(startDate)}/${toRfc3339(endDate, true)}`;
  } else if (startDate) {
    return `${toRfc3339(startDate)}/..`;
  } else if (endDate) {
    return `../${toRfc3339(endDate, true)}`;
  }
  return undefined;
}
