import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { AccountId, Client, Key, PrivateKey } from '@hashgraph/sdk';
import { brotliDecompressSync } from 'zlib';
import { randomBytes } from 'crypto';

import { Context, AgentMode } from '@/shared';
import { HolAuditTrailHook } from '@/hooks/hol-audit-trail-hook';
import getTransferHbarTool, {
  TRANSFER_HBAR_TOOL,
} from '@/plugins/core-account-plugin/tools/account/transfer-hbar';
import { auditEntrySchema, buildAuditEntry } from '@/hooks/hol-audit-trail-hook/audit/audit-entry';
import { HCS2_PROTOCOL, HCS2_OPERATION, HCS1_CHUNK_SIZE } from '@/hooks/hol-audit-trail-hook/hol/constants';
import { AuditSession } from '@/hooks/hol-audit-trail-hook/audit/audit-session';
import { HolAuditWriter } from '@/hooks/hol-audit-trail-hook/audit/writers/hol-audit-writer';

import {
  getOperatorClientForTests,
  getCustomClient,
  HederaOperationsWrapper,
} from '../../utils';
import { UsdToHbarService } from '../../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../../utils/setup/langchain-test-config';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';

const POLL_INTERVAL_MS = 500;
const POLL_TIMEOUT_MS = 30_000;

async function pollTopicMessages(
  wrapper: HederaOperationsWrapper,
  topicId: string,
  expectedCount: number,
) {
  const start = Date.now();
  while (Date.now() - start < POLL_TIMEOUT_MS) {
    const response = await wrapper.getTopicMessages(topicId);
    if (response.messages.length >= expectedCount) return response;
    await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
  }
  // Final attempt — let the assertion in the test produce the failure
  return wrapper.getTopicMessages(topicId);
}

describe('HolAuditTrailHook Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;
  let recipientAccountId: AccountId;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    const executorKeyPair = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
        key: executorKeyPair.publicKey,
      })
      .then(resp => resp.accountId!);
    executorClient = getCustomClient(executorAccountId, executorKeyPair);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    recipientAccountId = await operatorWrapper
      .createAccount({ key: executorClient.operatorPublicKey as Key })
      .then(resp => resp.accountId!);
  });

  afterAll(async () => {
    if (executorClient) {
      try {
        await returnHbarsAndDeleteAccount(
          executorWrapper,
          recipientAccountId,
          operatorClient.operatorAccountId!,
        );
        await returnHbarsAndDeleteAccount(
          executorWrapper,
          executorClient.operatorAccountId!,
          operatorClient.operatorAccountId!,
        );
      } catch (error) {
        console.warn('Failed to clean up accounts:', error);
      }
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });

  function decodeMessage(base64Message: string): string {
    return Buffer.from(base64Message, 'base64').toString('utf-8');
  }

  function reconstructHcs1Content(messages: { message: string }[]): any {
    const chunks = messages
      .map(m => JSON.parse(decodeMessage(m.message)) as { o: number; c: string })
      .sort((a, b) => a.o - b.o);

    const dataUri = chunks.map(c => c.c).join('');
    const base64Payload = dataUri.replace(/^data:[^;]+;base64,/, '');
    const compressed = Buffer.from(base64Payload, 'base64');
    const decompressed = brotliDecompressSync(compressed);
    return JSON.parse(decompressed.toString('utf-8'));
  }

  it('should create HCS-2 session registry and HCS-1 audit entry for a single write', async () => {
    const writer = new HolAuditWriter(executorClient);
    const session = new AuditSession(writer);

    const entry = buildAuditEntry({
      tool: TRANSFER_HBAR_TOOL,
      params: { transfers: [{ accountId: recipientAccountId.toString(), amount: 0.0001 }] },
      result: { raw: { status: 'SUCCESS' }, message: 'HBAR successfully transferred.' },
    });

    await session.writeEntry(entry);

    const sessionTopicId = session.getSessionId();
    expect(sessionTopicId).toBeTruthy();

    // Verify session topic memo is HCS-2 registry format
    const topicInfo = await executorWrapper.getTopicInfo(sessionTopicId!);
    expect(topicInfo.topicMemo).toBe('hcs-2:0:0');

    // Poll mirror node until the register message appears
    const sessionMessages = await pollTopicMessages(executorWrapper, sessionTopicId!, 1);
    expect(sessionMessages.messages).toHaveLength(1);

    // Parse the HCS-2 register message
    const registerMsg = JSON.parse(decodeMessage(sessionMessages.messages[0].message));
    expect(registerMsg.p).toBe(HCS2_PROTOCOL);
    expect(registerMsg.op).toBe(HCS2_OPERATION.REGISTER);
    expect(registerMsg.t_id).toBeTruthy();

    // Verify entry topic memo matches HCS-1 format: <sha256-hash>:brotli:base64
    const entryTopicId = registerMsg.t_id;
    const entryTopicInfo = await executorWrapper.getTopicInfo(entryTopicId);
    expect(entryTopicInfo.topicMemo).toMatch(/^[a-f0-9]{64}:brotli:base64$/);

    // Poll entry topic for HCS-1 chunk messages and reconstruct
    const entryMessages = await pollTopicMessages(executorWrapper, entryTopicId, 1);
    expect(entryMessages.messages.length).toBeGreaterThan(0);

    const auditEntry = reconstructHcs1Content(entryMessages.messages);
    const parsed = auditEntrySchema.safeParse(auditEntry);
    expect(parsed.success).toBe(true);

    expect(auditEntry.tool).toBe(TRANSFER_HBAR_TOOL);
    expect(auditEntry.type).toBe('hedera-agent-kit:audit-entry');
    expect(auditEntry.version).toBe('1.0');
    expect(auditEntry.source).toBe('hedera-agent-kit-js');
  }, 60_000);

  it('should create HCS-2 session registry and register multiple HCS-1 entries under the same session', async () => {
    const writer = new HolAuditWriter(executorClient);
    const session = new AuditSession(writer);

    const entry1 = buildAuditEntry({
      tool: TRANSFER_HBAR_TOOL,
      params: { transfers: [{ accountId: recipientAccountId.toString(), amount: 0.0001 }] },
      result: { raw: { status: 'SUCCESS' }, message: 'first transfer' },
    });

    const entry2 = buildAuditEntry({
      tool: TRANSFER_HBAR_TOOL,
      params: { transfers: [{ accountId: recipientAccountId.toString(), amount: 0.0002 }] },
      result: { raw: { status: 'SUCCESS' }, message: 'second transfer' },
    });

    await session.writeEntry(entry1);
    await session.writeEntry(entry2);

    const sessionTopicId = session.getSessionId();
    expect(sessionTopicId).toBeTruthy();

    // Poll until both register messages appear
    const sessionMessages = await pollTopicMessages(executorWrapper, sessionTopicId!, 2);
    expect(sessionMessages.messages).toHaveLength(2);

    // Each register message should point to a different entry topic
    const registerMsg1 = JSON.parse(decodeMessage(sessionMessages.messages[0].message));
    const registerMsg2 = JSON.parse(decodeMessage(sessionMessages.messages[1].message));
    expect(registerMsg1.t_id).not.toBe(registerMsg2.t_id);
  }, 60_000);

  it('should create HCS-2 session registry and split a large audit entry into multiple HCS-1 chunks', async () => {
    const writer = new HolAuditWriter(executorClient);
    const session = new AuditSession(writer);

    // Build an entry with high-entropy padding so brotli cannot compress it
    // below the HCS-1 chunk threshold (~1008 chars per chunk in the data URI).
    // 1500 random bytes -> ~3000 hex chars -> ~2200 compressed bytes -> 3-4 chunks.
    const largeEntry = buildAuditEntry({
      tool: TRANSFER_HBAR_TOOL,
      params: { padding: randomBytes(1500).toString('hex') },
      result: { raw: { status: 'SUCCESS' }, message: 'large entry test' },
    });

    await session.writeEntry(largeEntry);

    const sessionTopicId = session.getSessionId();
    expect(sessionTopicId).toBeTruthy();

    // Poll for the register message in the session topic
    const sessionMessages = await pollTopicMessages(executorWrapper, sessionTopicId!, 1);
    expect(sessionMessages.messages).toHaveLength(1);

    const registerMsg = JSON.parse(decodeMessage(sessionMessages.messages[0].message));
    const entryTopicId = registerMsg.t_id;

    // Poll for chunk messages — expect more than 1
    const entryMessages = await pollTopicMessages(executorWrapper, entryTopicId, 2);
    expect(entryMessages.messages.length).toBeGreaterThan(1);

    // Verify each chunk message has the correct HCS-1 envelope format
    const chunks = entryMessages.messages.map(m =>
      JSON.parse(decodeMessage(m.message)) as { o: number; c: string },
    );

    for (const chunk of chunks) {
      expect(chunk).toHaveProperty('o');
      expect(chunk).toHaveProperty('c');
      expect(typeof chunk.o).toBe('number');
      expect(typeof chunk.c).toBe('string');
      expect(chunk.c.length).toBeLessThanOrEqual(HCS1_CHUNK_SIZE);
    }

    // Verify order indices form a contiguous 0..N-1 sequence
    const sortedOrders = chunks.map(c => c.o).sort((a, b) => a - b);
    expect(sortedOrders).toEqual(Array.from({ length: chunks.length }, (_, i) => i));

    // Reconstruct and validate the full audit entry
    const reconstructed = reconstructHcs1Content(entryMessages.messages);
    const parsed = auditEntrySchema.safeParse(reconstructed);
    expect(parsed.success).toBe(true);

    expect(reconstructed.tool).toBe(TRANSFER_HBAR_TOOL);
    expect(reconstructed.params.padding).toBe(largeEntry.params.padding);
    expect(reconstructed.type).toBe('hedera-agent-kit:audit-entry');
    expect(reconstructed.version).toBe('1.0');
    expect(reconstructed.source).toBe('hedera-agent-kit-js');
  }, 60_000);

  it('should block tool execution when hook is used in RETURN_BYTES mode', async () => {
    const hook = new HolAuditTrailHook({ relevantTools: [TRANSFER_HBAR_TOOL] });
    const context: Context = {
      mode: AgentMode.RETURN_BYTES,
      hooks: [hook],
      accountId: executorClient.operatorAccountId!.toString(),
    };

    const tool = getTransferHbarTool(context);
    const params = {
      transfers: [{ accountId: recipientAccountId.toString(), amount: 0.0001 }],
    };

    const result = await tool.execute(executorClient, context, params);
    expect(result.raw.error).toContain(
      'Unsupported hook: HolAuditTrailHook is available only in Agent Mode AUTONOMOUS',
    );
  });

  it('should not trigger hook when executed tool is not in relevantTools list', async () => {
    const hook = new HolAuditTrailHook({ relevantTools: ['some_other_tool'] });
    const context: Context = {
      mode: AgentMode.AUTONOMOUS,
      hooks: [hook],
    };

    const tool = getTransferHbarTool(context);
    const params = {
      transfers: [{ accountId: recipientAccountId.toString(), amount: 0.0001 }],
    };

    const result = await tool.execute(executorClient, context, params);
    expect(result.raw.status).toBe('SUCCESS');
    expect(hook.getSessionTopicId()).toBeNull();
  });
});
