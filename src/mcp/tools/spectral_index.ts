import ee from '@google/earthengine';
import { register, z } from '../registry';

const IndexEnum = ['NDVI','EVI','NDWI'] as const;

// Default band mappings for common datasets
const DEFAULT_MAPPINGS: Record<string, {nir: string, red: string, green: string, blue?: string}> = {
  'COPERNICUS/S2': { nir: 'B8', red: 'B4', green: 'B3', blue: 'B2' },
  'COPERNICUS/S2_SR': { nir: 'B8', red: 'B4', green: 'B3', blue: 'B2' },
  'COPERNICUS/S2_SR_HARMONIZED': { nir: 'B8', red: 'B4', green: 'B3', blue: 'B2' },
  'LANDSAT/LC08': { nir: 'B5', red: 'B4', green: 'B3', blue: 'B2' },
  'LANDSAT/LC09': { nir: 'B5', red: 'B4', green: 'B3', blue: 'B2' },
  'LANDSAT/LE07': { nir: 'B4', red: 'B3', green: 'B2', blue: 'B1' },
  'MODIS': { nir: 'sur_refl_b02', red: 'sur_refl_b01', green: 'sur_refl_b04' }
};

function getDefaultMapping(imageId: string) {
  // Try to match the dataset from the image ID
  for (const [dataset, mapping] of Object.entries(DEFAULT_MAPPINGS)) {
    if (imageId.startsWith(dataset)) {
      return mapping;
    }
  }
  // Default Sentinel-2 mapping as fallback
  return DEFAULT_MAPPINGS['COPERNICUS/S2_SR_HARMONIZED'];
}

register({
  name: 'calculate_spectral_index',
  description: 'Compute NDVI/EVI/NDWI',
  input: z.object({ 
    imageId: z.string(), 
    index: z.enum(IndexEnum), 
    mapping: z.object({ 
      nir:z.string(), 
      red:z.string(), 
      green:z.string().optional(), 
      blue:z.string().optional() 
    }).optional() 
  }),
  output: z.object({ ok: z.boolean(), index: z.string(), bands: z.any() }),
  handler: async ({ imageId, index, mapping }) => {
    // Use provided mapping or get default based on image ID
    const bandMapping = mapping || getDefaultMapping(imageId);
    
    const img = new ee.Image(imageId);
    let out = img;
    
    if(index==='NDVI') {
      out = img.expression('(NIR-RED)/(NIR+RED)', {
        NIR: img.select(bandMapping.nir), 
        RED: img.select(bandMapping.red)
      }).rename('NDVI');
    }
    
    if(index==='EVI') {
      const blue = bandMapping.blue || bandMapping.green || bandMapping.red;
      out = img.expression('2.5*((NIR-RED)/(NIR+6*RED-7.5*BLUE+1))', {
        NIR: img.select(bandMapping.nir), 
        RED: img.select(bandMapping.red), 
        BLUE: img.select(blue)
      }).rename('EVI');
    }
    
    if(index==='NDWI') {
      out = img.expression('(GREEN-NIR)/(GREEN+NIR)', {
        GREEN: img.select(bandMapping.green || bandMapping.red), 
        NIR: img.select(bandMapping.nir)
      }).rename('NDWI');
    }
    
    out.projection(); // touch
    return { ok: true, index, bands: bandMapping };
  },
});
