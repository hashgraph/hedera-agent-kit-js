import { BaseToolkit, type StructuredToolInterface } from '@langchain/core/tools';
import HederaAgentKitTool from './tool';
import { HederaAgentAPI } from '@hashgraph/hedera-agent-kit';
import { type Configuration, ToolDiscovery } from '@hashgraph/hedera-agent-kit';
import { Client } from '@hashgraph/sdk';
import { loadMultipleMCPTools } from './hedera-mcps';
import { HederaMCPServer } from './mcp-configs';

type LangchainConfiguration = Configuration & {
  mcpServers?: HederaMCPServer[];
};

class HederaLangchainToolkit implements BaseToolkit {
  private _hederaAgentKit: HederaAgentAPI;
  private _configuration: LangchainConfiguration;

  tools: HederaAgentKitTool[];

  constructor({
    client,
    configuration,
  }: {
    client: Client;
    configuration: LangchainConfiguration;
  }) {
    const context = configuration.context || {};
    const toolDiscovery = ToolDiscovery.createFromConfiguration(configuration);
    const allTools = toolDiscovery.getAllTools(context, configuration);

    this._hederaAgentKit = new HederaAgentAPI(client, configuration.context, allTools);
    this.tools = allTools.map(
      tool =>
        new HederaAgentKitTool(
          this._hederaAgentKit,
          tool.method,
          tool.description,
          tool.parameters,
          tool.outputParser,
        ),
    );
    this._configuration = configuration;
  }

  getTools(): HederaAgentKitTool[] {
    return this.tools;
  }

  /**
   * Asynchronously loads tools from configured MCP servers.
   * This allows for explicit loading of external tools independent of the core HAK tools.
   */
  async getMcpTools(): Promise<StructuredToolInterface[]> {
    const enabledMcps = this._configuration.mcpServers || [];
    if (enabledMcps.length === 0) return [];

    return await loadMultipleMCPTools(enabledMcps);
  }

  getHederaAgentKitAPI(): HederaAgentAPI {
    return this._hederaAgentKit;
  }
}

export default HederaLangchainToolkit;
