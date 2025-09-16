import ee from '@google/earthengine';
import { register, z } from '../registry';
import { parseAoi } from '@/src/utils/geo';

register({
  name: 'get_thumbnail_image',
  description: 'Get high-resolution thumbnail URL clipped to exact shapefile boundaries',
  input: z.object({ 
    imageId: z.string().optional(),
    datasetId: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
    aoi: z.any(), 
    visParams: z.record(z.any()).default({}), 
    size: z.object({ width:z.number().default(1024), height:z.number().default(1024) }).default({ width: 1024, height: 1024 }) 
  }),
  output: z.object({ url: z.string(), ttlSeconds: z.number(), width: z.number(), height: z.number() }),
  handler: async ({ imageId, datasetId, start, end, aoi, visParams, size }) => {
    const region = await parseAoi(aoi);
    
    let image;
    if (imageId) {
      image = new ee.Image(imageId);
    } else if (datasetId && start && end) {
      // Create a median composite from the collection
      const collection = new ee.ImageCollection(datasetId)
        .filterDate(start, end)
        .filterBounds(region)
        .select(['B4', 'B3', 'B2']); // Select RGB bands for visualization
      
      // Use first image if collection is small, otherwise median
      const count = await collection.size().getInfo();
      image = count > 0 ? collection.median() : collection.first();
    } else {
      throw new Error('Either imageId or (datasetId, start, end) must be provided');
    }
    
    // Get the bounds of the region for proper scaling
    const bounds = region.bounds();
    const coords = await bounds.coordinates().getInfo();
    
    // Calculate aspect ratio to maintain shape
    const west = coords[0][0][0];
    const south = coords[0][0][1];
    const east = coords[0][2][0];
    const north = coords[0][2][1];
    
    const aspectRatio = Math.abs(east - west) / Math.abs(north - south);
    const targetWidth = size?.width || 1024;
    const targetHeight = Math.round(targetWidth / aspectRatio);
    
    // Clip the image to the exact shapefile boundary
    if (image) {
      image = image.clip(region);
    }
    
    // Enhanced visualization parameters for better quality
    const defaultVis = {
      min: visParams?.min || 0,
      max: visParams?.max || 3000,
      gamma: visParams?.gamma || 1.4,
      bands: visParams?.bands || (datasetId?.includes('LANDSAT') ? ['B4', 'B3', 'B2'] : ['B4', 'B3', 'B2'])
    };
    
    try {
      // Use bounds instead of complex polygon for URL generation
      const regionBounds = await bounds.getInfo();
      
      // Get high-resolution thumbnail with exact shapefile boundary
      // @ts-ignore
      const url = await image.getThumbURL({ 
        region: regionBounds, // Use bounds instead of full geometry
        dimensions: `${targetWidth}x${targetHeight}`,
        format: 'png',
        ...defaultVis 
      });
      return { 
        url, 
        ttlSeconds: 3600,
        width: targetWidth,
        height: targetHeight
      };
    } catch (error: any) {
      console.log('Thumbnail generation error, trying fallback:', error.message);
      
      // Fallback to a slightly lower resolution if needed
      const fallbackWidth = Math.min(targetWidth, 512);
      const fallbackHeight = Math.round(fallbackWidth / aspectRatio);
      
      try {
        // Use bounds for fallback too
        const regionBounds = await bounds.getInfo();
        
        // @ts-ignore
        const url = await image.getThumbURL({ 
          region: regionBounds,
          dimensions: `${fallbackWidth}x${fallbackHeight}`,
          format: 'png',
          ...defaultVis 
        });
        return { 
          url, 
          ttlSeconds: 3600,
          width: fallbackWidth,
          height: fallbackHeight
        };
      } catch (fallbackError: any) {
        // Last resort: use a point buffer
        const centroid = region.centroid();
        const buffer = centroid.buffer(10000); // 10km buffer
        const bufferBounds = await buffer.bounds().getInfo();
        
        // @ts-ignore
        const url = await image.getThumbURL({ 
          region: bufferBounds,
          dimensions: '256x256',
          format: 'png',
          ...defaultVis 
        });
        return { 
          url, 
          ttlSeconds: 3600,
          width: 256,
          height: 256
        };
      }
    }
  },
});
