/**
 * Geocoding Service - Get Place Boundaries
 * 
 * Uses OpenStreetMap Nominatim API to:
 * - Search for places by name
 * - Get exact polygon boundaries (not just bounding boxes)
 * - Support cities, countries, states, neighborhoods, etc.
 * 
 * Nominatim is free and doesn't require an API key.
 */

import https from 'https';

// Nominatim API endpoint (free, no API key needed)
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

// Required user agent for Nominatim (they block requests without one)
const USER_AGENT = 'Axion-AWS-MCP/1.0 (https://github.com/axion-mcp)';

// Rate limiting - Nominatim requires max 1 request per second
let lastRequestTime = 0;

/**
 * Rate limit helper - ensures max 1 request per second to Nominatim
 */
async function rateLimit(): Promise<void> {
  const now = Date.now();
  const elapsed = now - lastRequestTime;
  if (elapsed < 1100) {
    await new Promise(resolve => setTimeout(resolve, 1100 - elapsed));
  }
  lastRequestTime = Date.now();
}

/**
 * Make HTTPS request to Nominatim
 */
function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const urlObj = new URL(url);
    
    const options = {
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'GET',
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'application/json'
      }
    };
    
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Invalid JSON response: ${data.substring(0, 100)}`));
        }
      });
    });
    
    req.on('error', reject);
    req.setTimeout(30000, () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });
    req.end();
  });
}

export interface GeocodingResult {
  placeId: string;
  osmId?: string;
  osmType?: string;
  displayName: string;
  type: string;
  placeClass: string;
  importance: number;
  bbox: [number, number, number, number]; // [west, south, east, north]
  geometry: GeoJSON.Geometry;
  hasPolygon: boolean;
  address?: {
    city?: string;
    county?: string;
    state?: string;
    country?: string;
    countryCode?: string;
  };
}

export interface PlaceBoundary {
  name: string;
  type: string;
  geometry: GeoJSON.Geometry;
  bbox: [number, number, number, number];
  hasPolygon: boolean;
  osmId?: string;
  address?: Record<string, string>;
}

/**
 * Geocode a place name and return matching results with boundaries
 */
export async function geocodePlace(
  placeName: string,
  options: {
    country?: string;
    state?: string;
    limit?: number;
    viewbox?: [number, number, number, number]; // [west, south, east, north]
    bounded?: boolean; // restrict results to viewbox
  } = {}
): Promise<GeocodingResult[]> {
  await rateLimit();
  
  const { country, state, limit = 5, viewbox, bounded } = options;
  
  // Build query
  const queryParts = [placeName];
  if (state) queryParts.push(state);
  if (country) queryParts.push(country);
  const query = queryParts.join(', ');
  
  const params = new URLSearchParams({
    q: query,
    format: 'json',
    polygon_geojson: '1', // Request polygon boundaries!
    limit: limit.toString(),
    addressdetails: '1'
  });
  
  // Narrow search to a viewbox if provided (mimics EE centroid/buffer strategy)
  if (viewbox) {
    params.set('viewbox', `${viewbox[0]},${viewbox[3]},${viewbox[2]},${viewbox[1]}`); // left,top,right,bottom
    if (bounded) params.set('bounded', '1');
  }
  
  const url = `${NOMINATIM_URL}/search?${params}`;
  console.error(`[Geocode] Searching: ${query}`);
  
  try {
    const results = await fetchJson(url);
    
    if (!Array.isArray(results) || results.length === 0) {
      console.error(`[Geocode] No results for: ${query}`);
      return [];
    }
    
    // Process results
    const processed: GeocodingResult[] = results.map((r: any) => {
      const bbox: [number, number, number, number] = [
        parseFloat(r.boundingbox[2]), // west (minx)
        parseFloat(r.boundingbox[0]), // south (miny)
        parseFloat(r.boundingbox[3]), // east (maxx)
        parseFloat(r.boundingbox[1])  // north (maxy)
      ];
      
      let geometry: GeoJSON.Geometry;
      let hasPolygon = false;
      
      if (r.geojson && ['Polygon', 'MultiPolygon'].includes(r.geojson.type)) {
        geometry = r.geojson;
        hasPolygon = true;
      } else if (r.geojson) {
        geometry = r.geojson;
      } else {
        // Fallback to point
        geometry = {
          type: 'Point',
          coordinates: [parseFloat(r.lon), parseFloat(r.lat)]
        };
      }
      
      return {
        placeId: r.place_id?.toString(),
        osmId: r.osm_id?.toString(),
        osmType: r.osm_type,
        displayName: r.display_name,
        type: r.type,
        placeClass: r.class,
        importance: parseFloat(r.importance || '0'),
        bbox,
        geometry,
        hasPolygon,
        address: r.address ? {
          city: r.address.city || r.address.town || r.address.village,
          county: r.address.county,
          state: r.address.state,
          country: r.address.country,
          countryCode: r.address.country_code
        } : undefined
      };
    });
    
    console.error(`[Geocode] Found ${processed.length} results for: ${query}`);
    return processed;
  } catch (error: any) {
    console.error(`[Geocode] Error: ${error.message}`);
    throw new Error(`Geocoding failed: ${error.message}`);
  }
}

/**
 * Get the boundary polygon for a place - the main function for getting exact boundaries
 */
export async function getPlaceBoundary(
  placeName: string,
  options: {
    country?: string;
    state?: string;
    adminLevel?: 'city' | 'county' | 'state' | 'country';
    preferPolygon?: boolean;
    viewbox?: [number, number, number, number];
    bounded?: boolean;
  } = {}
): Promise<PlaceBoundary> {
  const { country, state, adminLevel, preferPolygon = true, viewbox, bounded } = options;
  
  let results = await geocodePlace(placeName, { country, state, limit: 10, viewbox, bounded });
  
  if (results.length === 0) {
    throw new Error(`Place not found: ${placeName}`);
  }
  
  // Filter and sort results
  if (preferPolygon) {
    const polygonResults = results.filter(r => r.hasPolygon);
    if (polygonResults.length > 0) {
      results = polygonResults;
    }
  }
  
  // Filter by admin level if specified
  if (adminLevel) {
    const levelMap: Record<string, string[]> = {
      city: ['city', 'town', 'village', 'municipality', 'administrative'],
      county: ['county', 'district'],
      state: ['state', 'province', 'region'],
      country: ['country']
    };
    const allowedTypes = levelMap[adminLevel.toLowerCase()] || [];
    if (allowedTypes.length > 0) {
      const filtered = results.filter(r => 
        allowedTypes.includes(r.type) || allowedTypes.includes(r.placeClass)
      );
      if (filtered.length > 0) {
        results = filtered;
      }
    }
  }
  
  // Sort by importance (higher = better match)
  results.sort((a, b) => b.importance - a.importance);
  
  const best = results[0];
  
  return {
    name: best.displayName,
    type: best.type,
    geometry: best.geometry,
    bbox: best.bbox,
    hasPolygon: best.hasPolygon,
    osmId: best.osmId,
    address: best.address
  };
}

/**
 * Get GeoJSON Feature for a place
 */
export async function getPlaceGeoJSON(
  placeName: string,
  options: {
    country?: string;
    state?: string;
  } = {}
): Promise<GeoJSON.Feature> {
  const boundary = await getPlaceBoundary(placeName, options);
  
  return {
    type: 'Feature',
    properties: {
      name: boundary.name,
      type: boundary.type,
      osmId: boundary.osmId,
      hasPolygon: boundary.hasPolygon
    },
    geometry: boundary.geometry,
    bbox: boundary.bbox
  };
}

/**
 * Detect if a string contains a place name and extract it
 * Common patterns: "Los Angeles", "California, USA", "Paris, France"
 */
export function detectPlaceName(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  
  // Check if it's a bbox string (numbers and commas)
  if (/^-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*,-?\d+\.?\d*$/.test(input.trim())) {
    return null; // It's a bbox, not a place name
  }
  
  // Check if it looks like a place name
  // Remove any numeric parts and see if text remains
  const cleaned = input.replace(/[-\d.,\s]+/g, ' ').trim();
  if (cleaned.length > 2) {
    return input.trim();
  }
  
  return null;
}

/**
 * Create a bounding box from a geometry
 */
export function geometryToBbox(geometry: GeoJSON.Geometry): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  
  const processCoords = (coords: any) => {
    if (Array.isArray(coords[0])) {
      coords.forEach(processCoords);
    } else {
      const [x, y] = coords;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  };
  
  if (geometry.type === 'Point') {
    const [x, y] = geometry.coordinates as [number, number];
    return [x - 0.1, y - 0.1, x + 0.1, y + 0.1];
  }
  
  processCoords((geometry as any).coordinates);
  
  return [minX, minY, maxX, maxY];
}

/**
 * Simplify a GeoJSON geometry to reduce vertex count
 * Uses Douglas-Peucker-like reduction
 */
export function simplifyGeometry(
  geometry: GeoJSON.Geometry,
  tolerance: number = 0.001
): GeoJSON.Geometry {
  if (geometry.type === 'Point') return geometry;
  
  const simplifyRing = (coords: number[][]): number[][] => {
    if (coords.length <= 4) return coords;
    
    const result: number[][] = [coords[0]];
    let lastKept = 0;
    
    for (let i = 1; i < coords.length - 1; i++) {
      const d = Math.sqrt(
        Math.pow(coords[i][0] - coords[lastKept][0], 2) +
        Math.pow(coords[i][1] - coords[lastKept][1], 2)
      );
      
      if (d > tolerance) {
        result.push(coords[i]);
        lastKept = i;
      }
    }
    
    result.push(coords[coords.length - 1]);
    return result;
  };
  
  if (geometry.type === 'Polygon') {
    return {
      type: 'Polygon',
      coordinates: (geometry.coordinates as number[][][]).map(simplifyRing)
    };
  }
  
  if (geometry.type === 'MultiPolygon') {
    return {
      type: 'MultiPolygon',
      coordinates: (geometry.coordinates as number[][][][]).map(
        poly => poly.map(simplifyRing)
      )
    };
  }
  
  return geometry;
}

// Common US cities to county mappings for faster lookup
const US_CITY_COUNTY_MAP: Record<string, { county: string; state: string }> = {
  'los angeles': { county: 'Los Angeles County', state: 'California' },
  'san francisco': { county: 'San Francisco', state: 'California' },
  'new york': { county: 'New York County', state: 'New York' },
  'chicago': { county: 'Cook County', state: 'Illinois' },
  'houston': { county: 'Harris County', state: 'Texas' },
  'phoenix': { county: 'Maricopa County', state: 'Arizona' },
  'philadelphia': { county: 'Philadelphia County', state: 'Pennsylvania' },
  'san antonio': { county: 'Bexar County', state: 'Texas' },
  'san diego': { county: 'San Diego County', state: 'California' },
  'dallas': { county: 'Dallas County', state: 'Texas' },
  'austin': { county: 'Travis County', state: 'Texas' },
  'seattle': { county: 'King County', state: 'Washington' },
  'denver': { county: 'Denver County', state: 'Colorado' },
  'boston': { county: 'Suffolk County', state: 'Massachusetts' },
  'miami': { county: 'Miami-Dade County', state: 'Florida' },
  'atlanta': { county: 'Fulton County', state: 'Georgia' },
  'detroit': { county: 'Wayne County', state: 'Michigan' },
  'portland': { county: 'Multnomah County', state: 'Oregon' },
  'las vegas': { county: 'Clark County', state: 'Nevada' }
};

/**
 * Get county boundary for a US city (optimized lookup)
 */
export async function getUSCityBoundary(cityName: string): Promise<PlaceBoundary | null> {
  const normalized = cityName.toLowerCase().trim();
  const mapping = US_CITY_COUNTY_MAP[normalized];
  
  if (mapping) {
    try {
      return await getPlaceBoundary(mapping.county, { state: mapping.state, country: 'USA' });
    } catch {
      // Fall through to regular geocoding
    }
  }
  
  return null;
}
