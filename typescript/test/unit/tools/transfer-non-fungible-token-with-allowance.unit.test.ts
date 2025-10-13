import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
  TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
} from '@/plugins/core-token-plugin/tools/non-fungible-token/transfer-non-fungible-token-with-allowance';

vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
  default: {
    normaliseTransferNonFungibleTokenWithAllowance: vi.fn(params => ({
      normalised: true,
      ...params,
    })),
  },
}));
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
  default: { transferNonFungibleTokenWithAllowance: vi.fn(() => ({ tx: 'transferTx' })) },
}));
vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
  handleTransaction: vi.fn(async (_tx, _client, _context, post) => {
    const raw = {
      status: 'SUCCESS',
      transactionId: '0.0.1234@1700000000.000000001',
    };
    return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) };
  }),
}));
vi.mock('@/shared/utils/prompt-generator', () => ({
  PromptGenerator: {
    getContextSnippet: vi.fn(() => 'CTX'),
    getAccountParameterDescription: vi.fn(() => 'sourceAccountId (string): NFT owner'),
    getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
  },
}));

const makeClient = () => Client.forNetwork({});

describe('transfer-nft-with-allowance tool', () => {
  const context: any = { accountId: '0.0.1001' };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exposes correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL);
    expect(tool.name).toBe('Transfer Non Fungible Token with Allowance');
    expect(typeof tool.description).toBe('string');
    expect(tool.parameters).toBeTruthy();
  });

  it('executes successfully and returns formatted message', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const params = {
      sourceAccountId: '0.0.1001',
      tokenId: '0.0.2001',
      recipients: [{ recipientId: '0.0.3001', serialNumber: 1 }],
      transactionMemo: 'NFT allowance test',
    };

    const res: any = await tool.execute(client, context, params);
    expect(res.raw.status).toBe('SUCCESS');
    expect(res.humanMessage).toMatch(
      /Non-fungible tokens successfully transferred with allowance. Transaction ID:/i,
    );
  });

  it('returns aligned error when thrown', async () => {
    const tool = toolFactory(context);
    const client = makeClient();

    const { default: builder } = await import('@/shared/hedera-utils/hedera-builder');
    (builder.transferNonFungibleTokenWithAllowance as any).mockImplementation(() => {
      throw new Error('boom');
    });

    const res = await tool.execute(client, context, {
      sourceAccountId: '0.0.1001',
      tokenId: '0.0.2001',
      recipients: [{ recipientId: '0.0.3001', serialNumber: 1 }],
    });
    expect(res.humanMessage).toContain('Failed to transfer non-fungible token with allowance:');
    expect(res.humanMessage).toContain('boom');
  });
});
