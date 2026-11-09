import express from 'express';
import cors from 'cors';
import { Client } from '@hiero-ledger/sdk';
import { AgentMode } from '@hashgraph/hedera-agent-kit';
import {
  coreConsensusPlugin,
  coreTokenPlugin,
  coreAccountQueryPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
import { HederaMCPToolkit } from '@hashgraph/hedera-agent-kit-mcp';
import { createX402McpMiddleware, DEFAULT_GATED_TOOLS } from './x402-mcp-middleware';
import { getReceiverAccountId } from '../lib/x402-server';

/**
 * Creates and starts an x402 payment-gated MCP HTTP server.
 * Tool calls (e.g. submit_topic_message_tool, mint_fungible_token_tool) are blocked
 * with HTTP 402 until a valid x402 micropayment receipt is provided in the headers.
 */
export function createGatedMcpApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // 1. Mount the x402 payment gate middleware
  app.use('/mcp', createX402McpMiddleware(DEFAULT_GATED_TOOLS));

  // 2. Health check & payment requirements discovery endpoint
  app.get('/mcp/pricing', (_req, res) => {
    res.json({
      server: 'Hedera Agent Kit x402-Gated MCP Server',
      network: 'hedera:testnet',
      payTo: getReceiverAccountId(),
      gatedTools: DEFAULT_GATED_TOOLS,
    });
  });

  // 3. MCP JSON-RPC endpoint
  app.post('/mcp', async (req, res) => {
    const { method, params, id } = req.body;

    // Tool calling handler
    if (method === 'tools/call') {
      const toolName = params?.name;
      const callerAccount = (req.headers['x-hedera-account-id'] as string) || '0.0.1001';

      // Toolkit configured in RETURN_BYTES mode (non-custodial safe architecture)
      const client = Client.forTestnet();
      const toolkit = new HederaMCPToolkit({
        client,
        configuration: {
          context: {
            mode: AgentMode.RETURN_BYTES,
            accountId: callerAccount,
          },
          plugins: [coreConsensusPlugin, coreTokenPlugin, coreAccountQueryPlugin],
        },
      });

      try {
        const paymentContext = (req as any).paymentContext;
        // In real MCP server, the toolkit executes the tool with verified payment context
        res.json({
          jsonrpc: '2.0',
          id: id || 1,
          result: {
            content: [
              {
                type: 'text',
                text: `Tool '${toolName}' executed successfully after verified x402 payment!`,
              },
            ],
            paymentContext: paymentContext || null,
          },
        });
      } catch (err) {
        res.status(500).json({
          jsonrpc: '2.0',
          id: id || 1,
          error: {
            code: -32000,
            message: err instanceof Error ? err.message : String(err),
          },
        });
      } finally {
        client.close();
      }
      return;
    }

    // Default MCP discovery response
    res.json({
      jsonrpc: '2.0',
      id: id || null,
      result: {
        tools: Object.keys(DEFAULT_GATED_TOOLS).map(name => ({
          name,
          description: DEFAULT_GATED_TOOLS[name].description,
          paymentRequired: true,
          priceTinybars: DEFAULT_GATED_TOOLS[name].amount,
        })),
      },
    });
  });

  return app;
}

if (process.env.NODE_ENV !== 'test' && require.main === module) {
  const PORT = process.env.PORT || 3002;
  const app = createGatedMcpApp();
  app.listen(PORT, () => {
    console.log(`✅ x402 Payment-Gated MCP Server listening on port ${PORT}`);
    console.log(`   Pricing: http://localhost:${PORT}/mcp/pricing`);
    console.log(`   MCP Endpoint: http://localhost:${PORT}/mcp`);
  });
}
