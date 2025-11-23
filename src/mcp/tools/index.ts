// Export all MCP tools
export { duckdbQueryTool } from './duckdb-tool';
export { terratorchInferenceTool } from './terratorch-tool';
export { integratedAnalysisTool } from './integrated-analysis-tool';

export const allIntegratedTools = [
  duckdbQueryTool,
  terratorchInferenceTool,
  integratedAnalysisTool
];
