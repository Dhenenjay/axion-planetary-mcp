import ee from '@google/earthengine';
import { register, z } from '../registry';
import { clampScale } from '@/src/utils/geo';

register({
  name: 'resample_image_to_resolution',
  description: 'Resample an image to a target scale',
  input: z.object({ imageId: z.string(), scale: z.number().positive() }),
  output: z.object({ ok: z.boolean(), scale: z.number() }),
  handler: async ({ imageId, scale }) => {
    const img = new ee.Image(imageId);
    const s = clampScale(scale);
    img.reproject({ scale: s });
    return { ok: true, scale: s };
  },
});
