import { z } from 'zod';
type Handler = (input:any)=>Promise<any>;
type Tool = { name:string; description:string; input: any; output: any; handler: Handler; };
const tools = new Map<string, Tool>();
export function register(tool: Tool){ tools.set(tool.name, tool); }
export function list(){ return [...tools.values()].map(t=>({name:t.name, description:t.description})); }
export function get(name:string){ const t=tools.get(name); if(!t) throw new Error(`Tool not found: ${name}`); return t; }
export { z };
