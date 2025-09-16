import vm from 'vm';
import ee from '@google/earthengine';
import { register, z } from '../registry';

register({
  name: 'gee_script_js',
  description: 'Execute small EE JS snippets in a sandbox (fallback)',
  input: z.object({ codeJs: z.string().min(5) }),
  output: z.object({ ok: z.boolean(), result: z.any().optional(), warnings: z.array(z.string()).optional() }),
  handler: async ({ codeJs }) => {
    const sandbox = { ee, result: null };
    vm.createContext(sandbox);
    vm.runInContext(codeJs, sandbox, { timeout: 3000 });
    return { ok: true, result: sandbox.result ?? null, warnings: ['Sandboxed; quotas apply'] };
  },
});
