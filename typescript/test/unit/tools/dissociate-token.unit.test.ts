import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Client, AccountId, TokenId, Status } from '@hashgraph/sdk';
import tool from '@/plugins/core-token-plugin/tools/dissociate-token';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';
import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { handleTransaction } from '@/shared/strategies/tx-mode-strategy';

vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser');
vi.mock('@/shared/hedera-utils/hedera-builder');
vi.mock('@/shared/strategies/tx-mode-strategy');

describe('Dissociate Token Tool', () => {
  let client: Client;
  let context: any;

  beforeEach(() => {
    client = {} as Client;
    context = { accountId: '0.0.1234' };
    vi.clearAllMocks();
  });

  it('should execute dissociation successfully', async () => {
    const params = { tokenIds: ['0.0.1001'] };

    const normalised = {
      accountId: AccountId.fromString('0.0.1234'),
      tokenIds: [TokenId.fromString('0.0.1001')],
      transactionMemo: undefined,
    };

    (HederaParameterNormaliser.normaliseDissociateTokenParams as any).mockResolvedValue(normalised);
    const txMock = { execute: vi.fn() };
    (HederaBuilder.dissociateToken as any).mockReturnValue(txMock);
    (handleTransaction as any).mockResolvedValue({ transactionId: '0.0.1234-0' });

    const toolInstance = tool(context);
    const result = await toolInstance.execute(client, context, params);

    expect(HederaParameterNormaliser.normaliseDissociateTokenParams).toHaveBeenCalledWith(
      params,
      context,
      client,
    );
    expect(HederaBuilder.dissociateToken).toHaveBeenCalledWith(normalised);
    expect(handleTransaction).toHaveBeenCalledWith(txMock, client, context, expect.any(Function));
    expect(result).toEqual({ transactionId: '0.0.1234-0' });
  });

  it('should use default account if accountId not provided', async () => {
    const params = { tokenIds: ['0.0.1002'] };

    const normalised = {
      accountId: AccountId.fromString('0.0.1234'),
      tokenIds: [TokenId.fromString('0.0.1002')],
      transactionMemo: undefined,
    };

    (HederaParameterNormaliser.normaliseDissociateTokenParams as any).mockResolvedValue(normalised);
    const txMock = { execute: vi.fn() };
    (HederaBuilder.dissociateToken as any).mockReturnValue(txMock);
    (handleTransaction as any).mockResolvedValue({ transactionId: '0.0.1234-1' });

    const toolInstance = tool(context);
    const result = await toolInstance.execute(client, context, params);

    expect(normalised.accountId.toString()).toBe('0.0.1234');
    expect(result.transactionId).toBe('0.0.1234-1');
  });

  it('should return error object if dissociation fails', async () => {
    const params = { tokenIds: ['0.0.9999'] };
    (HederaParameterNormaliser.normaliseDissociateTokenParams as any).mockRejectedValue(
      new Error('Test error'),
    );

    const toolInstance = tool(context);
    const result = await toolInstance.execute(client, context, params);

    expect(result.humanMessage).toContain('Failed to dissociate token');
    expect(result.raw.status).toBe(Status.InvalidTransaction);
    expect(result.raw.error).toContain('Test error');
  });

  it('should validate required tokenIds', async () => {
    const toolInstance = tool(context);
    const params: any = { tokenIds: [] }; // invalid

    await expect(toolInstance.execute(client, context, params)).resolves.toMatchObject({
      raw: { status: Status.InvalidTransaction },
      humanMessage: expect.stringContaining('Failed to dissociate token'),
    });
  });

  it('should handle multiple tokenIds', async () => {
    const params = { tokenIds: ['0.0.1001', '0.0.1002'] };
    const normalised = {
      accountId: AccountId.fromString('0.0.1234'),
      tokenIds: [TokenId.fromString('0.0.1001'), TokenId.fromString('0.0.1002')],
      transactionMemo: undefined,
    };

    (HederaParameterNormaliser.normaliseDissociateTokenParams as any).mockResolvedValue(normalised);
    const txMock = { execute: vi.fn() };
    (HederaBuilder.dissociateToken as any).mockReturnValue(txMock);
    (handleTransaction as any).mockResolvedValue({ transactionId: '0.0.1234-2' });

    const toolInstance = tool(context);
    const result = await toolInstance.execute(client, context, params);

    expect(result.transactionId).toBe('0.0.1234-2');
    expect(HederaBuilder.dissociateToken).toHaveBeenCalledWith(normalised);
  });
});
