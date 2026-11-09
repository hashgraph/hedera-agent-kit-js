import { Request, Response, NextFunction } from 'express';
import { HBAR_ASSET_ID } from '@x402/hedera';
import { verifyPaymentReceipt, PaymentReceipt } from './receipt-verifier';
import { getReceiverAccountId, getFeePayerAccountId } from '../lib/x402-server';

export interface ToolGatingConfig {
  [toolName: string]: {
    amount: string; // tinybars
    asset: string;
    description: string;
  };
}

export const DEFAULT_GATED_TOOLS: ToolGatingConfig = {
  submit_topic_message_tool: {
    amount: '1000000', // 1,000,000 tinybars (0.01 HBAR)
    asset: HBAR_ASSET_ID,
    description: 'Requires 0.01 HBAR micropayment before submitting message to HCS topic',
  },
  mint_fungible_token_tool: {
    amount: '5000000', // 5,000,000 tinybars (0.05 HBAR)
    asset: HBAR_ASSET_ID,
    description: 'Requires 0.05 HBAR micropayment before minting HTS tokens',
  },
};

/**
 * Express middleware that intercepts MCP tool call requests and enforces x402 payment gating.
 */
export function createX402McpMiddleware(gatedTools: ToolGatingConfig = DEFAULT_GATED_TOOLS) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Only intercept tools/call or MCP call_tool payloads
    const body = req.body;
    let toolName = '';

    if (body?.method === 'tools/call' && body?.params?.name) {
      toolName = body.params.name;
    } else if (body?.tool) {
      toolName = body.tool;
    }

    const requirement = gatedTools[toolName];
    if (!requirement) {
      // Tool is free / ungated
      return next();
    }

    // Gated tool detected! Check for payment header
    const rawReceiptHeader =
      req.headers['x402-payment-receipt'] ||
      req.headers['x-payment'] ||
      req.headers['authorization'];

    const payTo = getReceiverAccountId();
    const feePayer = getFeePayerAccountId();

    if (!rawReceiptHeader) {
      // Challenge with HTTP 402
      res.setHeader(
        'WWW-Authenticate',
        `x402 scheme="exact" network="hedera:testnet" payTo="${payTo}" amount="${requirement.amount}" asset="${requirement.asset}"`,
      );
      res.setHeader(
        'x402-payment-required',
        Buffer.from(
          JSON.stringify({
            scheme: 'exact',
            network: 'hedera:testnet',
            payTo,
            amount: requirement.amount,
            asset: requirement.asset,
            extra: { feePayer, tool: toolName, description: requirement.description },
          }),
        ).toString('base64'),
      );

      return res.status(402).json({
        jsonrpc: '2.0',
        id: body?.id || null,
        error: {
          code: 402,
          message: `Tool '${toolName}' is payment-gated. ${requirement.description}`,
          data: {
            paymentRequired: true,
            payTo,
            amount: requirement.amount,
            asset: requirement.asset,
            feePayer,
          },
        },
      });
    }

    // Receipt header provided; parse and verify
    try {
      let receipt: PaymentReceipt;
      const headerStr = String(rawReceiptHeader).replace(/^Payment\s+/i, '');

      try {
        receipt = JSON.parse(Buffer.from(headerStr, 'base64').toString('utf8'));
      } catch {
        receipt = JSON.parse(headerStr);
      }

      const verification = await verifyPaymentReceipt(
        receipt,
        {
          payTo,
          amount: requirement.amount,
          asset: requirement.asset,
        },
        { skipOnChainCheck: true }, // Verified structural receipts
      );

      if (!verification.valid) {
        return res.status(402).json({
          jsonrpc: '2.0',
          id: body?.id || null,
          error: {
            code: 402,
            message: `Invalid payment receipt for '${toolName}': ${verification.error}`,
          },
        });
      }

      // Attach verified context for the MCP toolkit tool execution
      (req as any).paymentContext = verification.verifiedContext;
      return next();
    } catch (err) {
      return res.status(400).json({
        jsonrpc: '2.0',
        id: body?.id || null,
        error: {
          code: 400,
          message: `Malformed x402 payment receipt: ${err instanceof Error ? err.message : String(err)}`,
        },
      });
    }
  };
}
