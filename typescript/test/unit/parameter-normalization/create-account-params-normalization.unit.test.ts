import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrivateKey, PublicKey } from '@hashgraph/sdk';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

vi.mock('@/shared/utils/account-resolver', () => ({
  AccountResolver: {
    getDefaultAccount: vi.fn(),
    getDefaultPublicKey: vi.fn(),
  },
}));

import { AccountResolver } from '@/shared/utils/account-resolver';

describe('HederaParameterNormaliser.normaliseCreateAccount', () => {
  const generatedOperatorPrivateKey = PrivateKey.generateED25519();
  const generatedSecondaryPrivateKey = PrivateKey.generateED25519();

  const context: any = {
    accountId: '0.0.1001',
    accountPublicKey: generatedOperatorPrivateKey.publicKey.toStringDer(),
  };

  const client = {
    operatorPublicKey: {
      toStringDer: () => generatedOperatorPrivateKey.publicKey.toStringDer(),
    },
  } as any;

  const mirrorNode = {
    getAccount: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses params.publicKey if provided', async () => {
    const params = {
      publicKey: generatedSecondaryPrivateKey.publicKey.toStringDer(),
      initialBalance: 5,
      maxAutomaticTokenAssociations: 10,
    };

    const result = await HederaParameterNormaliser.normaliseCreateAccount(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.initialBalance).toBe(5);
    expect(result.maxAutomaticTokenAssociations).toBe(10);
    expect(result.key).toBeInstanceOf(PublicKey);
    expect(result.key!.toString()).toBe(params.publicKey);
    expect(result?.schedulingParams?.isScheduled).toBe(false);
  });

  it('uses client.operatorPublicKey if no param.publicKey', async () => {
    const params = {
      initialBalance: 1,
      maxAutomaticTokenAssociations: 2,
    };

    const result = await HederaParameterNormaliser.normaliseCreateAccount(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.key).toBeDefined();
    expect(result.key!.toString()).toBe(client.operatorPublicKey.toStringDer());
    expect(result?.schedulingParams?.isScheduled).toBe(false);
  });

  it('falls back to mirrorNode.getAccount when no param and no operator key', async () => {
    const clientNoOpKey = {} as any;

    (AccountResolver.getDefaultAccount as any).mockReturnValue('0.0.2002');
    mirrorNode.getAccount.mockResolvedValueOnce({
      accountPublicKey: generatedSecondaryPrivateKey.publicKey.toStringDer(),
    });

    const params = {
      accountMemo: 'test account',
      maxAutomaticTokenAssociations: 10,
      initialBalance: 0,
    };

    const result = await HederaParameterNormaliser.normaliseCreateAccount(
      params,
      context,
      clientNoOpKey,
      mirrorNode as any,
    );

    expect(result.key).toBeDefined();
    expect(result.key!.toString()).toBe(generatedSecondaryPrivateKey.publicKey.toStringDer());
    expect(result.maxAutomaticTokenAssociations).toBe(10);
    expect(result.initialBalance).toBe(0);
    expect(mirrorNode.getAccount).toHaveBeenCalledWith('0.0.2002');
  });

  it('throws error when no public key is available anywhere', async () => {
    const clientNoOpKey = {} as any;

    (AccountResolver.getDefaultAccount as any).mockReturnValue(null);
    mirrorNode.getAccount.mockResolvedValueOnce(null);

    const params = {
      initialBalance: 0,
      maxAutomaticTokenAssociations: -1,
    };

    await expect(
      HederaParameterNormaliser.normaliseCreateAccount(
        params,
        context,
        clientNoOpKey,
        mirrorNode as any,
      ),
    ).rejects.toThrow('Unable to resolve public key');
  });

  it('applies defaults when values are not provided', async () => {
    const params = { schedulingParams: { isScheduled: false } } as any;

    const result = await HederaParameterNormaliser.normaliseCreateAccount(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(result.initialBalance).toBe(0);
    expect(result.maxAutomaticTokenAssociations).toBe(-1);
    expect(result.key).toBeDefined();
    expect(result.key!.toString()).toBe(client.operatorPublicKey.toStringDer());
    expect(result?.schedulingParams?.isScheduled).toBe(false);
  });

  it('calls normaliseScheduledTransactionParams when schedulingParams.isScheduled = true', async () => {
    const mockScheduleParams = {
      schedulingParams: {
        isScheduled: true,
        scheduleMemo: 'schedule test',
      },
    };
    const spy = vi
      .spyOn(HederaParameterNormaliser, 'normaliseScheduledTransactionParams')
      .mockResolvedValueOnce(mockScheduleParams as any);

    const params = {
      publicKey: generatedSecondaryPrivateKey.publicKey.toStringDer(),
      schedulingParams: { isScheduled: true, adminKey: false, waitForExpiry: false },
    } as any;

    const result = await HederaParameterNormaliser.normaliseCreateAccount(
      params,
      context,
      client,
      mirrorNode as any,
    );

    expect(spy).toHaveBeenCalled();
    expect(result.schedulingParams).toEqual(mockScheduleParams.schedulingParams);
    expect(result.key!.toString()).toBe(params.publicKey);
  });
});
