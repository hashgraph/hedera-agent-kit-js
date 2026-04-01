import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';
import { Client } from '@hashgraph/sdk';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { ERC721_TRANSFER_FUNCTION_ABI } from '@/shared/constants/contracts';
import { transferERC721Parameters } from '@/shared/parameter-schemas/evm.zod';
import { AccountResolver } from '@/shared/utils/account-resolver';

// Mock AccountResolver
vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    resolveAccount: vi.fn(),
    getHederaEVMAddress: vi.fn(),
  },
}));

describe('HederaParameterNormaliser.normaliseTransferERC721Params', () => {
  const contractAbi = ERC721_TRANSFER_FUNCTION_ABI;
  const functionName = 'transferFrom';
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
    mockedAccountResolver.resolveAccount.mockReturnValue('0.0.1234');
    mockedAccountResolver.getHederaEVMAddress
      .mockResolvedValueOnce('0x1111111111111111111111111111111111111111') // fromAddress
      .mockResolvedValueOnce('0x2222222222222222222222222222222222222222'); // toAddress
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encodes the function call with all parameters', async () => {
    const params = {
      contractId: '0.0.5678',
      fromAddress: '0.0.1234',
      toAddress: '0x2222222222222222222222222222222222222222',
      tokenId: 1,
    };

    const parsedParams = transferERC721Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseTransferERC721Params(
      parsedParams,
      contractAbi,
      functionName,
      context,
      mockMirrorNode,
      mockClient,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      1,
    ]);
    expect(result.contractId).toBe('0.0.5678');
    expect(result.gas).toBe(100_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('resolves fromAddress using AccountResolver pattern', async () => {
    const params = {
      contractId: '0.0.5678',
      fromAddress: '0.0.9999',
      toAddress: '0.0.8888',
      tokenId: 2,
    };

    mockedAccountResolver.resolveAccount.mockReturnValue('0.0.9999');
    mockedAccountResolver.getHederaEVMAddress.mockReset();
    mockedAccountResolver.getHederaEVMAddress
      .mockResolvedValueOnce('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
      .mockResolvedValueOnce('0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb');

    const parsedParams = transferERC721Parameters().parse(params);

    await HederaParameterNormaliser.normaliseTransferERC721Params(
      parsedParams,
      contractAbi,
      functionName,
      context,
      mockMirrorNode,
      mockClient,
    );

    expect(mockedAccountResolver.resolveAccount).toHaveBeenCalledWith(
      '0.0.9999',
      context,
      mockClient,
    );
    expect(mockedAccountResolver.getHederaEVMAddress).toHaveBeenCalledWith(
      '0.0.9999',
      mockMirrorNode,
    );
    expect(mockedAccountResolver.getHederaEVMAddress).toHaveBeenCalledWith(
      '0.0.8888',
      mockMirrorNode,
    );
    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
      '0xbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
      2,
    ]);
  });

  it('resolves EVM address to Hedera account ID for contract', async () => {
    const params = {
      contractId: '0x1111111111111111111111111111111111111111',
      fromAddress: '0.0.1234',
      toAddress: '0.0.5678',
      tokenId: 0,
    };

    vi.spyOn(HederaParameterNormaliser, 'getHederaAccountId').mockResolvedValue('0.0.8888');
    mockedAccountResolver.resolveAccount.mockReturnValue('0.0.1234');
    mockedAccountResolver.getHederaEVMAddress.mockReset();
    mockedAccountResolver.getHederaEVMAddress
      .mockResolvedValueOnce('0x3333333333333333333333333333333333333333')
      .mockResolvedValueOnce('0x4444444444444444444444444444444444444444');

    const parsedParams = transferERC721Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseTransferERC721Params(
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

  it('handles optional fromAddress by resolving from context', async () => {
    const params = {
      contractId: '0.0.5678',
      toAddress: '0.0.8888',
      tokenId: 3,
    };

    mockedAccountResolver.resolveAccount.mockReturnValue('0.0.1234');
    mockedAccountResolver.getHederaEVMAddress.mockReset();
    mockedAccountResolver.getHederaEVMAddress
      .mockResolvedValueOnce('0x5555555555555555555555555555555555555555')
      .mockResolvedValueOnce('0x6666666666666666666666666666666666666666');

    const parsedParams = transferERC721Parameters().parse(params);

    await HederaParameterNormaliser.normaliseTransferERC721Params(
      parsedParams,
      contractAbi,
      functionName,
      context,
      mockMirrorNode,
      mockClient,
    );

    expect(mockedAccountResolver.resolveAccount).toHaveBeenCalledWith(
      undefined,
      context,
      mockClient,
    );
    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      '0x5555555555555555555555555555555555555555',
      '0x6666666666666666666666666666666666666666',
      3,
    ]);
  });

  it('handles large tokenId values', async () => {
    const params = {
      contractId: '0.0.5678',
      fromAddress: '0.0.1234',
      toAddress: '0x2222222222222222222222222222222222222222',
      tokenId: 999_999_999,
    };

    const parsedParams = transferERC721Parameters().parse(params);

    await HederaParameterNormaliser.normaliseTransferERC721Params(
      parsedParams,
      contractAbi,
      functionName,
      context,
      mockMirrorNode,
      mockClient,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      '0x1111111111111111111111111111111111111111',
      '0x2222222222222222222222222222222222222222',
      999_999_999,
    ]);
  });

  describe('error handling', () => {
    it('throws when contractId is missing', async () => {
      const params = {
        fromAddress: '0.0.1234',
        toAddress: '0x2222222222222222222222222222222222222222',
        tokenId: 1,
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC721Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Invalid parameters: Field "contractId" - Required/);
    });

    it('throws when toAddress is missing', async () => {
      const params = {
        contractId: '0.0.5678',
        fromAddress: '0.0.1234',
        tokenId: 1,
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC721Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Invalid parameters: Field "toAddress" - Required/);
    });

    it('throws when tokenId is missing', async () => {
      const params = {
        contractId: '0.0.5678',
        fromAddress: '0.0.1234',
        toAddress: '0x2222222222222222222222222222222222222222',
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC721Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Invalid parameters: Field "tokenId" - Required/);
    });

    it('throws when tokenId is not a number', async () => {
      const params = {
        contractId: '0.0.5678',
        fromAddress: '0.0.1234',
        toAddress: '0x2222222222222222222222222222222222222222',
        tokenId: 'one',
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC721Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Field "tokenId"/);
    });

    it('throws when contractId is not a string', async () => {
      const params = {
        contractId: 12345,
        fromAddress: '0.0.1234',
        toAddress: '0x2222222222222222222222222222222222222222',
        tokenId: 1,
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC721Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Field "contractId"/);
    });

    it('throws when toAddress is not a string', async () => {
      const params = {
        contractId: '0.0.5678',
        fromAddress: '0.0.1234',
        toAddress: 67890,
        tokenId: 1,
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC721Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Field "toAddress"/);
    });

    it('throws when multiple fields are invalid', async () => {
      const params = {
        contractId: 123,
        tokenId: 'invalid',
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseTransferERC721Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/toAddress/);
    });

    it('throws when getHederaEVMAddress fails for fromAddress', async () => {
      const params = {
        contractId: '0.0.5678',
        fromAddress: '0.0.9999',
        toAddress: '0.0.8888',
        tokenId: 1,
      };

      mockedAccountResolver.resolveAccount.mockReturnValue('0.0.9999');
      mockedAccountResolver.getHederaEVMAddress.mockReset();
      mockedAccountResolver.getHederaEVMAddress
        .mockRejectedValueOnce(new Error('From account not found'))
        .mockResolvedValueOnce('0x2222222222222222222222222222222222222222');

      const parsedParams = transferERC721Parameters().parse(params);

      await expect(
        HederaParameterNormaliser.normaliseTransferERC721Params(
          parsedParams,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow('From account not found');
    });

    it('throws when getHederaEVMAddress fails for toAddress', async () => {
      const params = {
        contractId: '0.0.5678',
        fromAddress: '0.0.1234',
        toAddress: '0.0.8888',
        tokenId: 1,
      };

      mockedAccountResolver.resolveAccount.mockReturnValue('0.0.1234');
      mockedAccountResolver.getHederaEVMAddress.mockReset();
      mockedAccountResolver.getHederaEVMAddress
        .mockResolvedValueOnce('0x1111111111111111111111111111111111111111')
        .mockRejectedValueOnce(new Error('To account not found'));

      const parsedParams = transferERC721Parameters().parse(params);

      await expect(
        HederaParameterNormaliser.normaliseTransferERC721Params(
          parsedParams,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow('To account not found');
    });

    it('throws when getHederaAccountId fails', async () => {
      const params = {
        contractId: '0x1111111111111111111111111111111111111111',
        fromAddress: '0.0.1234',
        toAddress: '0.0.8888',
        tokenId: 1,
      };

      vi.spyOn(HederaParameterNormaliser, 'getHederaAccountId').mockRejectedValue(
        new Error('Contract not found'),
      );

      const parsedParams = transferERC721Parameters().parse(params);

      await expect(
        HederaParameterNormaliser.normaliseTransferERC721Params(
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
