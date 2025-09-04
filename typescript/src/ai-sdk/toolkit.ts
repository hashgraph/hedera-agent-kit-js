import HederaAgentAPI from '../shared/api';
import { type Configuration } from '@/shared';
import { ToolDiscovery } from '@/shared/tool-discovery';
import type { Tool, LanguageModelV1Middleware } from 'ai';
import { Client } from '@hashgraph/sdk';
import HederaAgentKitTool from './tool';

class HederaAIToolkit {
  private _hedera: HederaAgentAPI;

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
  }

  middleware(): LanguageModelV1Middleware {
    return {
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
