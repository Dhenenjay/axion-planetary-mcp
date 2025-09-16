import { list, get, register, z } from './registry';
import { initEarthEngineWithSA } from '@/src/gee/client';

export async function buildServer(){
  await initEarthEngineWithSA();
  await import('./tools');
  
  // Simple server object with direct method for tool calling
  const server = {
    callTool: async (name: string, args: any) => {
      const tool = get(name);
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }
      const result = await tool.handler(args);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
      };
    },
    listTools: () => {
      const tools = list();
      return {
        tools: tools.map((tool) => {
          const fullTool = get(tool.name);
          return {
            name: tool.name,
            description: tool.description,
            inputSchema: fullTool?.input || {},
          };
        }),
      };
    }
  };
  
  return server;
}

// Base health tool
register({
  name: 'health_check',
  description: 'Check server status',
  input: z.object({}).strict(),
  output: z.object({ status: z.string(), time: z.string() }),
  handler: async ()=> ({ status:'ok', time: new Date().toISOString() }),
});
