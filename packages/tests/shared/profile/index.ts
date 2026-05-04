/**
 * TestProfile — single source of truth for "what does running tests on this Hedera
 * environment look like?"
 *
 * Two adapters (`soloProfile`, `testnetProfile`) implement the interface; tests get the
 * active one via `getProfile()`. After this module exists, `getTestNetwork()` should not
 * appear anywhere outside this directory.
 */

import type { AccountId, Client, PrivateKey } from '@hiero-ledger/sdk';
import type HederaOperationsWrapper from '../hedera-operations/HederaOperationsWrapper';

export type TestAccount = {
  accountId: AccountId;
  privateKey: PrivateKey;
};

export type Tier = 'MINIMAL' | 'STANDARD' | 'ELEVATED' | 'MAXIMUM';

export type AcquirePreset = 'pending-airdrop-recipient';

export type AcquireOpts = {
  tier?: Tier;
  preset?: AcquirePreset;
  accountMemo?: string;
};

export type ConnectedClient = {
  client: Client;
  wrapper: HederaOperationsWrapper;
};

export type TestProfile = {
  /**
   * The session's env-derived operator. Use `accounts.acquire()` for test identities;
   * touch `operator` only when a test genuinely needs the env account itself
   * (e.g. asserting it's a token's admin key).
   */
  operator: TestAccount;

  accounts: {
    acquire(opts?: AcquireOpts): Promise<TestAccount>;
    release(account: TestAccount): Promise<void>;
  };

  client: {
    /** Build an SDK Client + ops wrapper for the given account. */
    connectAs(account: TestAccount): ConnectedClient;
  };

  balance: {
    /** Called once at session start (vitest globalSetup). Idempotent. */
    init(): Promise<void>;
    /** HBAR amount for the named funding tier. */
    fund(tier: Tier): number;
    /** HBAR amount for an arbitrary USD value. Use `fund(tier)` when you can. */
    usdToHbar(usd: number): number;
  };
};

export { getProfile } from './resolve';
