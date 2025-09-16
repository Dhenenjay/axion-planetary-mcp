import ee from '@google/earthengine';
import { register, z } from '../registry';

register({
  name: 'calculate_zonal_statistics',
  description: 'reduceRegions by zones',
  input: z.object({ imageId: z.string(), zonesAssetId: z.string(), scale: z.number().optional() }),
  output: z.object({ count: z.number() }),
  handler: async ({ imageId, zonesAssetId, scale }) => {
    const img = new ee.Image(imageId);
    const zones = new ee.FeatureCollection(zonesAssetId) as any;
    const out = img.reduceRegions({ collection: zones, reducer: ee.Reducer.mean(), scale: scale ?? 30 });
    const count = await out.size().getInfo();
    return { count };
  },
});
