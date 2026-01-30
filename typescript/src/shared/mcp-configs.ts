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
  // [HederaMCPServer.HEDERION_MCP_TESTNET]: {
  //   type: 'http',
  //   url: 'https://hederion.com/mcp',
  // },
  // [HederaMCPServer.HEDERION_MCP_MAINNET]: {
  //   type: 'http',
  //   url: 'https://hederion.com/mcp',
  // },
  // [HederaMCPServer.HGRAPH_MCP_TESTNET]: {
  //   type: 'http',
  //   url: 'https://hgraph.com/mcp',
  // },
  [HederaMCPServer.HGRAPH_MCP_MAINNET]: {
    type: 'http',
    url: 'https://hgraph.com/mcp',
  },
};
