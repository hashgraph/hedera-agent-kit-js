import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';
import { Client } from '@hiero-ledger/sdk';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { ERC20_TRANSFER_FUNCTION_ABI } from '@/shared/constants/contracts';
import { transferERC20Parameters } from '@/shared/parameter-schemas/evm.zod';
import { AccountResolver } from '@/shared/utils/account-resolver';
import { getERC20Decimals } from '@/shared/hedera-utils/decimals-utils';

// Mock AccountResolver
vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    getHederaEVMAddress: vi.fn(),
  },
}));

// Mock only getERC20Decimals, keep the real toBaseUnit
vi.mock('@/shared/hedera-utils/decimals-utils', async importOriginal => ({
  ...(await importOriginal<object>()),
  getERC20Decimals: vi.fn(),
}));

describe('HederaParameterNormaliser.normaliseTransferERC20Params', () => {
  const contractAbi = ERC20_TRANSFER_FUNCTION_ABI;
  const functionName = 'transfer';
  const context = { accountId: '0.0.1234' };
  let mockClient: Client;
  let encodeSpy: any;
  let mockedAccountResolver: any;
  const mockMirrorNode = { getAccount: vi.fn() } as any;

  beforeEach(() => {
    encodeSpy = vi.spyOn(ethers.Interface.prototype, 'encodeFunctionData');
    vi.clearAllMocks();
    mockClient = {} as Client;
    mockedAccountResolver = vi.mocked(AccountResolver);

    vi.spyOn(HederaParameterNormaliser, 'getHederaAccountId').mockResolvedValue('0.0.5678');
    mockedAccountResolver.getHederaEVMAddress.mockResolvedValue(
      '0x1234567890123456789012345678901234567890',
    );
    vi.mocked(getERC20Decimals).mockResolvedValue(2);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encodes the function call with all parameters', async () => {
    const params = {
      contractId: '0.0.5678',
      recipientAddress: '0x1234567890123456789012345678901234567890',
      amount: 100,
    };

    const parsedParams = transferERC20Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseTransferERC20Params(
      parsedParams,
      contractAbi,
      functionName,
      context,
      mockMirrorNode,
      mockClient,
    );

    expect(getERC20Decimals).toHaveBeenCalledWith('0.0.5678', mockMirrorNode);
    // amount converted from display units to base units using the contract decimals (2)
    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      '0x1234567890123456789012345678901234567890',
      '10000',
    ]);
    expect(result.contractId).toBe('0.0.5678');
    expect(result.gas).toBe(100_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('resolves Hedera address to EVM address for recipient', async () => {
    const params = {
      contractId: '0.0.5678',
      recipientAddress: '0.0.9999',
      amount: 50,
    };

    mockedAccountResolver.getHederaEVMAddress.mockResolvedValue(
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
    );

    const parsedParams = transferERC20Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseTransferERC20Params(
      parsedParams,
      contractAbi,
      functionName,
      context,
      mockMirrorNode,
      mockClient,
    );

    expect(mockedAccountResolver.getHederaEVMAddress).toHaveBeenCalledWith(
      '0.0.9999',
      mockMirrorNode,
    );
    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd',
      '5000',
    ]);
    expect(result.contractId).toBe('0.0.5678');
    expect(result.gas).toBe(100_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('resolves EVM address to Hedera account ID for contract', async () => {
    const params = {
      contractId: '0x1111111111111111111111111111111111111111',
      recipientAddress: '0.0.9999',
      amount: 25,
    };

    vi.spyOn(HederaParameterNormaliser, 'getHederaAccountId').mockResolvedValue('0.0.8888');
    mockedAccountResolver.getHederaEVMAddress.mockResolvedValue(
      '0x2222222222222222222222222222222222222222',
    );

    const parsedParams = transferERC20Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseTransferERC20Params(
      parsedParams,
      contractAbi,
      functionName,
      context,
      mockMirrorNode,
      mockClient,
    );

    expect(HederaParameterNormaliser.getHederaAccountId).toHaveBeenCalledWith(
      '0x1111111111111111111111111111111111111111',
      mockMirrorNode,
    );
    expect(result.contractId).toBe('0.0.8888');
  });

  it('handles large amount values with 18 decimals', async () => {
    const params = {
      contractId: '0.0.5678',
      recipientAddress: '0x1234567890123456789012345678901234567890',
      amount: 1_000_000_000,
    };

    vi.mocked(getERC20Decimals).mockResolvedValue(18);

    const parsedParams = transferERC20Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseTransferERC20Params(
      parsedParams,
      contractAbi,
      functionName,
      context,
      mockMirrorNode,
      mockClient,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      '0x1234567890123456789012345678901234567890',
      '1000000000000000000000000000',
    ]);
    expect(result.contractId).toBe('0.0.5678');
    expect(result.gas).toBe(100_000);
    expect(result.functionParameters).toBeDefined();
  });

  describe('error handling', () => {
    it('throws when contractId is missing', async () => {
      const params = {
        recipientAddress: '0x1234567890123456789012345678901234567890',
        amount: 100,
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC20Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Invalid parameters: Field "contractId" - Required/);
    });

    it('throws when recipientAddress is missing', async () => {
      const params = {
        contractId: '0.0.5678',
        amount: 100,
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC20Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Invalid parameters: Field "recipientAddress" - Required/);
    });

    it('throws when amount is missing', async () => {
      const params = {
        contractId: '0.0.5678',
        recipientAddress: '0x1234567890123456789012345678901234567890',
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC20Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Invalid parameters: Field "amount" - Required/);
    });

    it('throws when amount is not a number', async () => {
      const params = {
        contractId: '0.0.5678',
        recipientAddress: '0x1234567890123456789012345678901234567890',
        amount: 'one hundred',
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC20Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Field "amount"/);
    });

    it('throws when contractId is not a string', async () => {
      const params = {
        contractId: 12345,
        recipientAddress: '0x1234567890123456789012345678901234567890',
        amount: 100,
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC20Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Field "contractId"/);
    });

    it('throws when recipientAddress is not a string', async () => {
      const params = {
        contractId: '0.0.5678',
        recipientAddress: 67890,
        amount: 100,
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC20Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Field "recipientAddress"/);
    });

    it('throws when multiple fields are invalid', async () => {
      const params = {
        contractId: 123,
        amount: 'invalid',
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC20Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/recipientAddress/);
    });

    it('throws when AccountResolver.getHederaEVMAddress fails', async () => {
      const params = {
        contractId: '0.0.5678',
        recipientAddress: '0.0.9999',
        amount: 100,
      };

      mockedAccountResolver.getHederaEVMAddress.mockRejectedValue(new Error('Account not found'));

      const parsedParams = transferERC20Parameters().parse(params);

      await expect(
        HederaParameterNormaliser.normaliseTransferERC20Params(
          parsedParams,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow('Account not found');
    });

    it('throws when getERC20Decimals fails', async () => {
      const params = {
        contractId: '0.0.5678',
        recipientAddress: '0.0.9999',
        amount: 100,
      };

      vi.mocked(getERC20Decimals).mockRejectedValue(
        new Error('Failed to read decimals of ERC20 contract 0.0.5678'),
      );

      const parsedParams = transferERC20Parameters().parse(params);

      await expect(
        HederaParameterNormaliser.normaliseTransferERC20Params(
          parsedParams,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow('Failed to read decimals of ERC20 contract 0.0.5678');
    });

    it('throws when getHederaAccountId fails', async () => {
      const params = {
        contractId: '0x1111111111111111111111111111111111111111',
        recipientAddress: '0.0.9999',
        amount: 100,
      };

      vi.spyOn(HederaParameterNormaliser, 'getHederaAccountId').mockRejectedValue(
        new Error('Contract not found'),
      );

      const parsedParams = transferERC20Parameters().parse(params);

      await expect(
        HederaParameterNormaliser.normaliseTransferERC20Params(
          parsedParams,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow('Contract not found');
    });
  });
});
