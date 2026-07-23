import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AccountId, Client, LedgerId, ReceiptStatusError, Status, TransactionId } from '@hiero-ledger/sdk';
import toolFactory, {
  TRANSFER_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/fungible-token/transfer-fungible-token';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { handleTransaction } from '@/shared/strategies/tx-mode-strategy';
import type { Context } from '@/shared/configuration';

function makeReceiptStatusError(statusValue: Status): ReceiptStatusError {
  const txId = TransactionId.generate(new AccountId(0, 0, 1));
  return new ReceiptStatusError({
    transactionReceipt: {} as any,
    status: statusValue,
    transactionId: txId,
  });
}

vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser');
vi.mock('@/shared/hedera-utils/hedera-builder');
vi.mock('@/shared/strategies/tx-mode-strategy');
vi.mock('@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils', () => ({
  getMirrornodeService: vi.fn(() => ({})),
}));

describe('Transfer Fungible Token Tool (unit)', () => {
  let client: Client;
  let context: Context;

  beforeEach(() => {
    client = Client.forNetwork({});
    Object.defineProperty(client, 'ledgerId', {
      get: () => LedgerId.TESTNET,
    });
    context = { accountId: '0.0.1001' };
    vi.clearAllMocks();
  });

  it('should expose correct metadata', () => {
    const tool = toolFactory(context);
    expect(tool.method).toBe(TRANSFER_FUNGIBLE_TOKEN_TOOL);
    expect(tool.name).toBe('Transfer Fungible Token');
    expect(typeof tool.description).toBe('string');
    expect(tool.description).toContain('transfer HTS fungible tokens');
    expect(tool.parameters).toBeDefined();
    expect(typeof tool.execute).toBe('function');
  });

  it('should execute successfully and return a human-readable message', async () => {
    const params = {
      tokenId: '0.0.9999',
      transfers: [{ accountId: '0.0.2002', amount: 100 }],
      transactionMemo: 'unit test',
    };

    const normalisedParams = { normalised: true, ...params };
    const tx = { mockTx: true };

    (HederaParameterNormaliser.normaliseTransferFungibleToken as any).mockResolvedValue(
      normalisedParams,
    );
    (HederaBuilder.transferFungibleToken as any).mockReturnValue(tx);
    (handleTransaction as any).mockResolvedValue({
      humanMessage:
        'Fungible tokens successfully transferred. Transaction ID: 0.0.1234@1700000000.000000001',
      raw: { transactionId: '0.0.1234@1700000000.000000001', status: Status.Success },
    });

    const tool = toolFactory(context);
    const result = await tool.execute(client, context, params);

    expect(HederaParameterNormaliser.normaliseTransferFungibleToken).toHaveBeenCalledWith(
      params,
      context,
      client,
      expect.anything(),
    );
    expect(HederaBuilder.transferFungibleToken).toHaveBeenCalledWith(normalisedParams);
    expect(handleTransaction).toHaveBeenCalledWith(tx, client, context, expect.any(Function));

    expect(result.humanMessage).toContain('Fungible tokens successfully transferred');
    expect(result.humanMessage).toContain('Transaction ID');
  });

  it('should pass senderAccountId when provided', async () => {
    const params = {
      tokenId: '0.0.9999',
      senderAccountId: '0.0.5555',
      transfers: [{ accountId: '0.0.2002', amount: 50 }],
    };

    const normalisedParams = { normalised: true };
    const tx = { mockTx: true };

    (HederaParameterNormaliser.normaliseTransferFungibleToken as any).mockResolvedValue(
      normalisedParams,
    );
    (HederaBuilder.transferFungibleToken as any).mockReturnValue(tx);
    (handleTransaction as any).mockResolvedValue({
      humanMessage: 'Fungible tokens successfully transferred. Transaction ID: 0.0.1234@1700000000.1',
      raw: { transactionId: '0.0.1234@1700000000.1', status: Status.Success },
    });

    const tool = toolFactory(context);
    await tool.execute(client, context, params);

    expect(HederaParameterNormaliser.normaliseTransferFungibleToken).toHaveBeenCalledWith(
      params,
      context,
      client,
      expect.anything(),
    );
  });

  it('should handle Error exceptions gracefully', async () => {
    const params = {
      tokenId: '0.0.9999',
      transfers: [{ accountId: '0.0.2002', amount: 100 }],
    };

    (HederaParameterNormaliser.normaliseTransferFungibleToken as any).mockImplementation(() => {
      throw new Error('boom');
    });

    const tool = toolFactory(context);
    const result = await tool.execute(client, context, params);

    expect(result.humanMessage).toContain('Failed to execute Transfer Fungible Token');
    expect(result.humanMessage).toContain('boom');
    expect(result.raw.status).toBe('ERROR');
  });

  it('should handle non-Error exceptions gracefully', async () => {
    const params = {
      tokenId: '0.0.9999',
      transfers: [{ accountId: '0.0.2002', amount: 100 }],
    };

    (HederaParameterNormaliser.normaliseTransferFungibleToken as any).mockImplementation(() => {
      throw 'string error';
    });

    const tool = toolFactory(context);
    const result = await tool.execute(client, context, params);

    expect(result.humanMessage).toBe('Failed to execute Transfer Fungible Token');
    expect(result.raw.status).toBe('ERROR');
  });

  it('should append association hint when TOKEN_NOT_ASSOCIATED_TO_ACCOUNT is thrown', async () => {
    const params = {
      tokenId: '0.0.9999',
      transfers: [{ accountId: '0.0.2002', amount: 100 }],
    };

    (HederaParameterNormaliser.normaliseTransferFungibleToken as any).mockImplementation(() => {
      throw makeReceiptStatusError(Status.TokenNotAssociatedToAccount);
    });

    const tool = toolFactory(context);
    const result = await tool.execute(client, context, params);

    expect(result.raw.status).toBe('ERROR');
    expect(result.raw.errorCode).toBe('TOKEN_NOT_ASSOCIATED_TO_ACCOUNT');
    expect(result.humanMessage).toContain('The recipient account has not associated this HTS token');
    expect(result.humanMessage).toContain('associate_token_tool');
    expect(result.humanMessage).toContain('maxAutoAssociations');
  });
});
