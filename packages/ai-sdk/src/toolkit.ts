import { HederaAgentAPI, type Configuration, ToolDiscovery } from '@hashgraph/hedera-agent-kit';
import type { Tool, LanguageModelMiddleware } from 'ai';
import { Client } from '@hiero-ledger/sdk';
import HederaAgentKitTool, { type HederaAITool } from './tool';
import { loadMultipleMCPTools } from './hedera-mcps';
import { HederaMCPServer } from './mcp-configs';

type AISdkConfiguration = Configuration & {
  mcpServers?: HederaMCPServer[];
};

class HederaAIToolkit {
  private _hedera: HederaAgentAPI;
  private _configuration: AISdkConfiguration;

  tools: { [key: string]: HederaAITool };

  constructor({ client, configuration }: { client: Client; configuration: AISdkConfiguration }) {
    const context = configuration.context || {};
    const toolDiscovery = ToolDiscovery.createFromConfiguration(configuration);
    const allTools = toolDiscovery.getAllTools(context, configuration);
    this._hedera = new HederaAgentAPI(client, configuration.context, allTools);
    this.tools = {};

    allTools.forEach(tool => {
      this.tools[tool.method] = HederaAgentKitTool(
        this._hedera,
        tool.method,
        tool.description,
        tool.parameters,
        tool.toolType,
      );
    });
    this._configuration = configuration;
  }

  /**
   * Asynchronously loads tools from configured MCP servers.
   * This allows for explicit loading of external tools independent of the core HAK tools.
   */
  async getMcpTools(): Promise<Record<string, Tool>> {
    const enabledMcps = this._configuration.mcpServers || [];
    if (enabledMcps.length === 0) return {};

    return await loadMultipleMCPTools(enabledMcps);
  }

  middleware(): LanguageModelMiddleware {
    return {
      specificationVersion: 'v3',
      wrapGenerate: async ({ doGenerate }) => {
        return doGenerate();
      },
      wrapStream: async ({ doStream }) => {
        // Pre-processing can be added here if needed
        return doStream();
      },
    };
  }

  getTools(): { [key: string]: HederaAITool } {
    return this.tools;
  }
}

export default HederaAIToolkit;
