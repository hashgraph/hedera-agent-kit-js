import { Client, PrivateKey } from '@hashgraph/sdk';
import { LlmAgent } from '@google/adk';
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import { HederaADKToolkit } from '@hashgraph/hedera-agent-kit-adk';
import * as dotenv from 'dotenv';
import {
  coreAccountPlugin,
  coreConsensusPlugin,
  coreAccountQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';

dotenv.config();

const client = Client.forTestnet().setOperator(
  process.env.ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!),
  // PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!), // Use this line if you have an ED25519 key
);

// Prepare Hedera toolkit with core tools AND custom plugin
const hederaAgentToolkit = new HederaADKToolkit({
  client,
  configuration: {
    plugins: [coreAccountPlugin, coreAccountQueryPlugin, coreConsensusPlugin], // Load selected plugins
    tools: [], // Load all tools from selected plugins
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
