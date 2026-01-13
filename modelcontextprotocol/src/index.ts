#!/usr/bin/env node

// CRITICAL: Redirect stdout to stderr BEFORE importing anything
// This prevents any SDK console.log from polluting the MCP JSON-RPC channel
const originalStdoutWrite = process.stdout.write.bind(process.stdout);
process.stdout.write = process.stderr.write.bind(process.stderr);

import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { LedgerId, Client } from "@hashgraph/sdk";
import {
  AgentMode,
  coreAccountPlugin,
  coreAccountPluginToolNames,
  coreConsensusPlugin,
  coreConsensusPluginToolNames,
  coreTokenPlugin,
  coreTokenPluginToolNames,
  HederaMCPToolkit,
} from "hedera-agent-kit";
import type { Configuration, Context } from "hedera-agent-kit";

import * as dotenv from "dotenv";

// Load .env but suppress any output
dotenv.config({ path: "../.env" });

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
];

// Helper function for stderr logging without colors when in MCP mode
function log(message: string, level: "info" | "error" | "warn" = "info") {
  const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : "✅";
  console.error(`${prefix} ${message}`);
}

export function parseArgs(args: string[]): Options {
  const options: Options = {
    ledgerId: LedgerId.TESTNET,
    context: {},
  };

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
  log(`Error initializing Hedera MCP server: ${error.message}`, "error");
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
      log(`Operator set: ${operatorId}`, "info");
    } catch (error) {
      log(`Failed to set operator: ${error}`, "error");
      throw error;
    }
  } else {
    log(
      "No operator credentials found in environment variables (HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY)",
      "warn",
    );
  }

  const configuration: Configuration = {
    tools: options.tools,
    context: options.context,
    plugins: [coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin],
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
  log("Hedera MCP Server running on stdio", "info");
}

main().catch((error) => {
  handleError(error);
  process.exit(1);
});
