import ee from '@google/earthengine';
import { register, z } from '../registry';
import { parseAoi } from '@/src/utils/geo';

register({
  name: 'calculate_summary_statistics',
  description: 'reduceRegion over AOI',
  input: z.object({ imageId: z.string(), aoi: z.any(), scale: z.number().optional() }),
  output: z.object({ stats: z.record(z.number()).nullable() }),
  handler: async ({ imageId, aoi, scale }) => {
    const img = new ee.Image(imageId);
    const region = await parseAoi(aoi);
    const reducers = ee.Reducer.mean().combine({ reducer2: ee.Reducer.stdDev(), sharedInputs: true });
    const dict = await img.reduceRegion({ reducer: reducers, geometry: region, scale: scale ?? 30, maxPixels: 1e8 }).getInfo();
    return { stats: dict ?? null };
  },
});
