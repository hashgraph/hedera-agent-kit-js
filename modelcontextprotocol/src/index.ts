#!/usr/bin/env node

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import colors from "colors";
const { green, red, yellow } = colors;

import { LedgerId, Client } from "@hashgraph/sdk";
import {
  AgentMode,
  Configuration,
  Context,
  coreAccountPlugin,
  coreAccountPluginToolNames,
  coreConsensusPlugin,
  coreConsensusPluginToolNames,
  coreTokenPlugin,
  coreTokenPluginToolNames,
  coreQueriesPlugin,
  coreQueriesPluginToolNames,
  HederaMCPToolkit,
} from "hedera-agent-kit";

type Options = {
  tools?: string[];
  context?: Context;
  ledgerId?: LedgerId;
};

// all the available tools
const {
  CREATE_FUNGIBLE_TOKEN_TOOL,
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
} = coreTokenPluginToolNames;

const { TRANSFER_HBAR_TOOL } = coreAccountPluginToolNames;

const { CREATE_TOPIC_TOOL, SUBMIT_TOPIC_MESSAGE_TOOL } =
  coreConsensusPluginToolNames;

const {
  GET_HBAR_BALANCE_QUERY_TOOL,
  GET_ACCOUNT_QUERY_TOOL,
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
  GET_TOPIC_MESSAGES_QUERY_TOOL,
} = coreQueriesPluginToolNames;

const ACCEPTED_ARGS = [
  "agent-mode",
  "account-id",
  "public-key",
  "tools",
  "ledger-id",
];
const ACCEPTED_TOOLS = [
  CREATE_FUNGIBLE_TOKEN_TOOL,
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
  TRANSFER_HBAR_TOOL,
  CREATE_TOPIC_TOOL,
  SUBMIT_TOPIC_MESSAGE_TOOL,
  GET_HBAR_BALANCE_QUERY_TOOL,
  GET_ACCOUNT_QUERY_TOOL,
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
  GET_TOPIC_MESSAGES_QUERY_TOOL,
];

export function parseArgs(args: string[]): Options {
  const options: Options = {
    ledgerId: LedgerId.TESTNET,
    context: {},
  };

  console.log(args);
  args.forEach((arg) => {
    if (arg.startsWith("--")) {
      const [key, value] = arg.slice(2).split("=");

      if (key == "tools") {
        options.tools = value.split(",");
      } else if (key == "agent-mode") {
        options.context!.mode = value as AgentMode;
      } else if (key == "account-id") {
        options.context!.accountId = value;
      } else if (key == "public-key") {
        options.context!.accountPublicKey = value;
      } else if (key == "ledger-id") {
        if (value == "testnet") {
          options.ledgerId = LedgerId.TESTNET;
        } else if (value == "mainnet") {
          options.ledgerId = LedgerId.MAINNET;
        } else {
          throw new Error(
            `Invalid ledger id: ${value}. Accepted values are: testnet, mainnet`,
          );
        }
      } else {
        throw new Error(
          `Invalid argument: ${key}. Accepted arguments are: ${ACCEPTED_ARGS.join(
            ", ",
          )}`,
        );
      }
    }
  });

  // Validate tools against accepted enum values
  options.tools?.forEach((tool: string) => {
    if (tool == "all") {
      return;
    }
    if (!ACCEPTED_TOOLS.includes(tool.trim() as any)) {
      throw new Error(
        `Invalid tool: ${tool}. Accepted tools are: ${ACCEPTED_TOOLS.join(
          ", ",
        )}`,
      );
    }
  });

  return options;
}

function handleError(error: any) {
  console.error(red("\n🚨  Error initializing Hedera MCP server:\n"));
  console.error(yellow(`   ${error.message}\n`));
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
  const operatorKey = process.env.HEDERA_OPERATOR_KEY;

  if (operatorId && operatorKey) {
    try {
      client.setOperator(operatorId, operatorKey);
      console.error(green(`✅ Operator set: ${operatorId}`));
    } catch (error) {
      console.error(red(`❌ Failed to set operator: ${error}`));
      throw error;
    }
  } else {
    console.error(
      yellow(
        "⚠️  No operator credentials found in environment variables (HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY)",
      ),
    );
  }

  const configuration: Configuration = {
    tools: options.tools,
    context: options.context,
    plugins: [
      coreTokenPlugin,
      coreAccountPlugin,
      coreConsensusPlugin,
      coreQueriesPlugin,
    ],
  };

  const server = new HederaMCPToolkit({
    client: client,
    configuration: configuration,
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
  // We use console.error instead of console.log since console.log will output to stdio, which will confuse the MCP server
  console.error(green("✅ Hedera MCP Server running on stdio"));
}

if (require.main === module) {
  main().catch((error) => {
    handleError(error);
  });
}
