import { describe, it, expect, beforeEach } from 'vitest';
import { PrivateKey } from '@hiero-ledger/sdk';
import {
  create402ChallengeResponse,
  createPaymentRequirements,
  verifyPaymentPayload,
  PAYMENT_SPECS,
} from '../../src/lib/x402-server';
import { LocalClientHederaSigner } from '../../src/lib/walletconnect-signer';
import {
  formatTxIdForHashScan,
  getHashScanTxLink,
  getHashScanTopicLink,
  getHashScanTokenLink,
  getHashScanAccountLink,
} from '../../src/lib/hashscan';
import { verifyPaymentReceipt, PaymentReceipt } from '../../src/mcp/receipt-verifier';
import { createX402McpMiddleware, DEFAULT_GATED_TOOLS } from '../../src/mcp/x402-mcp-middleware';
import { HcsPaymentGatedTopicManager } from '../../src/mcp/hcs-gated-topic';
import { ReactPaymentAgent } from '../../src/agent/react-payment-agent';
import { Client } from '@hiero-ledger/sdk';

describe('Hedera Agent Kit + x402 Micropayments Unit Suite', () => {
  const testPayerKey = PrivateKey.generateECDSA();
  const testPayerAccount = '0.0.1001';
  const testReceiverAccount = '0.0.5001';
  const testFeePayerAccount = '0.0.9001';

  beforeEach(() => {
    process.env.X402_RECEIVER_ACCOUNT_ID = testReceiverAccount;
    process.env.X402_FEE_PAYER_ID = testFeePayerAccount;
    process.env.NEXT_PUBLIC_NETWORK = 'testnet';
  });

  describe('1. x402 Challenge Generation', () => {
    it('creates valid 402 challenge for submit_topic_message', () => {
      const challenge = create402ChallengeResponse('submit_topic_message');
      expect(challenge.status).toBe(402);
      expect(challenge.headers.get('WWW-Authenticate')).toContain('x402 scheme="exact"');
      expect(challenge.headers.get('x402-payment-required')).toBeTruthy();
      expect(challenge.body.paymentRequirements.amount).toBe(
        PAYMENT_SPECS.submit_topic_message.amount,
      );
      expect(challenge.body.paymentRequirements.payTo).toBe(testReceiverAccount);
      expect(challenge.body.paymentRequirements.extra.feePayer).toBe(testFeePayerAccount);
    });

    it('creates valid 402 challenge for mint_fungible_token', () => {
      const challenge = create402ChallengeResponse('mint_fungible_token');
      expect(challenge.status).toBe(402);
      expect(challenge.body.paymentRequirements.amount).toBe(
        PAYMENT_SPECS.mint_fungible_token.amount,
      );
    });
  });

  describe('2. HashScan Formatter', () => {
    it('formats transaction id and links properly', () => {
      const txId = '0.0.1001@1700000000.123456789';
      expect(formatTxIdForHashScan(txId)).toBe('0.0.1001-1700000000-123456789');
      expect(getHashScanTxLink(txId, 'testnet')).toBe(
        'https://hashscan.io/testnet/transaction/0.0.1001-1700000000-123456789',
      );
      expect(getHashScanTopicLink('0.0.8888', 'testnet')).toBe(
        'https://hashscan.io/testnet/topic/0.0.8888',
      );
      expect(getHashScanTokenLink('0.0.7777', 'testnet')).toBe(
        'https://hashscan.io/testnet/token/0.0.7777',
      );
      expect(getHashScanAccountLink('0.0.1001', 'testnet')).toBe(
        'https://hashscan.io/testnet/account/0.0.1001',
      );
    });
  });

  describe('3. Client Signer & Payment Verification', () => {
    it('builds, signs, and verifies partially signed transfer transaction', async () => {
      const signer = new LocalClientHederaSigner(testPayerAccount, testPayerKey);
      const requirements = createPaymentRequirements('submit_topic_message');

      const signedBase64 = await signer.createPartiallySignedTransferTransaction(requirements);
      expect(typeof signedBase64).toBe('string');
      expect(signedBase64.length).toBeGreaterThan(0);

      const verification = await verifyPaymentPayload(signedBase64, requirements);
      expect(verification.valid).toBe(true);
      expect(verification.payer).toBe(testPayerAccount);
      expect(verification.amount).toBe(requirements.amount);
    });

    it('fails fast on insufficient payment amount', async () => {
      const signer = new LocalClientHederaSigner(testPayerAccount, testPayerKey);
      const requirements = createPaymentRequirements('submit_topic_message');
      const signedBase64 = await signer.createPartiallySignedTransferTransaction(requirements);

      const badReq = { ...requirements, amount: '99999999999' };
      const verification = await verifyPaymentPayload(signedBase64, badReq);
      expect(verification.valid).toBe(false);
      expect(verification.error).toContain('No transfer of at least');
    });
  });

  describe('4. x402-Gated MCP Server Pattern', () => {
    const middleware = createX402McpMiddleware(DEFAULT_GATED_TOOLS);

    it('blocks unpaid tool call with 402 challenge', async () => {
      let code = 0;
      let body: any = null;
      const req: any = {
        body: { method: 'tools/call', params: { name: 'submit_topic_message_tool' } },
        headers: {},
      };
      const res: any = {
        setHeader: () => {},
        status: (c: number) => {
          code = c;
          return {
            json: (b: any) => {
              body = b;
            },
          };
        },
      };

      await middleware(req, res, () => {
        throw new Error('Should not call next()');
      });

      expect(code).toBe(402);
      expect(body?.error?.code).toBe(402);
    });

    it('allows tool call when verified payment receipt is provided', async () => {
      let nextCalled = false;
      const receipt: PaymentReceipt = {
        transactionId: '0.0.5001@1700000000.000000000',
        payer: testPayerAccount,
        payTo: testReceiverAccount,
        amount: DEFAULT_GATED_TOOLS.submit_topic_message_tool.amount,
        asset: DEFAULT_GATED_TOOLS.submit_topic_message_tool.asset,
        status: 'SUCCESS',
      };
      const req: any = {
        body: { method: 'tools/call', params: { name: 'submit_topic_message_tool' } },
        headers: {
          'x402-payment-receipt': Buffer.from(JSON.stringify(receipt)).toString('base64'),
        },
      };
      const res: any = {
        status: () => ({ json: () => {} }),
      };

      await middleware(req, res, () => {
        nextCalled = true;
      });

      expect(nextCalled).toBe(true);
      expect(req.paymentContext?.paymentVerified).toBe(true);
    });
  });

  describe('5. Async ReAct Agent Loop', () => {
    it('pauses on payment-gated tool and resumes upon receiving settlement callback', async () => {
      const client = Client.forTestnet();
      const agent = new ReactPaymentAgent(client, testPayerAccount);

      const loop = await agent.run('Post audit log to topic');
      expect(loop.completed).toBe(false);
      expect(loop.paused?.type).toBe('PAYMENT_REQUIRED');
      expect(typeof loop.paused?.resume).toBe('function');

      const receipt: PaymentReceipt = {
        transactionId: '0.0.5001@1700000000.000000000',
        payer: testPayerAccount,
        payTo: testReceiverAccount,
        amount: loop.paused!.requirements.amount,
        asset: loop.paused!.requirements.asset,
        status: 'SUCCESS',
      };

      const resumed = await loop.paused!.resume(receipt);
      expect(resumed.completed).toBe(true);
      expect(resumed.links?.paymentLink).toBeTruthy();
      expect(resumed.links?.topicLink).toBeTruthy();
      client.close();
    });
  });

  describe('6. HCS Gated Topic Manager', () => {
    it('verifies receipt and submits gated message', async () => {
      const client = Client.forTestnet();
      const manager = new HcsPaymentGatedTopicManager(client, {
        topicId: '0.0.5284910',
        pricePerMessageTinybars: '1000000',
        payTo: testReceiverAccount,
      });

      const receipt: PaymentReceipt = {
        transactionId: '0.0.5001@1700000000.000000000',
        payer: testPayerAccount,
        payTo: testReceiverAccount,
        amount: '1000000',
        asset: '0.0.0',
        status: 'SUCCESS',
      };

      const result = await manager.submitGatedMessage(receipt, 'Unit test message');
      expect(result.success).toBe(true);
      expect(result.topicId).toBe('0.0.5284910');
      expect(result.txLink).toBeTruthy();
      client.close();
    });
  });
});
