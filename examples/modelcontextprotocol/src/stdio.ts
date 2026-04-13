// CRITICAL: Redirect stdout to stderr BEFORE importing anything
// This prevents any SDK console.log from polluting the MCP JSON-RPC channel
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = process.stderr.write.bind(process.stderr);

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { LedgerId, Client, PrivateKey } from '@hashgraph/sdk';
import {
  AgentMode,
} from '@hashgraph/hedera-agent-kit';
import {
  coreAccountPlugin,
  coreAccountPluginToolNames,
  coreConsensusPlugin,
  coreConsensusPluginToolNames,
  coreTokenPlugin,
  coreTokenPluginToolNames,
  coreAccountQueryPlugin,
  coreAccountQueryPluginToolNames,
  coreEVMPlugin,
  coreEVMPluginToolNames,
  coreTokenQueryPlugin,
  coreTokenQueryPluginToolNames,
  coreConsensusQueryPlugin,
  coreConsensusQueryPluginToolNames,
  coreEVMQueryPlugin,
  coreEVMQueryPluginToolNames,
  coreMiscQueriesPlugin,
  coreMiscQueriesPluginsToolNames,
  coreTransactionQueryPlugin,
  coreTransactionQueryPluginToolNames,
} from '@hashgraph/hedera-agent-kit/plugins';
import { HederaMCPToolkit } from '@hashgraph/hedera-agent-kit-mcp';
import type { Configuration, Context } from '@hashgraph/hedera-agent-kit';

import * as dotenv from 'dotenv';

dotenv.config();

type Options = {
  tools?: string[];
  context?: Context;
  ledgerId?: LedgerId;
};


const ACCEPTED_ARGS = ['agent-mode', 'account-id', 'public-key', 'tools', 'ledger-id'];
const ACCEPTED_TOOLS = [
  ...Object.values(coreTokenPluginToolNames),
  ...Object.values(coreAccountPluginToolNames),
  ...Object.values(coreConsensusPluginToolNames),
  ...Object.values(coreAccountQueryPluginToolNames),
  ...Object.values(coreEVMPluginToolNames),
  ...Object.values(coreTokenQueryPluginToolNames),
  ...Object.values(coreConsensusQueryPluginToolNames),
  ...Object.values(coreEVMQueryPluginToolNames),
  ...Object.values(coreMiscQueriesPluginsToolNames),
  ...Object.values(coreTransactionQueryPluginToolNames),
];

// Helper function for stderr logging without colors when in MCP mode
function log(message: string, level: 'info' | 'error' | 'warn' = 'info') {
  const prefix = level === 'error' ? '❌' : level === 'warn' ? '⚠️' : '✅';
  console.error(`${prefix} ${message}`);
}

export function parseArgs(args: string[]): Options {
  const options: Options = {
    ledgerId: LedgerId.TESTNET,
    context: {},
  };

  args.forEach(arg => {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');

      if (key == 'tools') {
        options.tools = value.split(',');
      } else if (key == 'agent-mode') {
        options.context!.mode = value as AgentMode;
      } else if (key == 'account-id') {
        options.context!.accountId = value;
      } else if (key == 'public-key') {
        options.context!.accountPublicKey = value;
      } else if (key == 'ledger-id') {
        if (value == 'testnet') {
          options.ledgerId = LedgerId.TESTNET;
        } else if (value == 'mainnet') {
          options.ledgerId = LedgerId.MAINNET;
        } else {
          throw new Error(`Invalid ledger id: ${value}. Accepted values are: testnet, mainnet`);
        }
      } else {
        throw new Error(
          `Invalid argument: ${key}. Accepted arguments are: ${ACCEPTED_ARGS.join(', ')}`,
        );
      }
    }
  });

  // Validate tools against accepted enum values
  options.tools?.forEach((tool: string) => {
    if (tool == 'all') {
      return;
    }
    if (!ACCEPTED_TOOLS.includes(tool.trim() as any)) {
      throw new Error(`Invalid tool: ${tool}. Accepted tools are: ${ACCEPTED_TOOLS.join(', ')}`);
    }
  });

  return options;
}

function handleError(error: any) {
  log(`Error initializing Hedera MCP server: ${error.message}`, 'error');
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  let client: Client;

  if (options.ledgerId == LedgerId.TESTNET) {
    client = Client.forTestnet();
  } else {
    client = Client.forMainnet();
  }

  // Set operator from environment variables if they exist
  const operatorId = process.env.HEDERA_OPERATOR_ID;
  const operatorKey = PrivateKey.fromStringDer(process.env.HEDERA_OPERATOR_KEY!);

  if (operatorId && operatorKey) {
    try {
      client.setOperator(operatorId, operatorKey);
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
    plugins: [
      coreTokenPlugin,
      coreAccountPlugin,
      coreConsensusPlugin,
      coreAccountQueryPlugin,
      coreEVMPlugin,
      coreTokenQueryPlugin,
      coreConsensusQueryPlugin,
      coreEVMQueryPlugin,
      coreMiscQueriesPlugin,
      coreTransactionQueryPlugin,
    ],
  };

  const server = new HederaMCPToolkit({
    client: client,
    configuration: configuration,
  });

  // Restore stdout ONLY for MCP communication
  process.stdout.write = originalStdoutWrite;

  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Only log to stderr - stdout is reserved for MCP JSON-RPC communication
  log('Hedera MCP Server running on stdio', 'info');
}

main().catch(error => {
  handleError(error);
  process.exit(1);
});
