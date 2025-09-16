import ee from '@google/earthengine';
import { register, z } from '../registry';

register({
  name: 'auth_check',
  description: 'Verify Earth Engine initialization by fetching a trivial value',
  input: z.object({}).strict(),
  output: z.object({ initialized: z.boolean() }),
  handler: async () => {
    try {
      await new Promise<void>((resolve, reject) => new ee.Image(1).getInfo(()=>resolve(), reject));
      return { initialized: true };
    } catch { return { initialized: false }; }
  },
});
