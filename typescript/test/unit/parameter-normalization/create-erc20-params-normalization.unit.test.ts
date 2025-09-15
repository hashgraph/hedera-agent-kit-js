import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { ethers } from 'ethers';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { ERC20_FACTORY_ABI } from '@/shared/constants/contracts';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';

describe('HederaParameterNormaliser.normaliseCreateERC20Params', () => {
  const factoryContractId = '0.0.7890';
  const factoryAbi = ERC20_FACTORY_ABI;
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
      tokenName: 'MyToken',
      tokenSymbol: 'MTK',
      decimals: 8,
      initialSupply: 1000,
    };

    const parsedParams = createERC20Parameters().parse(params);

    const result = HederaParameterNormaliser.normaliseCreateERC20Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      parsedParams.tokenName,
      parsedParams.tokenSymbol,
      parsedParams.decimals,
      parsedParams.initialSupply,
    ]);

    expect(result.tokenName).toBe('MyToken');
    expect(result.tokenSymbol).toBe('MTK');
    expect(result.decimals).toBe(8);
    expect(result.initialSupply).toBe(1000);
    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('defaults decimals and initialSupply when missing', () => {
    const params = {
      tokenName: 'DefaultToken',
      tokenSymbol: 'DEF',
    };

    const parsedParams = createERC20Parameters().parse(params);

    const result = HederaParameterNormaliser.normaliseCreateERC20Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      parsedParams.tokenName,
      parsedParams.tokenSymbol,
      18,
      0,
    ]);

    expect(result.tokenName).toBe('DefaultToken');
    expect(result.tokenSymbol).toBe('DEF');
    expect(result.decimals).toBe(18);
    expect(result.initialSupply).toBe(0);
    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('handles decimals = 0', () => {
    const params = {
      tokenName: 'ZeroDecimals',
      tokenSymbol: 'ZDC',
      decimals: 0,
      initialSupply: 500,
    };

    const parsedParams = createERC20Parameters().parse(params);

    const result = HederaParameterNormaliser.normaliseCreateERC20Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      parsedParams.tokenName,
      parsedParams.tokenSymbol,
      0,
      500,
    ]);

    expect(result.tokenName).toBe('ZeroDecimals');
    expect(result.tokenSymbol).toBe('ZDC');
    expect(result.decimals).toBe(0);
    expect(result.initialSupply).toBe(500);
    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('supports large initialSupply values', () => {
    const params = {
      tokenName: 'WhaleToken',
      tokenSymbol: 'WHL',
      decimals: 18,
      initialSupply: 1_000_000_000,
    };

    const parsedParams = createERC20Parameters().parse(params);

    const result = HederaParameterNormaliser.normaliseCreateERC20Params(
      parsedParams,
      factoryContractId,
      factoryAbi,
      functionName,
      context,
    );

    expect(encodeSpy).toHaveBeenCalledWith(functionName, [
      parsedParams.tokenName,
      parsedParams.tokenSymbol,
      18,
      1_000_000_000,
    ]);

    expect(result.tokenName).toBe('WhaleToken');
    expect(result.tokenSymbol).toBe('WHL');
    expect(result.decimals).toBe(18);
    expect(result.initialSupply).toBe(1_000_000_000);
    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  describe('error handling', () => {
    it('throws when tokenName is missing', () => {
      const params = { tokenSymbol: 'DEF' } as any;

      expect(() =>
        HederaParameterNormaliser.normaliseCreateERC20Params(
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
        HederaParameterNormaliser.normaliseCreateERC20Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
        ),
      ).toThrow(/Invalid parameters: Field "tokenSymbol" - Required/);
    });

    it('throws when decimals is not a number', () => {
      const params = {
        tokenName: 'BadDecimals',
        tokenSymbol: 'BDC',
        decimals: 'eighteen', // invalid type
      } as any;

      expect(() =>
        HederaParameterNormaliser.normaliseCreateERC20Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
        ),
      ).toThrow(/Field "decimals"/);
    });

    it('throws when decimals is negative', () => {
      const params = {
        tokenName: 'BadDecimals',
        tokenSymbol: 'BDC',
        decimals: -1,
      } as any;

      expect(() =>
        HederaParameterNormaliser.normaliseCreateERC20Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
        ),
      ).toThrow(/Field "decimals"/);
    });

    it('throws when initialSupply is negative', () => {
      const params = {
        tokenName: 'BadSupply',
        tokenSymbol: 'BDS',
        initialSupply: -100,
      } as any;

      expect(() =>
        HederaParameterNormaliser.normaliseCreateERC20Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
        ),
      ).toThrow(/Field "initialSupply"/);
    });

    it('throws with multiple errors when several fields are invalid', () => {
      const params = {
        tokenSymbol: 123, // invalid type
        decimals: -5, // invalid value
        initialSupply: -10, // invalid value
      } as any;

      const fn = () =>
        HederaParameterNormaliser.normaliseCreateERC20Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
        );

      // assert that all field names appear in the thrown message
      expect(fn).toThrowError(/tokenName/);
      expect(fn).toThrowError(/tokenSymbol/);
      expect(fn).toThrowError(/decimals/);
      expect(fn).toThrowError(/initialSupply/);
    });
  });
});
