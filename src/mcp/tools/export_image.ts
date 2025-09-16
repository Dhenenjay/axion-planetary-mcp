import ee from '@google/earthengine';
import { register, z } from '../registry';
import { exportImageToGCS, getTaskStatus } from '@/src/gee/tasks';
import { parseAoi } from '@/src/utils/geo';

register({
  name: 'export_image_to_cloud_storage',
  description: 'Start a GeoTIFF export to GCS (supports place names like "San Francisco")',
  input: z.object({ 
    imageId: z.string(), 
    bucket: z.string().optional(), 
    fileNamePrefix: z.string().optional(), 
    aoi: z.any().optional(),
    region: z.any().optional(), // Alternative to aoi
    scale: z.number().optional(), 
    crs: z.string().optional(),
    placeName: z.string().optional() // Optional place name for boundary lookup
  }),
  output: z.object({ 
    taskId: z.string(), 
    state: z.string().optional(),
    regionType: z.string()
  }),
  handler: async ({ imageId, bucket, fileNamePrefix, aoi, region: regionParam, scale, crs, placeName }) => {
    // Use aoi or region parameter
    const aoiInput = aoi || regionParam;
    
    // If placeName is provided, add it to aoi for boundary lookup
    if (placeName && typeof aoiInput === 'object') {
      aoiInput.placeName = placeName;
    }
    
    const image = new ee.Image(imageId); 
    const region = await parseAoi(aoiInput);
    const regionType = (aoiInput?.placeName || placeName) && region ? 'administrative_boundary' : 'polygon';
    
    // Use defaults if not provided
    const exportBucket = bucket || 'earth-engine-exports';
    const exportPrefix = fileNamePrefix || `export-${Date.now()}`;
    const exportScale = scale || 30;
    const exportCrs = crs || 'EPSG:4326';
    
    // Convert region to GeoJSON if it's a computed geometry
    let exportRegion = region;
    try {
      // Try to get the geometry info for export
      exportRegion = await region.getInfo();
    } catch (e) {
      // If that fails, use the original region
      exportRegion = region;
    }
    
    const { taskId } = exportImageToGCS({ 
      image, 
      description:`export-${exportPrefix}`, 
      bucket: exportBucket, 
      fileNamePrefix: exportPrefix, 
      region: exportRegion, 
      scale: exportScale, 
      crs: exportCrs 
    });
    const status = getTaskStatus(taskId);
    return { 
      taskId, 
      state: status.state,
      regionType
    };
  },
});
