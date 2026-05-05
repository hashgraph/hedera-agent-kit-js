import { randomUUID } from "node:crypto";
import { createMcpExpressApp } from "@modelcontextprotocol/sdk/server/express.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js";
import { LedgerId, Client } from "@hiero-ledger/sdk";
import {
  AgentMode,
  coreAccountPlugin,
  coreAccountPluginToolNames,
  coreConsensusPlugin,
  coreConsensusPluginToolNames,
  coreTokenPlugin,
  coreTokenPluginToolNames,
  HederaMCPToolkit,
  coreAccountQueryPlugin,
  coreAccountQueryPluginToolNames,
  getMirrornodeService,
} from "hedera-agent-kit";
import type { Configuration, Context } from "hedera-agent-kit";

type Options = {
  tools?: string[];
  context?: Context;
  ledgerId?: LedgerId;
  port: number;
};

const { GET_HBAR_BALANCE_QUERY_TOOL } = coreAccountQueryPluginToolNames;

const {
  CREATE_FUNGIBLE_TOKEN_TOOL,
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
} = coreTokenPluginToolNames;

const { TRANSFER_HBAR_TOOL } = coreAccountPluginToolNames;

const { CREATE_TOPIC_TOOL, SUBMIT_TOPIC_MESSAGE_TOOL } =
  coreConsensusPluginToolNames;

// CLI flags accepted by this server
const ACCEPTED_ARGS = [
  "agent-mode",
  "account-id",
  "public-key",
  "tools",
  "ledger-id",
  "port",
];

// Tools that can be selectively enabled via --tools=<name>,... or "all"
const ACCEPTED_TOOLS = [
  CREATE_FUNGIBLE_TOKEN_TOOL,
  CREATE_NON_FUNGIBLE_TOKEN_TOOL,
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
  MINT_NON_FUNGIBLE_TOKEN_TOOL,
  TRANSFER_HBAR_TOOL,
  CREATE_TOPIC_TOOL,
  SUBMIT_TOPIC_MESSAGE_TOOL,
  GET_HBAR_BALANCE_QUERY_TOOL,
];

function log(message: string, level: "info" | "error" | "warn" = "info") {
  const prefix = level === "error" ? "❌" : level === "warn" ? "⚠️" : "✅";
  console.log(`${prefix} ${message}`);
}

/** Parse process.argv flags into a typed Options object. */
export function parseArgs(args: string[]): Options {
  const options: Options = {
    ledgerId: LedgerId.TESTNET,
    context: {},
    port: 3001,
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
      } else if (key == "port") {
        options.port = parseInt(value, 10);
      } else {
        throw new Error(
          `Invalid argument: ${key}. Accepted arguments are: ${ACCEPTED_ARGS.join(
            ", ",
          )}`,
        );
      }
    }
  });

  // Validate that every explicitly listed tool is recognised
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

/**
 * Instantiate a HederaMCPToolkit with all core plugins loaded.
 * contextOverride lets per-request headers (e.g. x-hedera-account-id) shadow
 * the global context supplied at startup.
 */
function createHederaServer(
  options: Options,
  client: Client,
  contextOverride: Partial<Context> = {},
): HederaMCPToolkit {
  const configuration: Configuration = {
    tools: options.tools,
    context: { ...options.context, ...contextOverride },
    plugins: [
      coreTokenPlugin,
      coreAccountPlugin,
      coreConsensusPlugin,
      coreAccountQueryPlugin,
    ],
  };

  return new HederaMCPToolkit({
    client: client,
    configuration: configuration,
  });
}

export async function main() {
  const options = parseArgs(process.argv.slice(2));
  let client: Client;

  if (options.ledgerId == LedgerId.TESTNET) {
    client = Client.forTestnet();
  } else {
    client = Client.forMainnet();
  }

  // Each active MCP session gets its own StreamableHTTPServerTransport, keyed by session ID.
  // A new entry is created on initialize and removed when the transport closes.
  const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

  const app = createMcpExpressApp();

  // Log every inbound request and its final status code + duration
  app.use((req, res, next) => {
    const start = Date.now();
    log(`→ ${req.method} ${req.path} from ${req.ip}`, "info");
    if (req.headers["mcp-session-id"]) {
      log(`  Session: ${req.headers["mcp-session-id"]}`, "info");
    }
    res.on("finish", () => {
      const duration = Date.now() - start;
      log(
        `← ${req.method} ${req.path} ${res.statusCode} (${duration}ms)`,
        res.statusCode >= 400 ? "error" : "info",
      );
    });
    next();
  });

  // POST /mcp — main JSON-RPC entry point.
  // Three cases are handled:
  //   1. Existing session: route to the already-created transport.
  //   2. No session + initialize request: create a new transport and server.
  //   3. Anything else: return an appropriate error.
  app.post("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    log(
      `POST /mcp - body method: ${req.body?.method || "N/A"}, session: ${sessionId || "none"}`,
      "info",
    );

    try {
      let transport: StreamableHTTPServerTransport;

      if (sessionId && transports[sessionId]) {
        // Reuse existing transport for this session
        transport = transports[sessionId];
      } else if (!sessionId && isInitializeRequest(req.body)) {
        // New initialization request — extract potential headers and context details
        let contextOverride: Partial<Context> = {};
        const headerAccountId = req.headers["x-hedera-account-id"] as
          | string
          | undefined;

        if (headerAccountId) {
          log(`Found account override in header: ${headerAccountId}`, "info");
          contextOverride.accountId = headerAccountId;

          // Attempt to fetch public key from mirror node to fully populate scope
          try {
            if (options.ledgerId) {
              const mirrorNodeService = getMirrornodeService(
                undefined,
                options.ledgerId,
              );
              const accountData =
                await mirrorNodeService.getAccount(headerAccountId);
              if (accountData.accountPublicKey) {
                contextOverride.accountPublicKey = accountData.accountPublicKey;
                log(`Fetched public key for ${headerAccountId}`, "info");
              }
            }
          } catch (error: any) {
            const errorMsg = `Could not find account ${headerAccountId} on the mirror node. Please check your configuration.`;
            log(errorMsg, "error");
            res.status(400).json({
              jsonrpc: "2.0",
              error: { code: -32000, message: errorMsg },
              id: (req.body as any)?.id || null,
            });
            return;
          }
        }

        // Create a new transport; the session ID is generated on first response
        // and stored in the transports map via onsessioninitialized.
        transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          onsessioninitialized: (sessionId) => {
            log(`Session initialized: ${sessionId}`, "info");
            transports[sessionId] = transport;
          },
        });

        // Remove the transport from the map when the client disconnects
        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid && transports[sid]) {
            log(`Session closed: ${sid}`, "info");
            delete transports[sid];
          }
        };

        // Wire a fresh Hedera MCP server to this transport
        const server = createHederaServer(options, client, contextOverride);
        await server.connect(transport);

        await transport.handleRequest(req, res, req.body);
        return;
      } else if (sessionId) {
        // Session ID provided but no matching transport found
        res.status(404).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Session not found" },
          id: null,
        });
        return;
      } else {
        // No session ID and not an initialize request
        res.status(400).json({
          jsonrpc: "2.0",
          error: { code: -32000, message: "Bad Request: Session ID required" },
          id: null,
        });
        return;
      }

      await transport.handleRequest(req, res, req.body);
    } catch (error) {
      console.error("Error handling MCP request:", error);
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // GET /mcp — SSE stream for server-to-client notifications on an existing session
  app.get("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).send("Missing session ID");
      return;
    }
    if (!transports[sessionId]) {
      res.status(404).send("Session not found");
      return;
    }

    const transport = transports[sessionId];
    await transport.handleRequest(req, res);
  });

  // DELETE /mcp — explicit session termination by the client
  app.delete("/mcp", async (req, res) => {
    const sessionId = req.headers["mcp-session-id"] as string | undefined;
    if (!sessionId) {
      res.status(400).send("Missing session ID");
      return;
    }
    if (!transports[sessionId]) {
      res.status(404).send("Session not found");
      return;
    }

    try {
      const transport = transports[sessionId];
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling session termination:", error);
      if (!res.headersSent) {
        res.status(500).send("Error processing session termination");
      }
    }
  });

  app.listen(options.port, () => {
    log(
      `Hedera MCP Streamable HTTP Server running on http://localhost:${options.port}/mcp`,
      "info",
    );
  });

  // Graceful shutdown: close all open transports before exiting
  process.on("SIGINT", async () => {
    log("Shutting down server...", "info");
    for (const sessionId in transports) {
      try {
        await transports[sessionId]!.close();
        delete transports[sessionId];
      } catch (error) {
        console.error(
          `Error closing transport for session ${sessionId}:`,
          error,
        );
      }
    }
    log("Server shutdown complete", "info");
    process.exit(0);
  });
}

main().catch((error) => {
  handleError(error);
  process.exit(1);
});
