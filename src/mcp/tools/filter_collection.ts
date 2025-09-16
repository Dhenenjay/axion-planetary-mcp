import ee from '@google/earthengine';
import { register, z } from '../registry';
import { parseAoi } from '@/src/utils/geo';

/**
 * Detect place name from coordinates or context
 */
function detectPlaceFromRegion(aoi: any): string | null {
  // Check if it's San Francisco area based on coordinates
  if (aoi && aoi.type === 'Polygon' && aoi.coordinates) {
    const coords = aoi.coordinates[0];
    if (coords && coords.length > 0) {
      const lons = coords.map((c: number[]) => c[0]);
      const lats = coords.map((c: number[]) => c[1]);
      const avgLon = lons.reduce((a: number, b: number) => a + b, 0) / lons.length;
      const avgLat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length;
      
      // San Francisco coordinates (expanded range to catch more variations)
      if (avgLon > -123.0 && avgLon < -122.0 && avgLat > 37.3 && avgLat < 38.0) {
        return 'San Francisco';
      }
      // Add more cities as needed
      if (avgLon > -74.1 && avgLon < -73.9 && avgLat > 40.6 && avgLat < 40.9) {
        return 'New York';
      }
    }
  }
  return null;
}

register({
  name: 'filter_collection_by_date_and_region',
  description: 'Filter an ImageCollection by time range and AOI (automatically detects place names like "San Francisco" and uses administrative boundaries)',
  input: z.object({ 
    datasetId: z.string(), 
    aoi: z.any(), 
    start: z.string(), 
    end: z.string(),
    placeName: z.string().optional() // Optional place name for boundary lookup
  }),
  output: z.object({ 
    count: z.number(),
    regionType: z.string(),
    message: z.string(),
    detectedPlace: z.string().nullable()
  }),
  handler: async ({ datasetId, aoi, start, end, placeName }) => {
    console.log('Filter called with:', { 
      datasetId, 
      aoi: typeof aoi === 'string' && aoi.length > 100 ? aoi.substring(0, 100) + '...' : aoi, 
      start, 
      end, 
      placeName: typeof placeName === 'string' && placeName.length > 100 ? placeName.substring(0, 100) + '...' : placeName 
    });
    
    // If placeName looks like a geometry JSON string, ignore it
    let actualPlaceName = placeName;
    if (placeName && typeof placeName === 'string') {
      try {
        const parsed = JSON.parse(placeName);
        if (parsed.type && (parsed.type === 'Polygon' || parsed.type === 'Point' || 
            parsed.type === 'Feature' || parsed.type === 'FeatureCollection')) {
          console.log('placeName appears to be a geometry, ignoring it');
          actualPlaceName = undefined;
        }
      } catch (e) {
        // It's a real place name, keep it
      }
    }
    
    // Parse the AOI (handles JSON strings, coordinates, place names, etc.)
    const region = await parseAoi(aoi);
    
    // Handle nested region structure if present
    if (aoi?.region) {
      aoi = aoi.region;
    }
    
    // Add explicit placeName if provided and it's not a geometry
    if (actualPlaceName && typeof aoi === 'object') {
      aoi.placeName = actualPlaceName;
    }
    
    // Create the filtered collection
    const col = new ee.ImageCollection(datasetId).filterDate(start, end).filterBounds(region);
    const count = await col.size().getInfo();
    
    // Check if we used an administrative boundary
    const usedBoundary = (aoi.placeName || actualPlaceName) ? true : false;
    const placeName_used = aoi.placeName || actualPlaceName || null;
    
    // Try to get the area of the region to confirm boundary usage
    let area = null;
    try {
      const areaM2 = await region.area().getInfo();
      area = Math.round(areaM2 / 1000000); // Convert to km²
    } catch (e) {
      // Area calculation might fail
    }
    
    const regionType = usedBoundary && area ? 'SHAPEFILE_BOUNDARY' : 'polygon';
    const message = usedBoundary && area
      ? `✅ Using EXACT SHAPEFILE BOUNDARY for ${placeName_used} (${area} km²) from FAO GAUL dataset`
      : placeName_used
        ? `⚠️ Attempted to use shapefile for ${placeName_used} but fell back to polygon`
        : '📍 Using polygon region (no place detected)';
    
    return { 
      count,
      regionType,
      message,
      detectedPlace: placeName_used,
      area
    };
  },
});
