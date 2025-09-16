import { register, z } from '../registry';
import { getTaskStatus } from '@/src/gee/tasks';

register({
  name: 'get_export_task_status',
  description: 'Poll status of an export task',
  input: z.object({ taskId: z.string() }),
  output: z.object({ state: z.string().nullable(), progress: z.number().nullable(), errorMessage: z.string().nullable() }),
  handler: async ({ taskId }) => {
    const s = getTaskStatus(taskId);
    return { state: s.state ?? null, progress: s.progress ?? null, errorMessage: s.errorMessage ?? null };
  },
});
