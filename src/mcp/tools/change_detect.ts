import ee from '@google/earthengine';
import { register, z } from '../registry';

register({
  name: 'detect_change_between_images',
  description: 'Image difference (A - B)',
  input: z.object({ imageAId: z.string(), imageBId: z.string(), band: z.string().optional() }),
  output: z.object({ ok: z.boolean() }),
  handler: async ({ imageAId, imageBId, band }) => {
    let a = new ee.Image(imageAId); let b = new ee.Image(imageBId);
    if (band) { a = a.select(band); b = b.select(band); }
    const diff = a.subtract(b).rename('change');
    diff.bandNames();
    return { ok: true };
  },
});
