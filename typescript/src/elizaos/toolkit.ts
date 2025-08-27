import { Client } from '@hashgraph/sdk';
import { Configuration, Context } from '@/shared/configuration';
import { ToolDiscovery } from '@/shared/tool-discovery';
import HederaAgentKitTool from '@/elizaos/tool';

export class HederaElizaOSToolkit {
  private readonly tools: HederaAgentKitTool[];
  private readonly client: Client;
  private readonly context: Context;

  constructor({ client, configuration }: { client: Client; configuration: Configuration }) {
    this.client = client;
    this.context = configuration.context || {};
    const toolDiscovery = ToolDiscovery.createFromConfiguration(configuration);
    const allTools = toolDiscovery.getAllTools(this.context, configuration);

    this.tools = allTools.map(tool => new HederaAgentKitTool(this.client, this.context, tool));
  }

  /**
   * Maps hedera-agent-kit tools and returns ElizaOS compatible actions
   */
  getTools(): HederaAgentKitTool[] {
    return this.tools;
  }
}
