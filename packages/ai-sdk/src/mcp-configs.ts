import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';

export enum HederaMCPServer {
  HEDERION_MCP_MAINNET = 'hederion-mcp-mainnet',
  HGRAPH_MCP_MAINNET = 'hgraph-mcp-mainnet',
  HEDERA_NETWORK_MCP_TESTNET = 'hedera-network-mcp-testnet',
}

export type MCPServerConfig =
  | {
      type: 'stdio';
      command: string;
      args: string[];
      env?: Record<string, string>;
    }
  | {
      type: 'http';
      url: string;
      /** Set to 'oauth' when the server requires OAuth 2.1 sign-in (e.g. wallet sign-in). */
      auth?: 'oauth';
    };

/**
 * OAuth options for MCP servers that require sign-in (`auth: 'oauth'`).
 */
export type MCPServerOAuthOptions = {
  /** Stores client registration, tokens and PKCE state, and handles the browser redirect. */
  authProvider: OAuthClientProvider;
  /** Resolves with the `code` returned to the OAuth redirect URL (e.g. via a local callback server). */
  waitForAuthorizationCode: () => Promise<string>;
};

export type MCPServerAuthMap = Partial<Record<HederaMCPServer, MCPServerOAuthOptions>>;

export const MCP_SERVER_CONFIGS: Record<HederaMCPServer, MCPServerConfig> = {
  [HederaMCPServer.HEDERION_MCP_MAINNET]: {
    type: 'http',
    url: 'https://hederion.com/mcp',
  },
  [HederaMCPServer.HGRAPH_MCP_MAINNET]: {
    type: 'http',
    url: `https://mainnet.hedera.api.hgraph.io/v1/${process.env.HGRAPH_API_KEY}/mcp`,
  },
  [HederaMCPServer.HEDERA_NETWORK_MCP_TESTNET]: {
    type: 'http',
    url: 'https://agentic-testnet-mcp.hedera.com/mcp',
    auth: 'oauth',
  },
};
