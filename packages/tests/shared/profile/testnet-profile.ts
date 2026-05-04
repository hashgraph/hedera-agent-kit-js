import { Client, Hbar, HbarUnit, PrivateKey } from '@hiero-ledger/sdk';
import type { AcquireOpts, ConnectedClient, TestAccount, TestProfile, Tier } from './index';
import HederaOperationsWrapper from '../hedera-operations/HederaOperationsWrapper';
import { HederaMirrornodeServiceDefaultImpl, toBaseUnit } from '@hashgraph/hedera-agent-kit';
import { waitForMirrorTx } from '../retry-util';

const TESTNET_TIER_USD: Record<Tier, number> = {
  MINIMAL: 0.5,
  STANDARD: 5,
  ELEVATED: 10,
  MAXIMUM: 20,
};

const TIER_PRESET_MEMO: Record<string, string> = {
  'pending-airdrop-recipient': 'pending-airdrop recipient (maxAutoAssoc=0)',
};

const buildTestnetClient = (account: TestAccount): Client =>
  Client.forTestnet().setOperator(account.accountId, account.privateKey);

export const createTestnetProfile = (operator: TestAccount): TestProfile => {
  const operatorClient = buildTestnetClient(operator);
  const operatorWrapper = new HederaOperationsWrapper(operatorClient);

  let exchangeRate: number | null = null;

  const fetchLiveRate = async (): Promise<number> => {
    const mirrornode = new HederaMirrornodeServiceDefaultImpl(operatorClient.ledgerId!);
    const resp = await mirrornode.getExchangeRate();
    const r = resp.current_rate;
    return r.cent_equivalent / r.hbar_equivalent / 100;
  };

  const usdToHbar = (usd: number): number => {
    if (exchangeRate === null) {
      throw new Error(
        'Testnet profile balance not initialized — call profile.balance.init() first (vitest globalSetup).',
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
          initialBalance: usdToHbar(TESTNET_TIER_USD[tier]),
          accountMemo,
          ...(maxAutomaticTokenAssociations !== undefined && { maxAutomaticTokenAssociations }),
        });

        // Block until mirror has ingested the account so callers can immediately use
        // the returned identity in mirror-backed lookups (EVM relay, getAccountInfo, etc.).
        await waitForMirrorTx(operatorWrapper, resp.transactionId!);

        return { accountId: resp.accountId!, privateKey };
      },

      // Try deleteAccount (returns full balance to the operator); on failure (e.g. the
      // account holds tokens), fall back to transferring HBAR back manually, leaving
      // 0.1 HBAR behind to pay for the transfer fee.
      async release(account: TestAccount): Promise<void> {
        const accountClient = buildTestnetClient(account);
        const accountWrapper = new HederaOperationsWrapper(accountClient);
        try {
          await accountWrapper.deleteAccount({
            accountId: account.accountId,
            transferAccountId: operator.accountId,
          });
        } catch {
          const balance = await accountWrapper.getAccountHbarBalance(account.accountId.toString());
          const transferTinybar = balance.toNumber() - toBaseUnit(0.1, 8).toNumber();
          if (transferTinybar < 0) return;
          const amount = new Hbar(transferTinybar, HbarUnit.Tinybar);
          await accountWrapper.transferHbar({
            hbarTransfers: [
              { accountId: operator.accountId, amount },
              { accountId: account.accountId, amount: amount.negated() },
            ],
          });
        } finally {
          accountClient.close();
        }
      },
    },

    client: {
      connectAs(account: TestAccount): ConnectedClient {
        const client = buildTestnetClient(account);
        return { client, wrapper: new HederaOperationsWrapper(client) };
      },
    },

    balance: {
      async init(): Promise<void> {
        if (exchangeRate !== null) return;
        const cached = process.env.HBAR_EXCHANGE_RATE;
        if (cached) {
          exchangeRate = Number(cached);
          return;
        }
        exchangeRate = await fetchLiveRate();
        process.env.HBAR_EXCHANGE_RATE = String(exchangeRate);
      },
      fund(tier: Tier): number {
        return usdToHbar(TESTNET_TIER_USD[tier]);
      },
      usdToHbar,
    },

    async dispose(): Promise<void> {
      operatorClient.close();
    },
  };
};
