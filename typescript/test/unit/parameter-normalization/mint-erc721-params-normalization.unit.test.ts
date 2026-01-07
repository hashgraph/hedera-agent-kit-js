import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';
import { Client } from '@hashgraph/sdk';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { ERC721_MINT_FUNCTION_ABI, ERC721_MINT_FUNCTION_NAME } from '@/shared/constants/contracts';
import { mintERC721Parameters } from '@/shared/parameter-schemas/evm.zod';
import { AccountResolver } from '@/shared/utils/account-resolver';

// Mock AccountResolver
vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    resolveAccount: vi.fn(),
    getHederaEVMAddress: vi.fn(),
  },
}));

describe('HederaParameterNormaliser.normaliseMintERC721Params', () => {
  const contractAbi = ERC721_MINT_FUNCTION_ABI;
  const functionName = ERC721_MINT_FUNCTION_NAME;
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

    // default resolver behavior
    mockedAccountResolver.resolveAccount.mockReturnValue('0.0.1234');
    mockedAccountResolver.getHederaEVMAddress.mockResolvedValue(
      '0x1111111111111111111111111111111111111111',
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encodes mint function with resolved toAddress', async () => {
    const params = {
      contractId: '0.0.5678',
      toAddress: '0x2222222222222222222222222222222222222222',
    };

    const parsedParams = mintERC721Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseMintERC721Params(
      parsedParams,
      contractAbi,
      functionName,
      context,
      mockMirrorNode,
      mockClient,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      '0x1111111111111111111111111111111111111111',
    ]);
    expect(result.contractId).toBe('0.0.5678');
    expect(result.gas).toBe(100_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('resolves toAddress when provided as Hedera account id', async () => {
    const params = {
      contractId: '0.0.5678',
      toAddress: '0.0.9999',
    };

    mockedAccountResolver.getHederaEVMAddress.mockReset();
    mockedAccountResolver.getHederaEVMAddress.mockResolvedValueOnce(
      '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    );
    mockedAccountResolver.resolveAccount.mockReturnValue(params.toAddress);

    const parsedParams = mintERC721Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseMintERC721Params(
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
    expect(result.functionParameters).toBeDefined();
  });

  it('defaults toAddress to context operator when missing', async () => {
    mockedAccountResolver.resolveAccount.mockReset();
    mockedAccountResolver.resolveAccount.mockReturnValue('0.0.1234');
    mockedAccountResolver.getHederaEVMAddress.mockReset();
    mockedAccountResolver.getHederaEVMAddress.mockResolvedValueOnce(
      '0xcccccccccccccccccccccccccccccccccccccccc',
    );

    const params = { contractId: '0.0.5678' } as any;

    const parsedParams = mintERC721Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseMintERC721Params(
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
      '0xcccccccccccccccccccccccccccccccccccccccc',
    ]);
    expect(result.contractId).toBe('0.0.5678');
  });

  describe('error handling', () => {
    it('throws when contractId is missing', async () => {
      const params = { toAddress: '0x2222' } as any;

      await expect(
        HederaParameterNormaliser.normaliseMintERC721Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Invalid parameters: Field "contractId" - Required/);
    });

    it('throws when toAddress is invalid type', async () => {
      const params = { contractId: '0.0.5678', toAddress: 12345 } as any;

      await expect(
        HederaParameterNormaliser.normaliseMintERC721Params(
          params,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow(/Field "toAddress"/);
    });

    it('throws when AccountResolver.getHederaEVMAddress fails', async () => {
      const params = { contractId: '0.0.5678', toAddress: '0.0.9999' };

      mockedAccountResolver.getHederaEVMAddress.mockRejectedValue(new Error('Account not found'));

      const parsedParams = mintERC721Parameters().parse(params);

      await expect(
        HederaParameterNormaliser.normaliseMintERC721Params(
          parsedParams,
          contractAbi,
          functionName,
          context,
          mockMirrorNode,
          mockClient,
        ),
      ).rejects.toThrow('Account not found');
    });

    it('throws when getHederaAccountId fails', async () => {
      const params = {
        contractId: '0x1111111111111111111111111111111111111111',
        toAddress: '0.0.9999',
      };

      vi.spyOn(HederaParameterNormaliser, 'getHederaAccountId').mockRejectedValue(
        new Error('Contract not found'),
      );

      const parsedParams = mintERC721Parameters().parse(params);

      await expect(
        HederaParameterNormaliser.normaliseMintERC721Params(
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
