import { PublicKey } from '@hashgraph/sdk';

import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { HCS2_PROTOCOL, HCS2_OPERATION, HCS2_REGISTRY_TYPE } from '@/shared/hooks/hol-audit-trail-hook/hol/constants';

type Hcs2Operation = (typeof HCS2_OPERATION)[keyof typeof HCS2_OPERATION];

export type CreateHcs2RegistryParams = {
  autoRenewAccountId: string;
  submitKey: PublicKey;
  registryType?: 0 | 1;
  ttl?: number;
};

export type RegisterHcs2EntryParams = {
  registryTopicId: string;
  targetTopicId: string;
  metadata?: string;
  memo?: string;
};

export type Hcs2Message = {
  p: typeof HCS2_PROTOCOL;
  op: Hcs2Operation;
  t_id: string;
  uid?: number;
  metadata?: string;
  m?: string;
};

export class Hcs2RegistryBuilder {
  static createRegistry(params: CreateHcs2RegistryParams) {
    const registryType = params.registryType ?? HCS2_REGISTRY_TYPE.INDEXED;
    const ttl = params.ttl ?? 0;

    return HederaBuilder.createTopic({
      topicMemo: `${HCS2_PROTOCOL}:${registryType}:${ttl}`,
      autoRenewAccountId: params.autoRenewAccountId,
      isSubmitKey: false,
      submitKey: params.submitKey,
    });
  }

  static registerEntry(params: RegisterHcs2EntryParams) {
    const message: Hcs2Message = {
      p: HCS2_PROTOCOL,
      op: HCS2_OPERATION.REGISTER,
      t_id: params.targetTopicId,
      metadata: params.metadata,
      m: params.memo,
    };

    return HederaBuilder.submitTopicMessage({
      topicId: params.registryTopicId,
      message: JSON.stringify(message),
    });
  }
}
