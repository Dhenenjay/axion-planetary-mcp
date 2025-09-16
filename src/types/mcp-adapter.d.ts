declare module '@vercel/mcp-adapter' {
  export interface McpServerOptions {
    tools: {
      listTools: () => Promise<{ tools: Array<{ name: string; description: string }> }>;
      callTool: (name: string, input: any) => Promise<any>;
    };
  }

  export interface McpServer {
    sse(): Response;
  }

  export function createMcpServer(options: McpServerOptions): McpServer;
}
