import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import { HederaAgentAPI, type ToolType } from '@hashgraph/hedera-agent-kit';

class HederaAgentKitTool extends StructuredTool {
  hederaAPI: HederaAgentAPI;

  method: string;

  name: string;

  description: string;

  schema: z.ZodObject<any, any>;

  /** Classifies the tool's intent — see `TOOL_TYPE` from `@hashgraph/hedera-agent-kit`. */
  toolType?: ToolType;

  responseParsingFunction?: (response: any) => {};

  constructor(
    HederaAgentKitAPI: HederaAgentAPI,
    method: string,
    description: string,
    schema: z.ZodObject<any, any>,
    responseParsingFunction?: (response: any) => {},
    toolType?: ToolType,
  ) {
    super();

    this.hederaAPI = HederaAgentKitAPI;
    this.method = method;
    this.name = method;
    this.description = description;
    this.schema = schema;
    this.responseParsingFunction = responseParsingFunction;
    this.toolType = toolType;

    // Surface the real tool name to stream events as `event.metadata.hakToolName`
    // (on `on_tool_start`, event.name is the shared wrapper class). See README.
    this.metadata = { ...this.metadata, hakToolName: method };
  }

  _call(
    arg: z.output<typeof this.schema>,
    _runManager?: CallbackManagerForToolRun,
    _parentConfig?: RunnableConfig,
  ): Promise<any> {
    return this.hederaAPI.run(this.method, arg);
  }
}

export default HederaAgentKitTool;
