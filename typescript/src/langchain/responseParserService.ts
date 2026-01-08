import { BaseMessage, ToolMessage } from '@langchain/core/messages';
import HederaAgentKitTool from '@/langchain/tool';

/**
 * This interface defines the shape of the object response from the agent.
 */
export interface AgentResponse {
  messages: BaseMessage[];
}

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
              parsedData: parsedData,
            });
          } catch (error) {
            console.error(`Failed to parse content for tool ${toolName}:`, error);
          }
        } else {
          console.warn(`No parsing function found for tool: ${toolName}`);
          try {
            console.warn(`Parsing with default JSON.parse for tool: ${toolName}`);
            allParsedData.push({
              toolName: toolName,
              toolCallId: message.tool_call_id,
              parsedData: JSON.parse(message.content as string),
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
}

export default ResponseParserService;
