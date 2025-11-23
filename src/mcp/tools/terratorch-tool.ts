// TerraTorch MCP tool definition
export const terratorch InferenceTool = {
  name: 'terratorch_inference',
  description: 'Run inference using TerraTorch foundation models (Prithvi-100M, SatMAE) on satellite imagery',
  inputSchema: {
    type: 'object',
    properties: {
      model: {
        type: 'string',
        enum: ['prithvi', 'satmae'],
        description: 'Foundation model to use'
      },
      data: {
        type: 'object',
        description: 'Input data for inference'
      },
      options: {
        type: 'object',
        description: 'Inference options',
        properties: {
          batchSize: { type: 'number' },
          device: { type: 'string', enum: ['cpu', 'cuda'] }
        }
      }
    },
    required: ['data']
  }
};
