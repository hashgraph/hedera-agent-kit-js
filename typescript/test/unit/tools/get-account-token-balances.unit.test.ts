import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, LedgerId } from '@hashgraph/sdk';
import toolFactory, {
  GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL,
  getAccountTokenBalancesQuery,
} from '@/plugins/core-account-query-plugin/tools/queries/get-account-token-balances-query';
import * as mirrornodeUtils from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import type { TokenBalancesResponse } from '@/shared/hedera-utils/mirrornode/types';

vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseAccountTokenBalancesParams: vi.fn((params: any, context: any) => ({
      accountId: params.accountId ?? context.accountId,
      tokenId: params.tokenId,
    })),
  },
}));

const makeClient = () => {
  const client = Client.forNetwork({});
  client.setLedgerId(LedgerId.TESTNET);
  return client;
};

describe('getAccountTokenBalancesQuery Tool', () => {
  const context = { accountId: '0.0.1001' };
  const client = makeClient();

  const mockService = {
    getAccountTokenBalances: vi.fn<[], any>(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(mirrornodeUtils, 'getMirrornodeService').mockReturnValue(mockService);
  });

  it('exposes correct tool metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(GET_ACCOUNT_TOKEN_BALANCES_QUERY_TOOL);
    expect(tool.name).toBe('Get Account Token Balances');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('token balances for a given Hedera account');
    expect(tool.parameters).toBeTruthy();
  });

  it('calls mirrornode service and formats the response correctly', async () => {
    const accountId = '0.0.1234';
    const tokenId = '0.0.5678';
    const response: TokenBalancesResponse = {
      tokens: [
        {
          automatic_association: true,
          created_timestamp: '123',
          token_id: tokenId,
          freeze_status: 'UNFROZEN',
          kyc_status: 'GRANTED',
          balance: 2500,
          decimals: 2,
        } as any,
      ],
    };
    mockService.getAccountTokenBalances.mockResolvedValue(response);

    const res = await getAccountTokenBalancesQuery(client, context, { accountId, tokenId });

    expect(HederaParameterNormaliser.normaliseAccountTokenBalancesParams).toHaveBeenCalledWith(
      { accountId, tokenId },
      context,
      client,
    );
    expect(mirrornodeUtils.getMirrornodeService).toHaveBeenCalledWith(undefined, LedgerId.TESTNET);
    expect(mockService.getAccountTokenBalances).toHaveBeenCalledWith(accountId, tokenId);

    expect(res.raw.accountId).toBe(accountId);
    expect(res.raw.tokenBalances).toEqual(response);
    expect(res.humanMessage).toContain(`Details for ${accountId}`);
    expect(res.humanMessage).toContain(`Token: ${tokenId}`);
    expect(res.humanMessage).toContain('Balance: 2500');
    expect(res.humanMessage).toContain('Decimals: 2');
  });

  it('uses context.accountId when params.accountId is omitted', async () => {
    const tokenId = '0.0.9999';
    const response: TokenBalancesResponse = { tokens: [] };
    mockService.getAccountTokenBalances.mockResolvedValue(response);

    const res = await getAccountTokenBalancesQuery(client, context, { tokenId } as any);

    expect(HederaParameterNormaliser.normaliseAccountTokenBalancesParams).toHaveBeenCalled();
    expect(mockService.getAccountTokenBalances).toHaveBeenCalledWith('0.0.1001', tokenId);
    expect(res.raw.accountId).toBe('0.0.1001');
  });

  it('returns error message when mirrornode service throws an Error', async () => {
    mockService.getAccountTokenBalances.mockRejectedValue(new Error('mirror-boom'));
    const result = await getAccountTokenBalancesQuery(client, context, { accountId: '0.0.1' });
    expect(result.humanMessage).toContain('mirror-boom');
  });

  it('returns generic failure message when mirrornode service throws a non-Error', async () => {
    mockService.getAccountTokenBalances.mockImplementation(() => {
      throw 'string error';
    });
    const result = await getAccountTokenBalancesQuery(client, context, { accountId: '0.0.1' });
    expect(result.humanMessage).toBe('Failed to get account token balances');
    expect(result.raw.error).toContain('Failed to get account token balances');
  });
});
