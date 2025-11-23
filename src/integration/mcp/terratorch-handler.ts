// TerraTorch handler for MCP
import { TerraTorchClient } from '@/src/terratorch';
import { PrithviModel } from '@/src/terratorch/prithvi';
import { SatMAEModel } from '@/src/terratorch/satmae';

export async function handleTerraTorchInference(args: any) {
  const { model = 'prithvi', data, options = {} } = args;
  
  if (!data) {
    throw new Error('Data is required for inference');
  }

  let modelInstance;
  
  if (model === 'prithvi') {
    modelInstance = new PrithviModel();
  } else if (model === 'satmae') {
    modelInstance = new SatMAEModel();
  } else {
    throw new Error(`Unknown model: ${model}`);
  }

  await modelInstance.load();
  const result = await modelInstance.inference(data);
  
  return {
    success: true,
    model,
    result,
    timestamp: new Date().toISOString()
  };
}
