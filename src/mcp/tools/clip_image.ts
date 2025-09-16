import ee from '@google/earthengine';
import { register, z } from '../registry';
import { parseAoi } from '@/src/utils/geo';

register({
  name: 'clip_image_to_region',
  description: 'Clip image by AOI (supports place names like "San Francisco")',
  input: z.object({ 
    imageId: z.string(), 
    aoi: z.any(),
    placeName: z.string().optional() // Optional place name for boundary lookup
  }),
  output: z.object({ 
    ok: z.boolean(),
    regionType: z.string(),
    message: z.string()
  }),
  handler: async ({ imageId, aoi, placeName }) => {
    // If placeName is provided, add it to aoi for boundary lookup
    if (placeName && typeof aoi === 'object') {
      aoi.placeName = placeName;
    }
    
    const img = new ee.Image(imageId);
    const region = await parseAoi(aoi);
    const regionType = aoi.placeName && region ? 'administrative_boundary' : 'polygon';
    
    img.clip(region).bandNames();
    
    return { 
      ok: true,
      regionType,
      message: regionType === 'administrative_boundary' 
        ? `Clipped to exact boundary of ${aoi.placeName}`
        : 'Clipped to polygon region'
    };
  },
});
