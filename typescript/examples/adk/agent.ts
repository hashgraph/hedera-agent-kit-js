import { Client, PrivateKey } from '@hashgraph/sdk';
import { LlmAgent } from '@google/adk';
import { AgentMode, HederaADKToolkit } from 'hedera-agent-kit';
import * as dotenv from 'dotenv';

dotenv.config();

const client = Client.forTestnet().setOperator(
  process.env.ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
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
    },
  },
});

export const agent = new LlmAgent({
  name: 'Hedera_Agent',
  description: 'An AI assistant that can interact with the Hedera network.',
  model: 'gemini-3.1-flash-lite-preview',
  instruction:
    'You are a helpful assistant talking to an user. You can transfer HBAR and interact with the Hedera network in other ways.',
  tools: hederaAgentToolkit.getTools(),
});
