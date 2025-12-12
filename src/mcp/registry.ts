import { z, ZodType } from 'zod';
import { zodToJsonSchema } from 'zod-to-json-schema';

type Handler = (input:any)=>Promise<any>;
type Tool = { name:string; description:string; input: ZodType<any>; output: any; handler: Handler; };
const tools = new Map<string, Tool>();

export function register(tool: Tool){ tools.set(tool.name, tool); }

export function list() { 
  return [...tools.values()].map(t => {
    // Convert Zod schema to JSON Schema for MCP
    const jsonSchema = zodToJsonSchema(t.input, { target: 'openApi3' });
    return {
      name: t.name, 
      description: t.description,
      inputSchema: jsonSchema
    };
  }); 
}

export function get(name:string){ 
  const t = tools.get(name); 
  if(!t) throw new Error(`Tool not found: ${name}`); 
  return t; 
}

export { z };
