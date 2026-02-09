import { BaseToolkit, type StructuredToolInterface } from '@langchain/core/tools';
import HederaAgentKitTool from '@/langchain/tool';
import HederaAgentKitAPI from '@/shared/api';
import { type Configuration } from '@/shared/configuration';
import { ToolDiscovery } from '@/shared/tool-discovery';
import { Client } from '@hashgraph/sdk';
import { loadMultipleMCPTools } from './hedera-mcps';

class HederaLangchainToolkit implements BaseToolkit {
  private _hederaAgentKit: HederaAgentKitAPI;
  private _configuration: Configuration;

  tools: HederaAgentKitTool[];

  constructor({ client, configuration }: { client: Client; configuration: Configuration }) {
    const context = configuration.context || {};
    const toolDiscovery = ToolDiscovery.createFromConfiguration(configuration);
    const allTools = toolDiscovery.getAllTools(context, configuration);

    this._hederaAgentKit = new HederaAgentKitAPI(client, configuration.context, allTools);
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

  getHederaAgentKitAPI(): HederaAgentKitAPI {
    return this._hederaAgentKit;
  }
}

export default HederaLangchainToolkit;
