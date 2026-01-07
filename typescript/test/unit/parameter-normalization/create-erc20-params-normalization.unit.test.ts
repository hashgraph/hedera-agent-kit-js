import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ethers } from 'ethers';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import { ERC20_FACTORY_ABI } from '@/shared/constants/contracts';
import { createERC20Parameters } from '@/shared/parameter-schemas/evm.zod';
import { AccountId, Client } from '@hashgraph/sdk';
import { AccountResolver } from '@/shared';

describe('HederaParameterNormaliser.normaliseCreateERC20Params', () => {
  const factoryContractId = '0.0.7890';
  const factoryAbi = ERC20_FACTORY_ABI;
  const functionName = 'deployToken';
  const context = { accountId: '0.0.1234' };
  let mockClient: Client;
  const operatorId = AccountId.fromString('0.0.5005').toString();

  let encodeSpy: any;

  beforeEach(() => {
    encodeSpy = vi.spyOn(ethers.Interface.prototype, 'encodeFunctionData');

    // Spy on AccountResolver.resolveAccount
    vi.spyOn(AccountResolver, 'resolveAccount').mockReturnValue(operatorId);

    vi.clearAllMocks();
    mockClient = {} as Client;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encodes the function call with all parameters', async () => {
    const params = {
      tokenName: 'MyToken',
      tokenSymbol: 'MTK',
      decimals: 8,
      initialSupply: 1000,
    };

    const parsedParams = createERC20Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseCreateERC20Params(
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
      parsedParams.decimals,
      parsedParams.initialSupply,
    ]);

    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('defaults decimals and initialSupply when missing', async () => {
    const params = {
      tokenName: 'DefaultToken',
      tokenSymbol: 'DEF',
    };

    const parsedParams = createERC20Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseCreateERC20Params(
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
      18,
      0,
    ]);

    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('handles decimals = 0', async () => {
    const params = {
      tokenName: 'ZeroDecimals',
      tokenSymbol: 'ZDC',
      decimals: 0,
      initialSupply: 500,
    };

    const parsedParams = createERC20Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseCreateERC20Params(
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
      0,
      500,
    ]);

    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  it('supports large initialSupply values', async () => {
    const params = {
      tokenName: 'WhaleToken',
      tokenSymbol: 'WHL',
      decimals: 18,
      initialSupply: 1_000_000_000,
    };

    const parsedParams = createERC20Parameters().parse(params);

    const result = await HederaParameterNormaliser.normaliseCreateERC20Params(
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
      18,
      1_000_000_000,
    ]);

    expect(result.contractId).toBe(factoryContractId);
    expect(result.gas).toBe(3_000_000);
    expect(result.functionParameters).toBeDefined();
  });

  describe('error handling', () => {
    it('throws when tokenName is missing', async () => {
      const params = { tokenSymbol: 'DEF' } as any;

      await expect(
        HederaParameterNormaliser.normaliseCreateERC20Params(
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
        HederaParameterNormaliser.normaliseCreateERC20Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
          mockClient,
        ),
      ).rejects.toThrow(/Invalid parameters: Field "tokenSymbol" - Required/);
    });

    it('throws when decimals is not a number', async () => {
      const params = {
        tokenName: 'BadDecimals',
        tokenSymbol: 'BDC',
        decimals: 'eighteen',
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseCreateERC20Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
          mockClient,
        ),
      ).rejects.toThrow(/Field "decimals"/);
    });

    it('throws when decimals is negative', async () => {
      const params = {
        tokenName: 'BadDecimals',
        tokenSymbol: 'BDC',
        decimals: -1,
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseCreateERC20Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
          mockClient,
        ),
      ).rejects.toThrow(/Field "decimals"/);
    });

    it('throws when initialSupply is negative', async () => {
      const params = {
        tokenName: 'BadSupply',
        tokenSymbol: 'BDS',
        initialSupply: -100,
      } as any;

      await expect(
        HederaParameterNormaliser.normaliseCreateERC20Params(
          params,
          factoryContractId,
          factoryAbi,
          functionName,
          context,
          mockClient,
        ),
      ).rejects.toThrow(/Field "initialSupply"/);
    });

    it('throws with multiple errors when several fields are invalid', async () => {
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
          mockClient,
        );

      await expect(fn()).rejects.toThrowError(/tokenName/);
      await expect(fn()).rejects.toThrowError(/tokenSymbol/);
      await expect(fn()).rejects.toThrowError(/decimals/);
      await expect(fn()).rejects.toThrowError(/initialSupply/);
    });
  });
});
