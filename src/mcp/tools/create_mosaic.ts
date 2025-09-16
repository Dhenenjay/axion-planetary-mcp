import ee from '@google/earthengine';
import { register, z } from '../registry';

register({
  name: 'create_clean_mosaic',
  description: 'Create a median composite',
  input: z.object({ datasetId: z.string(), start: z.string(), end: z.string() }),
  output: z.object({ ok: z.boolean() }),
  handler: async ({ datasetId, start, end }) => {
    const img = new ee.ImageCollection(datasetId).filterDate(start, end).median();
    img.bandNames();
    return { ok: true };
  },
});
