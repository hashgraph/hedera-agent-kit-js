import { MultiServerMCPClient } from '@langchain/mcp-adapters';
import type { StructuredToolInterface } from '@langchain/core/tools';
import { HederaMCPServer } from '@/shared/configuration';
import { MCP_SERVER_CONFIGS } from '@/shared/mcp-configs';

/**
 * Loads tools from multiple MCP servers
 * @param serverNames - Array of preconfigured MCP server names
 * @returns Promise resolving to an array of LangChain tools from all servers
 */
export async function loadMultipleMCPTools(
  serverNames: HederaMCPServer[],
): Promise<StructuredToolInterface[]> {
  const mcpServers: Record<string, any> = {};

  for (const serverName of serverNames) {
    const config = MCP_SERVER_CONFIGS[serverName];
    if (!config) {
      throw new Error(`Unknown MCP server: ${serverName}`);
    }

    if (config.type === 'http') {
      mcpServers[serverName] = {
        type: 'http',
        url: config.url,
      };
    } else {
      mcpServers[serverName] = {
        type: 'stdio',
        command: config.command,
        args: config.args,
        env: config.env,
      };
    }
  }

  const mcpClient = new MultiServerMCPClient({
    throwOnLoadError: true,
    prefixToolNameWithServerName: false,
    useStandardContentBlocks: true,
    mcpServers,
  });

  return await mcpClient.getTools();
}
