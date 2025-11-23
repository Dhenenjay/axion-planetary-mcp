// Unified handler for all integrations
import { handleDuckDBQuery } from './duckdb-handler';
import { handleTerraTorchInference } from './terratorch-handler';
import { handleEarthEngineQuery } from './earthengine-handler';

export async function handleIntegratedTool(tool: string, args: any) {
  switch (tool) {
    case 'duckdb_query':
      return handleDuckDBQuery(args);
    
    case 'terratorch_inference':
      return handleTerraTorchInference(args);
    
    case 'earth_engine_query':
      return handleEarthEngineQuery(args);
    
    case 'integrated_analysis':
      return handleIntegratedAnalysis(args);
    
    default:
      throw new Error(`Unknown integrated tool: ${tool}`);
  }
}

async function handleIntegratedAnalysis(args: any) {
  // Query Earth Engine data
  const eeData = await handleEarthEngineQuery({
    dataset: args.dataset,
    region: args.region,
    dateRange: args.dateRange
  });
  
  // Store in DuckDB for analysis
  await handleDuckDBQuery({
    query: `CREATE TABLE IF NOT EXISTS analysis_data AS SELECT * FROM ?`,
    params: [eeData]
  });
  
  // Run TerraTorch inference
  const inference = await handleTerraTorchInference({
    model: args.model || 'prithvi',
    data: eeData
  });
  
  return {
    success: true,
    earthEngineData: eeData,
    inference,
    timestamp: new Date().toISOString()
  };
}
