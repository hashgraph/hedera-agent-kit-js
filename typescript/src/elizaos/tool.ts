import {
  Action,
  ActionExample,
  ActionResult,
  composePromptFromState,
  Handler,
  type HandlerCallback,
  type IAgentRuntime,
  logger,
  type Memory,
  ModelType,
  type State,
  Validator,
} from '@elizaos/core';
import { Client } from '@hashgraph/sdk';
import type { Tool } from '@/shared/tools';
import { Context } from '@/shared/configuration';
import { generateExtractionTemplate } from '@/elizaos/utils/extraction';
import { customParseJSONObjectFromText } from '@/elizaos/utils/parser';

class HederaAgentKitTool implements Action {
  description: string;
  handler: Handler;
  similes?: string[] | undefined;
  examples?: ActionExample[][] | undefined;
  name: string;
  validate: Validator;

  constructor(client: Client, context: Context, tool: Tool) {
    const parameterSchema = tool.parameters;
    this.description = tool.description;

    // Set Action properties
    this.name = tool.method.toUpperCase();
    this.similes = [tool.method.toUpperCase()];
    this.validate = async (_runtime: IAgentRuntime, _message: Memory) => true;

    this.handler = async (
      runtime: IAgentRuntime,
      _message: Memory,
      state: State | undefined,
      _options: any,
      callback?: HandlerCallback,
    ): Promise<ActionResult> => {
      logger.log(`Running ${tool.method} handler...`);
      if (!state) {
        throw new Error('State is undefined');
      }

      // create an extraction prompt for extracting tool parameters from recent user messages
      const prompt = composePromptFromState({
        state,
        template: generateExtractionTemplate(tool),
      });
      logger.debug(`prompt: ${prompt}`);

      // execute extraction prompt
      const modelOutput = await runtime.useModel(ModelType.TEXT_LARGE, { prompt });
      logger.debug(`Model extraction output: ${modelOutput}`);

      // custom parsing params from Markdown JSON notation to JS object
      const parsedParams = customParseJSONObjectFromText(modelOutput) as Record<string, any>;
      logger.debug('Parsed params object', parsedParams);

      // validating parameters with tools input zod schema
      const validation = parameterSchema.safeParse(parsedParams); // parsing extracted params before calling a tool
      logger.debug('Validated params:' + JSON.stringify(validation, null, 2));

      // print error if validation failed
      if (!validation.success) {
        // call llm to generate a comprehensive message to the user about missing params
        const promptText = `given the recent messages {{recent_messages}}, 
        tool description: ${tool.description}
        and the error message: ${validation.error.format()}
        generate a comprehensive message to the user about missing params
        `;

        const modelOutput = await runtime.useModel(ModelType.TEXT_LARGE, { promptText });
        if (callback) {
          await callback({
            text: modelOutput,
            content: { error: validation.error.format() },
          });
        }
        return {
          success: false,
          text: modelOutput,
          error: validation.error.toString(),
        };
      }

      // call the action
      try {
        const result = await tool.execute(client, context, validation.data);
        const responseText = result.humanMessage; // extract the human-readable response provided by the tool

        if (callback) {
          await callback({
            text: responseText,
            content: result,
          });
        }

        return { success: true, text: responseText };
      } catch (err) {
        // handle other errors
        const message = err instanceof Error ? err.message : 'Unknown error';
        logger.error(`Error running tool ${tool.method}:`, err);

        if (callback) {
          await callback({
            text: `Execution failed: ${message}`,
            content: { error: message },
          });
        }

        return { success: false, text: `Execution failed: ${message}`, error: message };
      }
    };
  }
}

export default HederaAgentKitTool;
