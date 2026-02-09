import { HederaMCPServer } from './configuration';

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
  };

export const MCP_SERVER_CONFIGS: Record<HederaMCPServer, MCPServerConfig> = {
  [HederaMCPServer.HEDERION_MCP_MAINNET]: {
    type: 'http',
    url: 'https://hederion.com/mcp',
  },
  [HederaMCPServer.HGRAPH_MCP_MAINNET]: {
    type: 'http',
    url: `https://mainnet.hedera.api.hgraph.io/v1/${process.env.HGRAPH_API_KEY}/mcp`,
  },
};
