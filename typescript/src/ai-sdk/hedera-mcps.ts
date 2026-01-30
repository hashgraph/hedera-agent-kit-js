import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Tool } from 'ai';
import { HederaMCPServer } from '@/shared/configuration';
import { MCP_SERVER_CONFIGS, type MCPServerConfig } from '@/shared/mcp-configs';

/**
 * Loads MCP tools from a preconfigured MCP server
 * @param serverName - The name of the preconfigured MCP server
 * @returns Promise resolving to a record of AI SDK tools
 */
export async function loadMCPTools(serverName: HederaMCPServer): Promise<Record<string, Tool>> {
  const config = MCP_SERVER_CONFIGS[serverName];
  if (!config) {
    throw new Error(`Unknown MCP server: ${serverName}`);
  }

  return await loadMCPToolsFromConfig(config);
}

/**
 * Loads MCP tools from a custom MCP server configuration
 * @param config - The MCP server configuration
 * @returns Promise resolving to a record of AI SDK tools
 */
export async function loadMCPToolsFromConfig(config: MCPServerConfig): Promise<Record<string, Tool>> {
  let transport;

  if (config.type === 'http') {
    transport = new StreamableHTTPClientTransport(new URL(config.url));
  } else {
    transport = new Experimental_StdioMCPTransport({
      command: config.command,
      args: config.args,
      env: config.env,
    });
  }

  const mcpClient = await experimental_createMCPClient({
    transport,
  });

  return await mcpClient.tools() as Record<string, Tool>;
}

/**
 * Loads tools from multiple MCP servers
 * @param serverNames - Array of preconfigured MCP server names
 * @returns Promise resolving to a record of AI SDK tools from all servers
 */
export async function loadMultipleMCPTools(
  serverNames: HederaMCPServer[],
): Promise<Record<string, Tool>> {
  const toolPromises = serverNames.map(serverName => loadMCPTools(serverName));
  const toolRecords = await Promise.all(toolPromises);

  return Object.assign({}, ...toolRecords);
}
