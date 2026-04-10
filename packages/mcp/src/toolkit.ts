import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@hashgraph/sdk';
import { HederaAgentAPI, type Configuration, ToolDiscovery } from '@hashgraph/hedera-agent-kit';
import { RequestHandlerExtra } from '@modelcontextprotocol/sdk/shared/protocol.js';

class HederaMCPToolkit extends McpServer {
  private _hederaAgentKit: HederaAgentAPI;

  constructor({ client, configuration }: { client: Client; configuration: Configuration }) {
    super({
      name: 'Hedera Agent Kit',
      version: '0.1.0',
    });

    const context = configuration.context || {};
    const toolDiscovery = ToolDiscovery.createFromConfiguration(configuration);
    const allTools = toolDiscovery.getAllTools(context, configuration);
    this._hederaAgentKit = new HederaAgentAPI(client, configuration.context, allTools);

    allTools.map(tool => {
      this.registerTool(
        tool.method,
        {
          description: tool.description,
          inputSchema: tool.parameters.shape,
        },
        async (arg: any, _extra: RequestHandlerExtra<any, any>) => {
          const result = await this._hederaAgentKit.run(tool.method, arg);
          return {
            content: [
              {
                type: 'text' as const,
                text: String(result),
              },
            ],
          };
        },
      );
    });
  }
}

export default HederaMCPToolkit;
