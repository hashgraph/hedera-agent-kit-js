import { Client, PrivateKey } from '@hashgraph/sdk';
import { LlmAgent } from '@google/adk';
import {
  AgentMode,
  HederaADKToolkit,
  HcsAuditTrailHook,
  coreAccountQueryPluginToolNames,
  coreAccountPluginToolNames,
} from 'hedera-agent-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const client = Client.forTestnet().setOperator(
  process.env.ACCOUNT_ID!,
  PrivateKey.fromStringDer(process.env.PRIVATE_KEY!),
  // PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!), // Use this line if you have an ED25519 key
);

const topicId = '0.0.???';
const auditTrailHook = new HcsAuditTrailHook(
  [
    coreAccountQueryPluginToolNames.GET_ACCOUNT_QUERY_TOOL,
    coreAccountPluginToolNames.CREATE_ACCOUNT_TOOL,
    coreAccountPluginToolNames.DELETE_ACCOUNT_TOOL,
    coreAccountPluginToolNames.UPDATE_ACCOUNT_TOOL,
  ],
  topicId,
);

// Prepare Hedera toolkit with core tools AND custom plugin
const hederaAgentToolkit = new HederaADKToolkit({
  client,
  configuration: {
    plugins: [], // Load all plugins
    tools: [], // Load all tools
    context: {
      mode: AgentMode.AUTONOMOUS,
      accountId: process.env.ACCOUNT_ID!,
      hooks: [auditTrailHook],
    },
  },
});

export const agent = new LlmAgent({
  name: 'Hedera_Agent_with_audit_hook',
  description: 'An AI assistant that can interact with the Hedera network.',
  model: 'gemini-3.1-flash-lite-preview',
  instruction:
    'You are a helpful assistant talking to an user. You can transfer HBAR and interact with the Hedera network in other ways.',
  tools: hederaAgentToolkit.getTools(),
});
