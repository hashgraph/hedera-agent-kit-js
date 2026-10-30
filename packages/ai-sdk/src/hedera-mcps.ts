import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { type Tool } from 'ai';
import {
  HederaMCPServer,
  MCP_SERVER_CONFIGS,
  type MCPServerAuthMap,
  type MCPServerConfig,
  type MCPServerOAuthOptions,
} from './mcp-configs';
import { ensureMcpAuthorized } from './mcp-auth';

/**
 * Loads MCP tools from a preconfigured MCP server
 * @param serverName - The name of the preconfigured MCP server
 * @param oauth - OAuth options, required for servers that need sign-in (e.g. the hosted Hedera Network MCP)
 * @returns Promise resolving to a record of AI SDK tools
 */
export async function loadMCPTools(
  serverName: HederaMCPServer,
  oauth?: MCPServerOAuthOptions,
): Promise<Record<string, Tool>> {
  const config = MCP_SERVER_CONFIGS[serverName];
  if (!config) {
    throw new Error(`Unknown MCP server: ${serverName}`);
  }

  if (config.type === 'http' && config.auth === 'oauth' && !oauth) {
    throw new Error(
      `MCP server ${serverName} requires OAuth sign-in. Pass \`mcpAuth\` with an authProvider for it.`,
    );
  }

  return await loadMCPToolsFromConfig(config, oauth);
}

/**
 * Loads MCP tools from a custom MCP server configuration
 * @param config - The MCP server configuration
 * @param oauth - OAuth options, used when the server config has `auth: 'oauth'`
 * @returns Promise resolving to a record of AI SDK tools
 */
export async function loadMCPToolsFromConfig(
  config: MCPServerConfig,
  oauth?: MCPServerOAuthOptions,
): Promise<Record<string, Tool>> {
  let transport;

  if (config.type === 'http') {
    if (config.auth === 'oauth') {
      if (!oauth) {
        throw new Error(`MCP server ${config.url} requires OAuth sign-in. Provide OAuth options.`);
      }
      await ensureMcpAuthorized(config.url, oauth);
    }
    transport = new StreamableHTTPClientTransport(new URL(config.url), {
      authProvider: oauth?.authProvider,
    });
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

  return (await mcpClient.tools()) as Record<string, Tool>;
}

/**
 * Loads tools from multiple MCP servers.
 * Servers are loaded one at a time so OAuth sign-ins never run concurrently (e.g. racing for the same callback port).
 * @param serverNames - Array of preconfigured MCP server names
 * @param mcpAuth - OAuth options for servers that require sign-in
 * @returns Promise resolving to a record of AI SDK tools from all servers
 */
export async function loadMultipleMCPTools(
  serverNames: HederaMCPServer[],
  mcpAuth: MCPServerAuthMap = {},
): Promise<Record<string, Tool>> {
  const tools: Record<string, Tool> = {};
  for (const serverName of serverNames) {
    Object.assign(tools, await loadMCPTools(serverName, mcpAuth[serverName]));
  }

  return tools;
}
