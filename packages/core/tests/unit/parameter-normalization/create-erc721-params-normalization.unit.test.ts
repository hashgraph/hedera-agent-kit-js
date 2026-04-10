import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { ERC721_FACTORY_ABI } from '@/shared/constants/contracts';
import { createERC721Parameters } from '@/shared/parameter-schemas/evm.zod';
import { Client } from '@hashgraph/sdk';

describe('HederaParameterNormaliser.normaliseCreateERC721Params', () => {
  const factoryContractId = '0.0.7890';
  const factoryAbi = ERC721_FACTORY_ABI;
  const functionName = 'deployToken';
  const context = { accountId: '0.0.1234' };
  let mockClient: Client;

  let encodeSpy: any;

  beforeEach(() => {
    encodeSpy = vi.spyOn(ethers.Interface.prototype, 'encodeFunctionData');
    vi.clearAllMocks();
    mockClient = {} as Client; // mock client instance
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encodes the function call with all parameters', async () => {
    const params = {
      tokenName: 'MyNFT',
      tokenSymbol: 'MNFT',
      baseURI: 'https://example.com/metadata/',
    };

    const parsedParams = createERC721Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseCreateERC721Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
      mockClient,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      parsedParams.tokenName,
      parsedParams.tokenSymbol,
      parsedParams.baseURI,
    ]);

    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('defaults baseURI when missing', async () => {
    const params = {
      tokenName: 'DefaultNFT',
      tokenSymbol: 'DNFT',
    };

    const parsedParams = createERC721Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseCreateERC721Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
      mockClient,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      parsedParams.tokenName,
      parsedParams.tokenSymbol,
      '',
    ]);

    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('handles empty baseURI explicitly set', async () => {
    const params = {
      tokenName: 'EmptyURI',
      tokenSymbol: 'EURI',
      baseURI: '',
    };

    const parsedParams = createERC721Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseCreateERC721Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
      mockClient,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      parsedParams.tokenName,
      parsedParams.tokenSymbol,
      '',
    ]);

    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('handles long baseURI values', async () => {
    const longURI = 'https://example.com/very/long/path/to/metadata/with/many/segments/';
    const params = {
      tokenName: 'LongURINFT',
      tokenSymbol: 'LURI',
      baseURI: longURI,
    };

    const parsedParams = createERC721Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseCreateERC721Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
      mockClient,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      parsedParams.tokenName,
      parsedParams.tokenSymbol,
      longURI,
    ]);

    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  describe('error handling', () => {
    it('throws when tokenName is missing', async () => {
      const params = { tokenSymbol: 'MNFT' } as any;

      await expect(
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
          mockClient,
        ),
      ).rejects.toThrow(/Invalid parameters: Field "tokenName" - Required/);
    });

    it('throws when tokenSymbol is missing', async () => {
      const params = { tokenName: 'NoSymbol' } as any;

      await expect(
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
          mockClient,
        ),
      ).rejects.toThrow(/Invalid parameters: Field "tokenSymbol" - Required/);
    });

    it('throws when tokenName is not a string', async () => {
      const params = {
        tokenName: 123,
        tokenSymbol: 'MNFT',
        baseURI: 'https://example.com/',
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
          mockClient,
        ),
      ).rejects.toThrow(/Field "tokenName"/);
    });

    it('throws when tokenSymbol is not a string', async () => {
      const params = {
        tokenName: 'MyNFT',
        tokenSymbol: 456,
        baseURI: 'https://example.com/',
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
          mockClient,
        ),
      ).rejects.toThrow(/Field "tokenSymbol"/);
    });

    it('throws when baseURI is not a string', async () => {
      const params = {
        tokenName: 'MyNFT',
        tokenSymbol: 'MNFT',
        baseURI: 789,
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
          mockClient,
        ),
      ).rejects.toThrow(/Field "baseURI"/);
    });

    it('throws with multiple errors when several fields are invalid', async () => {
      const params = {
        tokenSymbol: 123,
        baseURI: 456,
      } as any;

      const fn = () =>
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
          mockClient,
        );

      await expect(fn()).rejects.toThrowError(/tokenName/);
      await expect(fn()).rejects.toThrowError(/tokenSymbol/);
      await expect(fn()).rejects.toThrowError(/baseURI/);
    });
  });
});
