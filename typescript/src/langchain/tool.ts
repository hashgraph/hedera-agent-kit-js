import { z } from 'zod';
import { StructuredTool } from '@langchain/core/tools';
import { CallbackManagerForToolRun } from '@langchain/core/callbacks/manager';
import { RunnableConfig } from '@langchain/core/runnables';
import HederaAgentKitAPI from '@/shared/api';

class HederaAgentKitTool extends StructuredTool {
  hederaAPI: HederaAgentKitAPI;

  method: string;

  name: string;

  description: string;

  schema: z.ZodObject<any, any>;

  responseParsingFunction?: (response: any) => {};

  constructor(
    HederaAgentKitAPI: HederaAgentKitAPI,
    method: string,
    description: string,
    schema: z.ZodObject<any, any>,
    responseParsingFunction: (response: any) => {},
  ) {
    super();

    this.hederaAPI = HederaAgentKitAPI;
    this.method = method;
    this.name = method;
    this.description = description;
    this.schema = schema;
    this.responseParsingFunction = responseParsingFunction;
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
