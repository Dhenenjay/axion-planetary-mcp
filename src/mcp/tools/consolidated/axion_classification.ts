import { register, z } from '../../registry';

const ClfSchema = z.object({
  operation: z.enum(['classify','train','evaluate','export','help']),
  region: z.string().optional(),
  classifier: z.string().optional(),
  numberOfTrees: z.number().optional(),
});

register({
  name: 'axion_classification',
  description: 'AWS crop/landcover classification (placeholder) — to be backed by Fargate service',
  input: ClfSchema,
  output: z.any(),
  handler: async (params) => {
    if (params.operation === 'help') {
      return {
        success: true,
        operations: ['classify','train','evaluate','export'],
        note: 'Will use scikit-learn/XGBoost on ECS Fargate; this is a scaffold.'
      };
    }
    return { success: false, error: `Operation '${params.operation}' not yet implemented in axion_classification` };
  }
});
