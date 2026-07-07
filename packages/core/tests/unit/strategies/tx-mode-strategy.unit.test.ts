import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client } from '@hiero-ledger/sdk';
import { AgentMode, Context } from '@/shared/configuration';
import {
  handleTransaction,
  ExecuteStrategy,
  TransactionStrategy,
} from '@/shared/strategies/tx-mode-strategy';
import HederaAgentAPI from '@/shared/api';

describe('Transaction Mode Strategies & custom signing (unit)', () => {
  let mockClient: any;
  let mockTx: any;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock the SDK Client
    mockClient = {
      // Mock any necessary Client fields or methods
    } as unknown as Client;

    // Mock a basic transaction
    mockTx = {
      transactionId: null,
      setTransactionId: vi.fn().mockReturnThis(),
      freezeWith: vi.fn().mockReturnThis(),
      toBytes: vi.fn().mockReturnValue(new Uint8Array([1, 2, 3])),
      execute: vi.fn().mockResolvedValue({
        getReceipt: vi.fn().mockResolvedValue({
          status: { toString: () => 'SUCCESS' },
          accountId: '0.0.1001',
          tokenId: '0.0.2002',
          topicId: '0.0.3003',
          scheduleId: '0.0.4040',
        }),
      }),
    };
  });

  describe('ExecuteStrategy (AUTONOMOUS)', () => {
    it('executes the transaction and retrieves the receipt', async () => {
      const strategy = new ExecuteStrategy();
      const context: Context = { mode: AgentMode.AUTONOMOUS };
      
      mockTx.transactionId = { toString: () => '0.0.1001@1234567.890' };

      const result = await strategy.handle(mockTx, mockClient, context);

      expect(mockTx.execute).toHaveBeenCalledWith(mockClient);
      expect(result).toHaveProperty('raw');
      expect(result.raw.status).toBe('SUCCESS');
      expect(result.raw.transactionId).toBe('0.0.1001@1234567.890');
      expect(result.raw.accountId).toBe('0.0.1001');
      expect(result.raw.tokenId).toBe('0.0.2002');
    });
  });

  describe('handleTransaction Strategy Resolution', () => {
    it('uses ExecuteStrategy by default (AUTONOMOUS)', async () => {
      const context: Context = { mode: AgentMode.AUTONOMOUS };
      mockTx.transactionId = '0.0.1001@123456.789';

      const result = await handleTransaction(mockTx, mockClient, context);
      expect(mockTx.execute).toHaveBeenCalled();
      expect(result.raw.status).toBe('SUCCESS');
    });

    it('uses ReturnBytesStrategy for AgentMode.RETURN_BYTES', async () => {
      const context: Context = { mode: AgentMode.RETURN_BYTES, accountId: '0.0.1001' };

      const result = await handleTransaction(mockTx, mockClient, context);
      expect(mockTx.execute).not.toHaveBeenCalled();
      expect(mockTx.setTransactionId).toHaveBeenCalled();
      expect(mockTx.freezeWith).toHaveBeenCalledWith(mockClient);
      expect(mockTx.toBytes).toHaveBeenCalled();
      expect(result).toHaveProperty('bytes');
      expect(result.bytes).toEqual(new Uint8Array([1, 2, 3]));
    });

    it('throws error in RETURN_BYTES mode if accountId is missing', async () => {
      const context: Context = { mode: AgentMode.RETURN_BYTES };
      await expect(handleTransaction(mockTx, mockClient, context)).rejects.toThrow(
        'Account ID is required in context for RETURN_BYTES mode'
      );
    });

    it('uses custom strategy when mode is AgentMode.CUSTOM', async () => {
      const customMockStrategy: TransactionStrategy = {
        handle: vi.fn().mockResolvedValue({ success: true, custom: 'value' }),
      };
      const context: Context = { mode: AgentMode.CUSTOM, transactionStrategy: customMockStrategy };

      const result = await handleTransaction(mockTx, mockClient, context);

      expect(customMockStrategy.handle).toHaveBeenCalledWith(mockTx, mockClient, context, undefined);
      expect(result).toEqual({ success: true, custom: 'value' });
    });

    it('throws error in CUSTOM mode if transactionStrategy is missing', async () => {
      const context: Context = { mode: AgentMode.CUSTOM };
      await expect(handleTransaction(mockTx, mockClient, context)).rejects.toThrow(
        'transactionStrategy must be provided in Context when AgentMode is CUSTOM'
      );
    });
  });

  describe('HederaAgentAPI Initialization Validation', () => {
    it('succeeds initialization if AgentMode.CUSTOM and transactionStrategy is provided', () => {
      const mockApiClient = { ledgerId: 'mainnet' } as unknown as Client;
      const customStrategy: TransactionStrategy = {
        handle: vi.fn(),
      };
      const context: Context = {
        mode: AgentMode.CUSTOM,
        transactionStrategy: customStrategy,
      };

      expect(() => new HederaAgentAPI(mockApiClient, context)).not.toThrow();
    });

    it('throws during initialization if AgentMode.CUSTOM and transactionStrategy is missing', () => {
      const mockApiClient = { ledgerId: 'mainnet' } as unknown as Client;
      const context: Context = {
        mode: AgentMode.CUSTOM,
      };

      expect(() => new HederaAgentAPI(mockApiClient, context)).toThrow(
        'transactionStrategy must be provided in Context when AgentMode is CUSTOM'
      );
    });

    it('succeeds initialization if AgentMode.RETURN_BYTES with or without accountId', () => {
      const mockApiClient = { ledgerId: 'mainnet' } as unknown as Client;

      expect(() => new HederaAgentAPI(mockApiClient, { mode: AgentMode.RETURN_BYTES, accountId: '0.0.1001' })).not.toThrow();
      expect(() => new HederaAgentAPI(mockApiClient, { mode: AgentMode.RETURN_BYTES })).not.toThrow();
    });
  });
});
