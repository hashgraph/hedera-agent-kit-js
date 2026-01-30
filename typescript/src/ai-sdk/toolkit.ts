import HederaAgentAPI from '../shared/api';
import { type Configuration } from '@/shared';
import { ToolDiscovery } from '@/shared/tool-discovery';
import type { Tool, LanguageModelMiddleware } from 'ai';
import { Client } from '@hashgraph/sdk';
import HederaAgentKitTool from './tool';
import { loadMultipleMCPTools } from './hedera-mcps';

class HederaAIToolkit {
  private _hedera: HederaAgentAPI;
  private _configuration: Configuration;

  tools: { [key: string]: Tool };

  constructor({ client, configuration }: { client: Client; configuration: Configuration }) {
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

  getTools(): { [key: string]: Tool } {
    return this.tools;
  }
}

export default HederaAIToolkit;
