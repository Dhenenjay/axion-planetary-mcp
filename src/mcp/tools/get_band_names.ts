import ee from '@google/earthengine';
import { register, z } from '../registry';

register({
  name: 'get_dataset_band_names',
  description: 'Return band names for first image in a collection or an image asset',
  input: z.object({ datasetId: z.string() }),
  output: z.object({ bands: z.array(z.string()) }),
  handler: async ({ datasetId }) => {
    const col = new ee.ImageCollection(datasetId);
    const first = new ee.Image(col.first());
    const bands = await first.bandNames().getInfo();
    return { bands };
  },
});
