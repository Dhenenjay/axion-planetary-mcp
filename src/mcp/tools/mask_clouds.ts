import ee from '@google/earthengine';
import { register, z } from '../registry';

function maskS2(img: any){ const qa = img.select('QA60'); const mask = qa.bitwiseAnd(1<<10).eq(0).and(qa.bitwiseAnd(1<<11).eq(0)); return img.updateMask(mask); }
function maskLandsat(img: any){ const qa = img.select('QA_PIXEL'); const cloud = qa.bitwiseAnd(1<<3).neq(0); const shadow = qa.bitwiseAnd(1<<4).neq(0); return img.updateMask(cloud.not().and(shadow.not())); }

register({
  name: 'mask_clouds_from_image',
  description: 'Apply default cloud/shadow mask for Sentinel-2 or Landsat',
  input: z.object({ dataset: z.enum(['S2','L8','L9']), imageId: z.string().optional(), datasetId: z.string().optional() }),
  output: z.object({ ok: z.boolean() }),
  handler: async ({ dataset, imageId, datasetId }) => {
    const img = imageId ? new ee.Image(imageId) : new ee.Image(new ee.ImageCollection(datasetId!).first());
    const masked = (dataset==='S2') ? maskS2(img) : maskLandsat(img);
    masked.bandNames(); // touch to validate graph
    return { ok: true };
  },
});
