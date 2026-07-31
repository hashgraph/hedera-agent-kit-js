import { Plugin, Context } from '@hashgraph/hedera-agent-kit';
import exampleGreetingTool, {
  EXAMPLE_GREETING_TOOL,
} from './tools/greeting/example-greeting-tool';
import exampleHbarTransferTool, {
  EXAMPLE_HBAR_TRANSFER_TOOL,
} from './tools/hbar/example-hbar-transfer-tool';

export const examplePlugin: Plugin = {
  name: 'example-plugin',
  version: '1.0.0',
  description:
    'An example plugin demonstrating the v4 BaseTool pattern for Hedera Agent Kit. ' +
    'BaseTool-based tools are fully compatible with hooks and policies.',
  tools: (context: Context) => [
    exampleGreetingTool(context),
    exampleHbarTransferTool(context),
  ],
};

export { exampleGreetingTool, exampleHbarTransferTool, EXAMPLE_GREETING_TOOL, EXAMPLE_HBAR_TRANSFER_TOOL };

export const examplePluginToolNames = {
  EXAMPLE_GREETING_TOOL,
  EXAMPLE_HBAR_TRANSFER_TOOL,
} as const;

export default examplePlugin;
