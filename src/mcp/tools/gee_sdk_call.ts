import ee from '@google/earthengine';
import { register, z } from '../registry';

const Op = z.enum(['filterDate','filterBounds','select','clip','addBands','expression']);
register({
  name: 'gee_sdk_call',
  description: 'Allow-listed generic EE ops sequence (fallback)',
  input: z.object({ datasetId: z.string(), ops: z.array(z.object({ op: Op, params: z.record(z.any()) })) }),
  output: z.object({ ok: z.boolean() }),
  handler: async ({ datasetId, ops }) => {
    let obj: any = new ee.ImageCollection(datasetId);
    for (const step of ops) {
      if (step.op === 'filterDate') obj = obj.filterDate(step.params.start, step.params.end);
      else if (step.op === 'filterBounds') obj = obj.filterBounds(step.params.aoi);
      else if (step.op === 'select') obj = obj.select(step.params.bands);
    }
    obj.size(); // touch
    return { ok: true };
  },
});
