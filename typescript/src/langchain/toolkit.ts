import { BaseToolkit } from '@langchain/core/tools';
import HederaAgentKitTool from '@/langchain/tool';
import HederaAgentKitAPI from '@/shared/api';
import { type Configuration } from '@/shared/configuration';
import { ToolDiscovery } from '@/shared/tool-discovery';
import { Client } from '@hashgraph/sdk';

class HederaLangchainToolkit implements BaseToolkit {
  private _hederaAgentKit: HederaAgentKitAPI;

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
        ),
    );
  }

  getTools(): HederaAgentKitTool[] {
    return this.tools;
  }

  getHederaAgentKitAPI(): HederaAgentKitAPI {
    return this._hederaAgentKit;
  }
}

export default HederaLangchainToolkit;
