import { AccountId, Client, LedgerId, PrivateKey } from '@hiero-ledger/sdk';
import type { AcquireOpts, ConnectedClient, TestAccount, TestProfile, Tier } from './index';
import HederaOperationsWrapper from '../hedera-operations/HederaOperationsWrapper';
import { CONSENSUS_NODE_ACCOUNT_ID, CONSENSUS_NODE_ENDPOINT, MIRROR_NODE_ENDPOINT } from '../setup/constants';
import { waitForMirrorTx } from '../retry-util';

const SOLO_USD_PER_HBAR = 0.12;
const SOLO_TIER_USD: Record<Tier, number> = {
  MINIMAL: 5,    // 10× testnet's $0.50; cheap on Solo, gives tests room to breathe
  STANDARD: 50,  // 10× testnet's $5
  ELEVATED: 100, // 10× testnet's $10
  MAXIMUM: 200,  // 10× testnet's $20
};

const TIER_PRESET_MEMO: Record<string, string> = {
  'pending-airdrop-recipient': 'pending-airdrop recipient (maxAutoAssoc=0)',
};

/**
 * Build a Hedera SDK Client targeting Solo's local-node endpoints, with the retry tuning
 * needed for single-node Solo (default 8s "node unhealthy" cooldown is unrecoverable when
 * there's only one node, so we readmit faster and try harder).
 */
const buildSoloClient = (account: TestAccount): Client => {
  const client = Client.forNetwork({
    [CONSENSUS_NODE_ENDPOINT]: AccountId.fromString(CONSENSUS_NODE_ACCOUNT_ID),
  });
  client.setLedgerId(LedgerId.LOCAL_NODE);
  client.setMirrorNetwork(MIRROR_NODE_ENDPOINT);
  client.setNodeMinReadmitPeriod(100);
  client.setNodeMaxReadmitPeriod(1000);
  client.setMaxAttempts(20);
  return client.setOperator(account.accountId, account.privateKey);
};

export const createSoloProfile = (operator: TestAccount): TestProfile => {
  const operatorClient = buildSoloClient(operator);
  const operatorWrapper = new HederaOperationsWrapper(operatorClient);

  let exchangeRate: number | null = null;

  const usdToHbar = (usd: number): number => {
    if (exchangeRate === null) {
      throw new Error(
        'Solo profile balance not initialized. Call profile.balance.init() first (vitest globalSetup).',
      );
    }
    const hbar = usd / exchangeRate;
    return Math.round(hbar * 1e8) / 1e8;
  };

  return {
    operator,

    accounts: {
      async acquire(opts: AcquireOpts = {}): Promise<TestAccount> {
        const tier = opts.tier ?? 'STANDARD';
        const privateKey = PrivateKey.generateED25519();
        const accountMemo =
          opts.accountMemo ?? (opts.preset ? TIER_PRESET_MEMO[opts.preset] : 'test account');
        const maxAutomaticTokenAssociations =
          opts.preset === 'pending-airdrop-recipient' ? 0 : undefined;

        const resp = await operatorWrapper.createAccount({
          key: privateKey.publicKey,
          initialBalance: usdToHbar(SOLO_TIER_USD[tier]),
          accountMemo,
          ...(maxAutomaticTokenAssociations !== undefined && { maxAutomaticTokenAssociations }),
        });

        // Block until mirror has ingested the account so callers can immediately use
        // the returned identity in mirror-backed lookups (EVM relay, getAccountInfo, etc.).
        await waitForMirrorTx(operatorWrapper, resp.transactionId!);

        return { accountId: resp.accountId!, privateKey };
      },

      // Solo's network is destroyed at session end (`solo destroy`); per-account cleanup
      // is wasted work. Keeping the method for symmetry with testnet so callers can write
      // network-agnostic test code.
      async release(_account: TestAccount): Promise<void> {
        return;
      },
    },

    client: {
      connectAs(account: TestAccount): ConnectedClient {
        const client = buildSoloClient(account);
        return { client, wrapper: new HederaOperationsWrapper(client) };
      },
    },

    balance: {
      async init(): Promise<void> {
        if (exchangeRate !== null) return;
        // Defer to a cached rate from globalSetup or another worker if available.
        // Otherwise, fall back to Solo's well-known constant. Mirror it to env so other
        // workers see the same number.
        const cached = process.env.HBAR_EXCHANGE_RATE;
        if (cached) {
          exchangeRate = Number(cached);
          return;
        }
        exchangeRate = SOLO_USD_PER_HBAR;
        process.env.HBAR_EXCHANGE_RATE = String(SOLO_USD_PER_HBAR);
      },
      fund(tier: Tier): number {
        return usdToHbar(SOLO_TIER_USD[tier]);
      },
      usdToHbar,
    },

    async dispose(): Promise<void> {
      operatorClient.close();
    },
  };
};
