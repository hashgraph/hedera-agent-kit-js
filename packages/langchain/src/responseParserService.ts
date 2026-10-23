import { BaseMessage, ToolMessage } from '@langchain/core/messages';
import { toUint8Array, classifyToolResult, isPolicyBlockedToolResult, type ToolResultStatus } from '@hashgraph/hedera-agent-kit';
import HederaAgentKitTool from './tool';

// RETURN_BYTES output is JSON text, so `bytes` arrives as a Buffer/numeric-keyed object rather
// than a Uint8Array (see toUint8Array). Normalize it so consumers get a ready-to-sign Uint8Array.
function convertBytes(data: any): any {
  if (data?.raw?.bytes !== undefined && !(data.raw.bytes instanceof Uint8Array)) {
    return { ...data, raw: { ...data.raw, bytes: toUint8Array(data.raw.bytes) } };
  }
  if (data?.bytes !== undefined && !(data.bytes instanceof Uint8Array)) {
    return { ...data, bytes: toUint8Array(data.bytes) };
  }
  return data;
}

/**
 * This interface defines the shape of the object response from the agent.
 */
export type AgentResponse = {
  messages: BaseMessage[];
};

type ParsingFunction = (content: string) => {};

class ResponseParserService {
  processedMessageIds: Set<string>;
  tools: HederaAgentKitTool[];
  parsingMap: Map<string, ParsingFunction>;

  constructor(tools: HederaAgentKitTool[]) {
    this.tools = tools;
    this.processedMessageIds = new Set<string>();
    this.parsingMap = this.createParsingMap(tools);
  }

  /**
   * Creates a map of tool names to their respective parsing functions.
   */
  createParsingMap(tools: HederaAgentKitTool[]): Map<string, ParsingFunction> {
    const map = new Map<string, ParsingFunction>();
    for (const tool of tools) {
      if (tool.responseParsingFunction) {
        map.set(tool.name, tool.responseParsingFunction);
      } else {
        console.error(`Tool: ${tool.name}, does not define a responseParsingFunction!`);
      }
    }
    return map;
  }

  /**
   * Type guard to check if a message is a ToolMessage.
   * We check for `type === 'tool'` and the properties that a ToolMessage has.
   */
  private isToolMessage(message: BaseMessage): message is ToolMessage {
    return message.type === 'tool' && 'tool_call_id' in message && 'name' in message;
  }

  /**
   * Parses all new ToolMessages in the response and returns an array of
   * structured data objects from the tool calls.
   */
  parseNewToolMessages(response: AgentResponse): any[] {
    const allParsedData: any[] = [];

    if (!response || !response.messages) {
      return allParsedData;
    }

    // Iterate over all messages in the response
    for (const message of response.messages) {
      // The `id` property on BaseMessage is the unique UUID
      const messageId = message.id;
      if (!messageId) {
        continue;
      }

      // Skip if already processed
      if (this.processedMessageIds.has(messageId)) {
        continue;
      }

      if (this.isToolMessage(message)) {
        this.processedMessageIds.add(messageId); // mark message as processed

        const toolName = message.name;
        const parsingFunction = this.parsingMap.get(toolName!); // determine parsing function

        if (parsingFunction) {
          try {
            // 'content' on a ToolMessage is the stringified JSON
            const parsedData = parsingFunction(message.content as string);

            allParsedData.push({
              toolName: toolName,
              toolCallId: message.tool_call_id,
              parsedData: convertBytes(parsedData),
            });
          } catch (error) {
            console.error(`Failed to parse content for tool ${toolName}:`, error);
          }
        } else {
          console.warn(`No parsing function found for tool: ${toolName}`);
          try {
            console.warn(`Parsing with default JSON.parse for tool: ${toolName}`);
            const parsedData = JSON.parse(message.content as string);
            allParsedData.push({
              toolName: toolName,
              toolCallId: message.tool_call_id,
              parsedData: convertBytes(parsedData),
            });
          } catch (error) {
            console.error(
              `Failed to parse content for tool ${toolName} with missing parsing function:`,
              error,
            );
          }
        }
      }
    }

    return allParsedData;
  }

  /**
   * Parse all new ToolMessages and return only those that were blocked by a policy.
   *
   * Internally calls {@link parseNewToolMessages} (which applies the same dedup logic
   * via `processedMessageIds`), then classifies each parsed envelope and filters to
   * `kind: 'policy_block'` results. The structured `policyName`, `stage`, `details`,
   * etc. fields are available on each entry.
   *
   * @example
   * ```ts
   * const parser = new ResponseParserService(toolkit.getTools());
   * const { messages } = await agent.invoke(input);
   *
   * const blocks = parser.parsePolicyBlocks({ messages });
   * for (const block of blocks) {
   *   switch (block.policyName) {
   *     case 'Grant Amount Policy':
   *       await queueForAdminReview({ details: block.details });
   *       break;
   *     case 'Grant Review Policy':
   *       throw new Error('Review metadata failed policy');
   *   }
   * }
   * ```
   *
   * @param response - The agent response object with a `messages` array.
   */
  parsePolicyBlocks(response: AgentResponse): Extract<ToolResultStatus, { kind: 'policy_block' }>[] {
    const parsed = this.parseNewToolMessages(response);
    return parsed
      .map(({ parsedData }) => {
        // parsedData is the { raw, humanMessage } envelope (bytes already hydrated)
        if (typeof parsedData?.humanMessage === 'string' && parsedData?.raw !== undefined) {
          return classifyToolResult(parsedData as { raw: any; humanMessage: string });
        }
        return { kind: 'unknown' as const, humanMessage: '' } satisfies ToolResultStatus;
      })
      .filter(
        (r): r is Extract<ToolResultStatus, { kind: 'policy_block' }> =>
          r.kind === 'policy_block',
      );
  }

  /**
   * Quick boolean check — returns `true` if *any* new tool message in the response
   * was blocked by a policy.
   *
   * Note: this marks the matched messages as processed in `processedMessageIds`,
   * just like {@link parseNewToolMessages} does. Create a fresh `ResponseParserService`
   * instance per request if you need idempotent checks.
   */
  hasPolicyBlocks(response: AgentResponse): boolean {
    const parsed = this.parseNewToolMessages(response);
    return parsed.some(({ parsedData }) => {
      if (typeof parsedData?.humanMessage === 'string' && parsedData?.raw !== undefined) {
        return isPolicyBlockedToolResult(parsedData as { raw: any; humanMessage: string });
      }
      return false;
    });
  }
}

export default ResponseParserService;
