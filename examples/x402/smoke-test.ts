/**
 * Hedera Agent Kit + x402 Micropayments Smoke Test
 *
 * Verifies all 7 steps of the x402 payment flow, the x402-gated MCP pattern,
 * and async agent loops — no LLM needed, no external secrets, no funds moved.
 *
 * Run: npx tsx smoke-test.ts
 */

import assert from 'node:assert';
import { PrivateKey, AccountId } from '@hiero-ledger/sdk';
import {
  create402ChallengeResponse,
  createPaymentRequirements,
  verifyPaymentPayload,
  PAYMENT_SPECS,
} from './src/lib/x402-server';
import {
  LocalClientHederaSigner,
  WalletConnectClientHederaSigner,
} from './src/lib/walletconnect-signer';
import {
  formatTxIdForHashScan,
  getHashScanTxLink,
  getHashScanTopicLink,
  getHashScanTokenLink,
  getHashScanAccountLink,
} from './src/lib/hashscan';
import { executeAgentToolAfterSettlement } from './src/lib/agent-kit';
import { verifyPaymentReceipt, PaymentReceipt } from './src/mcp/receipt-verifier';
import { createX402McpMiddleware, DEFAULT_GATED_TOOLS } from './src/mcp/x402-mcp-middleware';
import { HcsPaymentGatedTopicManager } from './src/mcp/hcs-gated-topic';
import { ReactPaymentAgent } from './src/agent/react-payment-agent';
import { Client } from '@hiero-ledger/sdk';

async function main() {
  console.log('🚀 Running Hedera Agent Kit + x402 smoke test suite...\n');

  // Test ECDSA keys (standard testnet format)
  const testPayerKey = PrivateKey.generateECDSA();
  const testFeePayerKey = PrivateKey.generateECDSA();
  const testPayerAccount = '0.0.1001';
  const testReceiverAccount = '0.0.5001';
  const testFeePayerAccount = '0.0.9001';

  process.env.X402_RECEIVER_ACCOUNT_ID = testReceiverAccount;
  process.env.X402_FEE_PAYER_ID = testFeePayerAccount;
  process.env.NEXT_PUBLIC_NETWORK = 'testnet';

  // -------------------------------------------------------------
  // Test 1: 402 Challenge Generation
  // -------------------------------------------------------------
  console.log('1️⃣  Testing HTTP 402 Challenge generation...');
  const hcsChallenge = create402ChallengeResponse('submit_topic_message');
  assert.equal(hcsChallenge.status, 402, 'status should be 402');
  assert.ok(hcsChallenge.headers.get('WWW-Authenticate'), 'WWW-Authenticate header must exist');
  assert.ok(
    hcsChallenge.headers.get('x402-payment-required'),
    'x402-payment-required header must exist',
  );
  assert.equal(
    hcsChallenge.body.paymentRequirements.amount,
    PAYMENT_SPECS.submit_topic_message.amount,
  );
  assert.equal(hcsChallenge.body.paymentRequirements.payTo, testReceiverAccount);
  assert.equal(hcsChallenge.body.paymentRequirements.extra.feePayer, testFeePayerAccount);

  const tokenChallenge = create402ChallengeResponse('mint_fungible_token');
  assert.equal(
    tokenChallenge.body.paymentRequirements.amount,
    PAYMENT_SPECS.mint_fungible_token.amount,
  );
  console.log('   ✔ 402 Challenge generation passed');

  // -------------------------------------------------------------
  // Test 2: HashScan Link Formatting
  // -------------------------------------------------------------
  console.log('2️⃣  Testing HashScan link formatters...');
  const rawTxId = '0.0.1001@1700000000.123456789';
  const formattedTxId = formatTxIdForHashScan(rawTxId);
  assert.equal(formattedTxId, '0.0.1001-1700000000-123456789');

  const txLink = getHashScanTxLink(rawTxId, 'testnet');
  assert.equal(txLink, 'https://hashscan.io/testnet/transaction/0.0.1001-1700000000-123456789');

  const topicLink = getHashScanTopicLink('0.0.8888', 'testnet');
  assert.equal(topicLink, 'https://hashscan.io/testnet/topic/0.0.8888');

  const tokenLink = getHashScanTokenLink('0.0.7777', 'testnet');
  assert.equal(tokenLink, 'https://hashscan.io/testnet/token/0.0.7777');

  const accountLink = getHashScanAccountLink('0.0.1001', 'testnet');
  assert.equal(accountLink, 'https://hashscan.io/testnet/account/0.0.1001');
  console.log('   ✔ HashScan link generation passed');

  // -------------------------------------------------------------
  // Test 3: Client Signer Adapter & Transfer Preparation
  // -------------------------------------------------------------
  console.log('3️⃣  Testing Client Signer Adapter (LocalClientHederaSigner)...');
  const localSigner = new LocalClientHederaSigner(testPayerAccount, testPayerKey);
  assert.equal(localSigner.accountId, testPayerAccount);

  const requirements = createPaymentRequirements('submit_topic_message');
  const signedPayloadBase64 =
    await localSigner.createPartiallySignedTransferTransaction(requirements);
  assert.ok(
    typeof signedPayloadBase64 === 'string' && signedPayloadBase64.length > 0,
    'payload must be base64',
  );
  console.log('   ✔ Client signer partially signed transfer transaction passed');

  // -------------------------------------------------------------
  // Test 4: Server Payment Verification & Inspection
  // -------------------------------------------------------------
  console.log('4️⃣  Testing Server Payment Verification...');
  const validVerification = await verifyPaymentPayload(signedPayloadBase64, requirements);
  assert.equal(
    validVerification.valid,
    true,
    `expected valid payload, got ${validVerification.error}`,
  );
  assert.equal(validVerification.payer, testPayerAccount);
  assert.equal(validVerification.amount, requirements.amount);

  // Negative test: verify rejection when amount is altered
  const badRequirements = { ...requirements, amount: '9999999999' };
  const rejectedVerification = await verifyPaymentPayload(signedPayloadBase64, badRequirements);
  assert.equal(rejectedVerification.valid, false, 'must reject insufficient payment');
  console.log('   ✔ Server payment verification passed (positive & negative checks)');

  // -------------------------------------------------------------
  // Test 5: Post-Settlement Tool Execution (Hedera Agent Kit)
  // -------------------------------------------------------------
  console.log('5️⃣  Testing Post-Settlement Hedera Agent Kit Tool Execution...');
  const fakeTxId = '0.0.5001@1700000000.000000000';

  // Test submit_topic_message_tool
  const hcsResult = await executeAgentToolAfterSettlement(fakeTxId, {
    action: 'submit_topic_message',
    topicId: '0.0.9999',
    message: 'Smoke test message',
    userAccountId: testPayerAccount,
  });
  assert.equal(hcsResult.success, true);
  assert.equal(hcsResult.action, 'submit_topic_message_tool');
  assert.ok(hcsResult.hashscanLinks.payment);
  assert.ok(hcsResult.hashscanLinks.actionTx);
  assert.ok(hcsResult.hashscanLinks.topicOrToken);

  // Test mint_fungible_token_tool
  const mintResult = await executeAgentToolAfterSettlement(fakeTxId, {
    action: 'mint_fungible_token',
    tokenId: '0.0.7777',
    amount: 50,
    userAccountId: testPayerAccount,
  });
  assert.equal(mintResult.success, true);
  assert.equal(mintResult.action, 'mint_fungible_token_tool');
  assert.ok(mintResult.hashscanLinks.topicOrToken);
  console.log('   ✔ Post-settlement Agent Kit tool execution passed');

  // -------------------------------------------------------------
  // Test 6: x402-Gated MCP Middleware Pattern
  // -------------------------------------------------------------
  console.log('6️⃣  Testing x402-Gated MCP Middleware Pattern...');
  const middleware = createX402McpMiddleware(DEFAULT_GATED_TOOLS);

  // 6.1 Unpaid tool call must trigger HTTP 402 challenge
  let challengeSent = false;
  let sentStatus = 0;
  const mockReqUnpaid: any = {
    body: { method: 'tools/call', params: { name: 'submit_topic_message_tool' } },
    headers: {},
  };
  const mockResChallenge: any = {
    setHeader: () => {},
    status: (code: number) => {
      sentStatus = code;
      return {
        json: (data: any) => {
          challengeSent = true;
          assert.equal(data.error.code, 402);
        },
      };
    },
  };

  await middleware(mockReqUnpaid, mockResChallenge, () => {
    assert.fail('Unpaid gated tool must not call next()');
  });
  assert.equal(sentStatus, 402);
  assert.equal(challengeSent, true);

  // 6.2 Verified paid tool call must pass through
  let nextCalled = false;
  const validReceipt: PaymentReceipt = {
    transactionId: fakeTxId,
    payer: testPayerAccount,
    payTo: testReceiverAccount,
    amount: DEFAULT_GATED_TOOLS.submit_topic_message_tool.amount,
    asset: DEFAULT_GATED_TOOLS.submit_topic_message_tool.asset,
    status: 'SUCCESS',
  };
  const mockReqPaid: any = {
    body: { method: 'tools/call', params: { name: 'submit_topic_message_tool' } },
    headers: {
      'x402-payment-receipt': Buffer.from(JSON.stringify(validReceipt)).toString('base64'),
    },
  };
  const mockResPaid: any = {
    status: () => ({ json: () => {} }),
  };

  await middleware(mockReqPaid, mockResPaid, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, true, 'Verified payment must allow next() to execute tool');
  console.log('   ✔ x402 MCP middleware gating & verification passed');

  // -------------------------------------------------------------
  // Test 7: Async ReAct Agent Loop with Payment Callbacks
  // -------------------------------------------------------------
  console.log('7️⃣  Testing Async ReAct Agent Loop with Payment Callbacks...');
  const client = Client.forTestnet();
  const reactAgent = new ReactPaymentAgent(client, testPayerAccount);

  const loopResult = await reactAgent.run('Post transaction receipt to HCS topic');
  assert.equal(loopResult.completed, false);
  assert.ok(loopResult.paused);
  assert.equal(loopResult.paused?.type, 'PAYMENT_REQUIRED');
  assert.equal(typeof loopResult.paused?.resume, 'function');

  // Resume callback with payment receipt
  const resumeResult = await loopResult.paused.resume(validReceipt);
  assert.equal(resumeResult.completed, true);
  assert.ok(resumeResult.output?.includes('Successfully executed submit_topic_message_tool'));
  assert.ok(resumeResult.links?.paymentLink);
  assert.ok(resumeResult.links?.topicLink);
  client.close();
  console.log('   ✔ Async ReAct agent loop callback & resumption passed');

  // -------------------------------------------------------------
  // Test 8: HCS Payment-Gated Topic Manager
  // -------------------------------------------------------------
  console.log('8️⃣  Testing HCS Payment-Gated Topic Manager...');
  const hcsManager = new HcsPaymentGatedTopicManager(client, {
    topicId: '0.0.5284910',
    pricePerMessageTinybars: '1000000',
    payTo: testReceiverAccount,
  });
  const managerChallenge = hcsManager.getChallenge();
  assert.equal(managerChallenge.status, 402);

  const postResult = await hcsManager.submitGatedMessage(validReceipt, 'Smoke test topic message');
  assert.equal(postResult.success, true);
  assert.equal(postResult.topicId, '0.0.5284910');
  console.log('   ✔ HCS payment-gated topic manager passed');

  console.log('\n🎉 ALL 8 SMOKE TESTS PASSED CLEANLY!\n');
}

main().catch(err => {
  console.error('❌ Smoke test failed:', err);
  process.exit(1);
});
