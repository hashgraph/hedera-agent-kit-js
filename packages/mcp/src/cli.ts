// CRITICAL: Redirect stdout to stderr BEFORE importing anything
// This prevents any SDK console.log from polluting the MCP JSON-RPC channel
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = process.stderr.write.bind(process.stderr);

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LedgerId, Client, PrivateKey } from '@hashgraph/sdk';
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import type { Configuration, Context } from '@hashgraph/hedera-agent-kit';
import {
  coreAccountPlugin,
  coreTokenPlugin,
  coreConsensusPlugin,
  coreEVMPlugin,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusQueryPlugin,
  coreEVMQueryPlugin,
  coreMiscQueriesPlugin,
  coreTransactionQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
import HederaMCPToolkit from './toolkit';
import * as dotenv from 'dotenv';

const ALL_CORE_PLUGINS = [
  coreAccountPlugin,
  coreTokenPlugin,
  coreConsensusPlugin,
  coreEVMPlugin,
  coreAccountQueryPlugin,
  coreTokenQueryPlugin,
  coreConsensusQueryPlugin,
  coreEVMQueryPlugin,
  coreMiscQueriesPlugin,
  coreTransactionQueryPlugin,
];

const ACCEPTED_ARGS = ['agent-mode', 'account-id', 'public-key', 'tools', 'ledger-id'];

const VALID_TOOL_NAMES = new Set(
  ALL_CORE_PLUGINS.flatMap((plugin) => plugin.tools({}).map((tool) => tool.method)),
);

type Options = {
  tools?: string[];
  context?: Context;
  ledgerId?: LedgerId;
};

export function parseArgs(args: string[]): Options {
  const options: Options = {
    ledgerId: LedgerId.TESTNET,
    context: {},
  };

  args.forEach((arg) => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');

      if (key === 'tools') {
        const names = value.split(',');
        for (const name of names) {
          if (name !== 'all' && !VALID_TOOL_NAMES.has(name)) {
            throw new Error(
              `Invalid tool: ${name}. Use --tools=all to see available tools.`,
            );
          }
        }
        options.tools = names;
      } else if (key === 'agent-mode') {
        options.context!.mode = value as AgentMode;
      } else if (key === 'account-id') {
        options.context!.accountId = value;
      } else if (key === 'public-key') {
        options.context!.accountPublicKey = value;
      } else if (key === 'ledger-id') {
        if (value === 'testnet') {
          options.ledgerId = LedgerId.TESTNET;
        } else if (value === 'mainnet') {
          options.ledgerId = LedgerId.MAINNET;
        } else {
          throw new Error(
            `Invalid ledger id: ${value}. Accepted values are: testnet, mainnet`,
          );
        }
      } else {
        throw new Error(
          `Invalid argument: ${key}. Accepted arguments are: ${ACCEPTED_ARGS.join(', ')}`,
        );
      }
    }
  });

  return options;
}

function log(message: string, level: 'info' | 'error' | 'warn' = 'info') {
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  console.error(`${prefix} ${message}`);
}

export async function main() {
  dotenv.config();

  const options = parseArgs(process.argv.slice(2));
  let client: Client;

  if (options.ledgerId === LedgerId.TESTNET) {
    client = Client.forTestnet();
  } else {
    client = Client.forMainnet();
  }

  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;

  if (operatorId && operatorKey) {
    try {
      client.setOperator(operatorId, PrivateKey.fromStringDer(operatorKey));
      log(`Operator set: ${operatorId}`, 'info');
    } catch (error) {
      log(`Failed to set operator: ${error}`, 'error');
      throw error;
    }
  } else {
    log(
      'No operator credentials found in environment variables (HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY)',
      'warn',
    );
  }

  const configuration: Configuration = {
    tools: options.tools,
    context: options.context,
    plugins: ALL_CORE_PLUGINS,
  };

  const server = new HederaMCPToolkit({
    client: client,
    configuration: configuration,
  });

  // Restore stdout ONLY for MCP communication
  process.stdout.write = originalStdoutWrite;

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log('Hedera MCP Server running on stdio', 'info');
}

main().catch((error) => {
  log(`Error initializing Hedera MCP server: ${error.message}`, 'error');
  process.exit(1);
});
