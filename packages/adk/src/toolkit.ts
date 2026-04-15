import { HederaAgentAPI, Configuration, ToolDiscovery, type Tool } from '@hashgraph/hedera-agent-kit';
import { Client } from '@hiero-ledger/sdk';
import HederaAgentKitTool from './tool';
import type { BaseTool, ToolInputParameters } from '@google/adk';

class HederaADKToolkit {
    private hedera: HederaAgentAPI;
    private configuration: Configuration;

    tools: { [key: string]: BaseTool };

    constructor({ client, configuration }: { client: Client; configuration: Configuration }) {
        this.configuration = configuration;
        const context = configuration.context || {};
        const toolDiscovery = ToolDiscovery.createFromConfiguration(configuration);
        const allTools = toolDiscovery.getAllTools(context, configuration);
        this.hedera = new HederaAgentAPI(client, configuration.context, allTools);
        this.tools = {};

        allTools.forEach((tool: Tool) => {
            this.tools[tool.method] = HederaAgentKitTool(
                this.hedera,
                tool.method,
                tool.description,
                tool.parameters as unknown as ToolInputParameters,
            );
        });
    }

    getTools(): BaseTool[] {
        return Object.values(this.tools);
    }
}

export default HederaADKToolkit;
