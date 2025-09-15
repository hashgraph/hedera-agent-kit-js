import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, LedgerId } from '@hashgraph/sdk';
import toolFactory, {
  AIRDROP_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/airdrop-fungible-token';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { handleTransaction } from '@/shared/strategies/tx-mode-strategy';
import type { Context } from '@/shared/configuration';

vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser');
vi.mock('@/shared/hedera-utils/hedera-builder');
vi.mock('@/shared/strategies/tx-mode-strategy');

describe('Airdrop Fungible Token Tool Unit Tests', () => {
  let client: Client;
  let context: Context;

  beforeEach(() => {
    client = { ledgerId: LedgerId.TESTNET } as Client;
    context = { accountId: '0.0.1234' };
    vi.clearAllMocks();
  });

  it('should define the tool with correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(AIRDROP_FUNGIBLE_TOKEN_TOOL);
    expect(tool.name).toBe('Airdrop Fungible Token');
    expect(tool.parameters).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('should execute airdrop successfully', async () => {
    const params = {
      tokenId: '0.0.5678',
      sourceAccountId: '0.0.1234',
      recipients: [{ accountId: '0.0.4321', amount: 50 }],
    };

    const normalisedParams = { tokenTransfers: [] };
    (HederaParameterNormaliser.normaliseAirdropFungibleTokenParams as any).mockResolvedValue(
      normalisedParams,
    );
    const tx = { mockTx: true };
    (HederaBuilder.airdropFungibleToken as any).mockReturnValue(tx);
    (handleTransaction as any).mockResolvedValue({
      humanMessage: 'Token successfully airdropped with transaction id tx123',
      raw: { transactionId: 'tx123', status: 'SUCCESS' },
    });

    const tool = toolFactory(context);
    const result = await tool.execute(client, context, params);

    expect(HederaParameterNormaliser.normaliseAirdropFungibleTokenParams).toHaveBeenCalledWith(
      params,
      context,
      client,
      expect.anything(), // mirror node
    );
    expect(HederaBuilder.airdropFungibleToken).toHaveBeenCalledWith(normalisedParams);
    expect(handleTransaction).toHaveBeenCalledWith(tx, client, context, expect.any(Function));
    expect(result.humanMessage).toContain('successfully airdropped');
  });

  it('should handle errors gracefully', async () => {
    const params = {
      tokenId: '0.0.5678',
      sourceAccountId: '0.0.1234',
      recipients: [{ accountId: '0.0.4321', amount: 50 }],
    };

    (HederaParameterNormaliser.normaliseAirdropFungibleTokenParams as any).mockRejectedValue(
      new Error('Something went wrong'),
    );

    const tool = toolFactory(context);
    const result = await tool.execute(client, context, params);

    expect(result.humanMessage).toContain('Something went wrong');
    expect(result.raw.error).toContain('Something went wrong');
  });
});
