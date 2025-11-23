// Integrated analysis MCP tool
export const integratedAnalysisTool = {
  name: 'integrated_analysis',
  description: 'Perform integrated analysis combining Earth Engine data, DuckDB queries, and TerraTorch inference',
  inputSchema: {
    type: 'object',
    properties: {
      dataset: {
        type: 'string',
        description: 'Earth Engine dataset to query'
      },
      region: {
        type: 'object',
        description: 'Geographic region of interest'
      },
      dateRange: {
        type: 'object',
        properties: {
          start: { type: 'string' },
          end: { type: 'string' }
        }
      },
      model: {
        type: 'string',
        enum: ['prithvi', 'satmae'],
        description: 'TerraTorch model for inference'
      },
      analysisType: {
        type: 'string',
        enum: ['classification', 'change_detection', 'segmentation'],
        description: 'Type of analysis to perform'
      }
    },
    required: ['dataset', 'region']
  }
};
