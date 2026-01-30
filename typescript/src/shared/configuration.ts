import { IHederaMirrornodeService } from './hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { Plugin } from './plugin';

export enum AgentMode {
  AUTONOMOUS = 'autonomous',
  RETURN_BYTES = 'returnBytes',
}

// Context are settings that are applied to all requests made by the integration.
export type Context = {
  // Account is a Connected Account ID. If set, the integration will
  // make requests for this Account.
  accountId?: string;
  // Account Public Key is either passed in configuration or fetched based on the passed accountId
  accountPublicKey?: string;

  // defines if the agent executes the transactions or returns the raw transaction bytes
  mode?: AgentMode;

  // Mirrornode config
  mirrornodeService?: IHederaMirrornodeService;
};

export type Configuration = {
  //if empty, all tools will be used.
  tools?: string[];
  //external plugins to load
  plugins?: Plugin[];
  context?: Context;
  // this is a list of preconfigured MCP servers to fetch tools from
  mcpServers?: HederaMCPServer[];
};

export enum HederaMCPServer {
  // HEDERION_MCP_TESTNET = 'hederion-mcp-testnet',
  HEDERION_MCP_MAINNET = 'hederion-mcp-mainnet',
  // HGRAPH_MCP_TESTNET = 'hgraph-mcp-testnet',
  // HGRAPH_MCP_MAINNET = 'hgraph-mcp-mainnet',
}
