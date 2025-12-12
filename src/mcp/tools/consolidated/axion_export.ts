import { register, z } from '../../registry';
import { EXPORTS_BUCKET } from '@/src/utils/aws-config';

const ExportSchema = z.object({
  operation: z.enum(['thumbnail','tiles','export','status','help']),
  input: z.any().optional(),
  collectionId: z.string().optional(),
  datasetId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  bbox: z.union([z.array(z.number()).length(4), z.string()]).optional(),
});

register({
  name: 'axion_export',
  description: 'AWS export & visualization (placeholder) — thumbnails, tiles, export to S3, status',
  input: ExportSchema,
  output: z.any(),
  handler: async (params) => {
    if (params.operation === 'help') {
      return {
        success: true,
        bucket: EXPORTS_BUCKET,
        operations: ['thumbnail','tiles','export','status'],
        note: 'COG export and TiTiler tiles will be wired in subsequent phases.'
      };
    }
    return { success: false, error: `Operation '${params.operation}' not yet implemented in axion_export` };
  }
});
