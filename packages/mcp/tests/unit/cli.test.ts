import { describe, it, expect } from 'vitest';
import { LedgerId } from '@hashgraph/sdk';
import { parseArgs } from '../../src/cli';

describe('parseArgs', () => {
  it('should return testnet and empty context when no args given', () => {
    const options = parseArgs([]);
    expect(options.ledgerId).toEqual(LedgerId.TESTNET);
    expect(options.context).toEqual({});
    expect(options.tools).toBeUndefined();
  });

  it('should parse --ledger-id=testnet', () => {
    const options = parseArgs(['--ledger-id=testnet']);
    expect(options.ledgerId).toEqual(LedgerId.TESTNET);
  });

  it('should parse --ledger-id=mainnet', () => {
    const options = parseArgs(['--ledger-id=mainnet']);
    expect(options.ledgerId).toEqual(LedgerId.MAINNET);
  });

  it('should parse --tools into an array', () => {
    const options = parseArgs(['--tools=create_fungible_token_tool,transfer_hbar_tool']);
    expect(options.tools).toEqual(['create_fungible_token_tool', 'transfer_hbar_tool']);
  });

  it('should parse --agent-mode into context', () => {
    const options = parseArgs(['--agent-mode=VIEW_ONLY']);
    expect(options.context?.mode).toBe('VIEW_ONLY');
  });

  it('should parse --account-id into context', () => {
    const options = parseArgs(['--account-id=0.0.12345']);
    expect(options.context?.accountId).toBe('0.0.12345');
  });

  it('should parse --public-key into context', () => {
    const options = parseArgs(['--public-key=302a300506032b6570']);
    expect(options.context?.accountPublicKey).toBe('302a300506032b6570');
  });

  it('should accept --tools=all', () => {
    const options = parseArgs(['--tools=all']);
    expect(options.tools).toEqual(['all']);
  });

  it('should throw on invalid ledger-id', () => {
    expect(() => parseArgs(['--ledger-id=devnet'])).toThrow('Invalid ledger id: devnet');
  });

  it('should throw on invalid tool name', () => {
    expect(() => parseArgs(['--tools=bogus_tool'])).toThrow('Invalid tool: bogus_tool');
  });

  it('should throw on unknown argument', () => {
    expect(() => parseArgs(['--unknown=value'])).toThrow('Invalid argument: unknown');
  });
});
