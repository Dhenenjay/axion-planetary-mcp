import ee from '@google/earthengine';
import { register, z } from '../registry';
register({
  name: 'load_cloud_optimized_geotiff',
  description: 'Load a public/service-readable COG from GCS into EE',
  input: z.object({ gcsUrl: z.string().url() }),
  output: z.object({ ok: z.boolean(), note: z.string().optional() }),
  handler: async ({ gcsUrl }) => {
    // Basic presence check; EE throws on invalid
    ee.Image.loadGeoTIFF(gcsUrl);
    return { ok: true, note: 'Ensure bucket IAM/region compatible' };
  },
});
