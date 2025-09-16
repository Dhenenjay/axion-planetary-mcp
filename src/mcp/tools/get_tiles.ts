import ee from '@google/earthengine';
import { register, z } from '../registry';
import { getTileService } from '@/src/gee/client';

register({
  name: 'get_map_visualization_url',
  description: 'Get a TMS template for an image',
  input: z.object({ imageId: z.string(), visParams: z.record(z.any()).default({}) }),
  output: z.object({ mapId: z.string(), tileUrlTemplate: z.string(), ttlSeconds: z.number() }),
  handler: async ({ imageId, visParams }) => {
    const img = new ee.Image(imageId);
    return await getTileService(img, visParams);
  },
});
