import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  getERC20FactoryAddress,
  getERC721FactoryAddress,
} from '@/shared/constants/contracts';

const ENV_VARS = [
  'HEDERA_ERC20_FACTORY_ADDRESS',
  'HEDERA_ERC721_FACTORY_ADDRESS',
  'HEDERA_NETWORK',
] as const;

const DEPRECATED_TESTNET_ERC20 = '0.0.6471814';
const DEPRECATED_TESTNET_ERC721 = '0.0.6510666';

describe('getERC20FactoryAddress', () => {
  let originalEnv: Record<string, string | undefined>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = Object.fromEntries(ENV_VARS.map((k) => [k, process.env[k]]));
    ENV_VARS.forEach((k) => delete process.env[k]);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    ENV_VARS.forEach((k) => {
      const value = originalEnv[k];
      if (value === undefined) delete process.env[k];
      else process.env[k] = value;
    });
    warnSpy.mockRestore();
  });

  it('should return the env var value when set to a valid Hedera contract ID', () => {
    process.env.HEDERA_ERC20_FACTORY_ADDRESS = '0.0.1234567';
    expect(getERC20FactoryAddress()).toBe('0.0.1234567');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should accept a contract ID with a checksum suffix', () => {
    process.env.HEDERA_ERC20_FACTORY_ADDRESS = '0.0.6471814-vfmkw';
    expect(getERC20FactoryAddress()).toBe('0.0.6471814-vfmkw');
  });

  it('should fall back to the deprecated testnet default and warn when unset on testnet', () => {
    process.env.HEDERA_NETWORK = 'testnet';
    expect(getERC20FactoryAddress()).toBe(DEPRECATED_TESTNET_ERC20);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(/\[deprecated\].*ERC20.*HEDERA_ERC20_FACTORY_ADDRESS/);
  });

  it('should treat an empty-string env var as unset and fall back on testnet', () => {
    process.env.HEDERA_NETWORK = 'testnet';
    process.env.HEDERA_ERC20_FACTORY_ADDRESS = '';
    expect(getERC20FactoryAddress()).toBe(DEPRECATED_TESTNET_ERC20);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('should throw when the env var is unset and the network is not testnet', () => {
    process.env.HEDERA_NETWORK = 'mainnet';
    expect(() => getERC20FactoryAddress()).toThrow(/HEDERA_ERC20_FACTORY_ADDRESS is not set/);
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should throw when the env var is unset and HEDERA_NETWORK is also unset', () => {
    expect(() => getERC20FactoryAddress()).toThrow(/HEDERA_ERC20_FACTORY_ADDRESS is not set/);
  });

  it('should throw when the env var is set to a malformed value, even on testnet', () => {
    process.env.HEDERA_NETWORK = 'testnet';
    process.env.HEDERA_ERC20_FACTORY_ADDRESS = '0xabc123';
    expect(() => getERC20FactoryAddress()).toThrow(
      /HEDERA_ERC20_FACTORY_ADDRESS is set to "0xabc123".*not a valid Hedera contract ID/,
    );
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should throw when the env var is set to a partially-valid value like "0.0"', () => {
    process.env.HEDERA_ERC20_FACTORY_ADDRESS = '0.0';
    expect(() => getERC20FactoryAddress()).toThrow(/not a valid Hedera contract ID/);
  });

  it('should throw when the env var contains surrounding whitespace', () => {
    process.env.HEDERA_ERC20_FACTORY_ADDRESS = '  0.0.1234567  ';
    expect(() => getERC20FactoryAddress()).toThrow(/not a valid Hedera contract ID/);
  });
});

describe('getERC721FactoryAddress', () => {
  let originalEnv: Record<string, string | undefined>;
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = Object.fromEntries(ENV_VARS.map((k) => [k, process.env[k]]));
    ENV_VARS.forEach((k) => delete process.env[k]);
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    ENV_VARS.forEach((k) => {
      const value = originalEnv[k];
      if (value === undefined) delete process.env[k];
      else process.env[k] = value;
    });
    warnSpy.mockRestore();
  });

  it('should return the env var value when set to a valid Hedera contract ID', () => {
    process.env.HEDERA_ERC721_FACTORY_ADDRESS = '0.0.7654321';
    expect(getERC721FactoryAddress()).toBe('0.0.7654321');
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('should fall back to the deprecated testnet default and warn when unset on testnet', () => {
    process.env.HEDERA_NETWORK = 'testnet';
    expect(getERC721FactoryAddress()).toBe(DEPRECATED_TESTNET_ERC721);
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toMatch(
      /\[deprecated\].*ERC721.*HEDERA_ERC721_FACTORY_ADDRESS/,
    );
  });

  it('should treat an empty-string env var as unset and fall back on testnet', () => {
    process.env.HEDERA_NETWORK = 'testnet';
    process.env.HEDERA_ERC721_FACTORY_ADDRESS = '';
    expect(getERC721FactoryAddress()).toBe(DEPRECATED_TESTNET_ERC721);
  });

  it('should throw when the env var is unset and the network is not testnet', () => {
    process.env.HEDERA_NETWORK = 'mainnet';
    expect(() => getERC721FactoryAddress()).toThrow(/HEDERA_ERC721_FACTORY_ADDRESS is not set/);
  });

  it('should throw when the env var is set to a malformed value', () => {
    process.env.HEDERA_ERC721_FACTORY_ADDRESS = 'not-an-id';
    expect(() => getERC721FactoryAddress()).toThrow(
      /HEDERA_ERC721_FACTORY_ADDRESS is set to "not-an-id".*not a valid Hedera contract ID/,
    );
  });
});
