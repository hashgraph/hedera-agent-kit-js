import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ethers } from 'ethers';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { ERC721_FACTORY_ABI } from '@/shared/constants/contracts';
import { createERC721Parameters } from '@/shared/parameter-schemas/evm.zod';

describe('HederaParameterNormaliser.normaliseCreateERC721Params', () => {
  const factoryContractId = '0.0.7890';
  const factoryAbi = ERC721_FACTORY_ABI;
  const functionName = 'deployToken';
  const context = { accountId: '0.0.1234' };

  let encodeSpy: any;

  beforeEach(() => {
    encodeSpy = vi.spyOn(ethers.Interface.prototype, 'encodeFunctionData');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encodes the function call with all parameters', () => {
    const params = {
      tokenName: 'MyNFT',
      tokenSymbol: 'MNFT',
      baseURI: 'https://example.com/metadata/',
    };

    const parsedParams = createERC721Parameters().parse(params);

    const result = HederaParameterNormaliser.normaliseCreateERC721Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
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

  it('defaults baseURI when missing', () => {
    const params = {
      tokenName: 'DefaultNFT',
      tokenSymbol: 'DNFT',
    };

    const parsedParams = createERC721Parameters().parse(params);

    const result = HederaParameterNormaliser.normaliseCreateERC721Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
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

  it('handles empty baseURI explicitly set', () => {
    const params = {
      tokenName: 'EmptyURI',
      tokenSymbol: 'EURI',
      baseURI: '',
    };

    const parsedParams = createERC721Parameters().parse(params);

    const result = HederaParameterNormaliser.normaliseCreateERC721Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
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

  it('handles long baseURI values', () => {
    const longURI = 'https://example.com/very/long/path/to/metadata/with/many/segments/';
    const params = {
      tokenName: 'LongURINFT',
      tokenSymbol: 'LURI',
      baseURI: longURI,
    };

    const parsedParams = createERC721Parameters().parse(params);

    const result = HederaParameterNormaliser.normaliseCreateERC721Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
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
    it('throws when tokenName is missing', () => {
      const params = { tokenSymbol: 'MNFT' } as any;

      expect(() =>
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
        ),
      ).toThrow(/Invalid parameters: Field "tokenName" - Required/);
    });

    it('throws when tokenSymbol is missing', () => {
      const params = { tokenName: 'NoSymbol' } as any;

      expect(() =>
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
        ),
      ).toThrow(/Invalid parameters: Field "tokenSymbol" - Required/);
    });

    it('throws when tokenName is not a string', () => {
      const params = {
        tokenName: 123, // invalid type
        tokenSymbol: 'MNFT',
        baseURI: 'https://example.com/',
      } as any;

      expect(() =>
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
        ),
      ).toThrow(/Field "tokenName"/);
    });

    it('throws when tokenSymbol is not a string', () => {
      const params = {
        tokenName: 'MyNFT',
        tokenSymbol: 456, // invalid type
        baseURI: 'https://example.com/',
      } as any;

      expect(() =>
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
        ),
      ).toThrow(/Field "tokenSymbol"/);
    });

    it('throws when baseURI is not a string', () => {
      const params = {
        tokenName: 'MyNFT',
        tokenSymbol: 'MNFT',
        baseURI: 789, // invalid type
      } as any;

      expect(() =>
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
        ),
      ).toThrow(/Field "baseURI"/);
    });

    it('throws with multiple errors when several fields are invalid', () => {
      const params = {
        tokenSymbol: 123, // invalid type
        baseURI: 456, // invalid type
      } as any;

      const fn = () =>
        HederaParameterNormaliser.normaliseCreateERC721Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
        );

      // assert that all field names appear in the thrown message
      expect(fn).toThrowError(/tokenName/);
      expect(fn).toThrowError(/tokenSymbol/);
      expect(fn).toThrowError(/baseURI/);
    });
  });
});
