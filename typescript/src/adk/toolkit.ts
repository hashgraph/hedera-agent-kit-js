import HederaAgentAPI from '../shared/api';
import { type Configuration } from '@/shared';
import { ToolDiscovery } from '@/shared/tool-discovery';
import { Client } from '@hashgraph/sdk';
import HederaAgentKitTool from './tool';
import type { BaseTool, ToolInputParameters } from '@google/adk';

class HederaADKToolkit {
    private _hedera: HederaAgentAPI;
    private _configuration: Configuration;

    tools: { [key: string]: BaseTool };

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
                tool.parameters as unknown as ToolInputParameters,
            );
        });
        this._configuration = configuration;
    }

    getTools(): BaseTool[] {
        return Object.values(this.tools);
    }
}

export default HederaADKToolkit;
