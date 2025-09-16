import ee from '@google/earthengine';
import { register, z } from '../registry';

register({
  name: 'calculate_slope_and_aspect',
  description: 'Terrain products from DEM',
  input: z.object({ demAssetId: z.string() }),
  output: z.object({ ok: z.boolean() }),
  handler: async ({ demAssetId }) => {
    const dem = new ee.Image(demAssetId);
    const terr = ee.Terrain.products(dem);
    terr.select(['slope','aspect']).bandNames();
    return { ok: true };
  },
});
