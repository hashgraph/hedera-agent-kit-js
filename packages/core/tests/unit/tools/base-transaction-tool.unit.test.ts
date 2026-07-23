import { describe, it, expect } from 'vitest';
import { AccountId, ReceiptStatusError, Status, TransactionId } from '@hiero-ledger/sdk';
import { BaseTransactionTool } from '@/shared/base-transaction-tool';
import { Context } from '@/shared/configuration';
import { z } from 'zod';

// Minimal concrete subclass used only for testing BaseTransactionTool behaviour.
class StubTransactionTool extends BaseTransactionTool {
  method = 'stub_transaction_tool';
  name = 'Stub Transaction Tool';
  description = 'test stub';
  parameters = z.object({});
  async normalizeParams(p: any) { return p; }
  async coreAction() { return {}; }
  async secondaryAction(r: any) { return r; }
}

function makeReceiptStatusError(statusValue: Status): ReceiptStatusError {
  const txId = TransactionId.generate(new AccountId(0, 0, 1));
  // ReceiptStatusError constructor: { transactionReceipt, status, transactionId }
  return new ReceiptStatusError({
    transactionReceipt: {} as any,
    status: statusValue,
    transactionId: txId,
  });
}

describe('BaseTransactionTool.handleError()', () => {
  const tool = new StubTransactionTool();
  const ctx: Context = {};

  describe('ReceiptStatusError — structured fields preserved', () => {
    it('sets status ERROR and errorCode to the SDK status name', async () => {
      const err = makeReceiptStatusError(Status.InsufficientPayerBalance);
      const result = await tool.handleError(err, ctx);

      expect(result.raw.status).toBe('ERROR');
      expect(result.raw.errorCode).toBe('INSUFFICIENT_PAYER_BALANCE');
    });

    it('sets raw.transactionId to the transaction ID string', async () => {
      const err = makeReceiptStatusError(Status.InvalidTransaction);
      const result = await tool.handleError(err, ctx);

      expect(typeof result.raw.transactionId).toBe('string');
      expect(result.raw.transactionId).toMatch(/^0\.0\.\d+@/);
    });

    it('sets raw.error to the SDK message and humanMessage with tool name prefix', async () => {
      const err = makeReceiptStatusError(Status.InvalidSignature);
      const result = await tool.handleError(err, ctx);

      expect(result.raw.error).toBe(err.message);
      expect(result.raw.errorCode).toBe('INVALID_SIGNATURE');
      expect(result.humanMessage).toBe(`Failed to execute ${tool.name}: ${err.message}`);
    });

    it('classifyToolResult maps it to kind failure with specific errorCode', async () => {
      const { classifyToolResult } = await import('@/shared/utils/default-tool-output-parsing');
      const err = makeReceiptStatusError(Status.InsufficientAccountBalance);
      const envelope = await tool.handleError(err, ctx);
      const classified = classifyToolResult(envelope);

      expect(classified.kind).toBe('failure');
      if (classified.kind === 'failure') {
        expect(classified.errorCode).toBe('INSUFFICIENT_ACCOUNT_BALANCE');
      }
    });
  });

  describe('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT — actionable hint appended', () => {
    it('includes the associate_token_tool hint in humanMessage', async () => {
      const err = makeReceiptStatusError(Status.TokenNotAssociatedToAccount);
      const result = await tool.handleError(err, ctx);

      expect(result.raw.status).toBe('ERROR');
      expect(result.raw.errorCode).toBe('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT');
      expect(result.humanMessage).toContain('associate_token_tool');
      expect(result.humanMessage).toContain('maxAutoAssociations');
    });

    it('humanMessage still contains the original SDK error message', async () => {
      const err = makeReceiptStatusError(Status.TokenNotAssociatedToAccount);
      const result = await tool.handleError(err, ctx);

      expect(result.humanMessage).toContain(err.message);
    });

    it('raw.error is the original SDK message without the hint', async () => {
      const err = makeReceiptStatusError(Status.TokenNotAssociatedToAccount);
      const result = await tool.handleError(err, ctx);

      // raw.error must equal the original SDK message, not the enriched one
      expect(result.raw.error).toBe(err.message);
      expect(result.raw.error).not.toContain('associate_token_tool');
    });

    it('does not add the association hint for unrelated status codes', async () => {
      const err = makeReceiptStatusError(Status.InsufficientPayerBalance);
      const result = await tool.handleError(err, ctx);

      expect(result.humanMessage).not.toContain('associate_token_tool');
    });
  });

  describe('generic Error — falls through to BaseTool.handleError()', () => {
    it('sets status ERROR with generic error message', async () => {
      const err = new Error('network timeout');
      const result = await tool.handleError(err, ctx);

      expect(result.raw.status).toBe('ERROR');
      expect(result.raw.error).toContain('network timeout');
      expect(result.raw.errorCode).toBeUndefined();
      expect(result.raw.transactionId).toBeUndefined();
    });

    it('classifyToolResult maps it to kind failure with errorCode ERROR', async () => {
      const { classifyToolResult } = await import('@/shared/utils/default-tool-output-parsing');
      const envelope = await tool.handleError(new Error('oops'), ctx);
      const classified = classifyToolResult(envelope);

      expect(classified.kind).toBe('failure');
      if (classified.kind === 'failure') {
        expect(classified.errorCode).toBe('ERROR');
      }
    });
  });
});
