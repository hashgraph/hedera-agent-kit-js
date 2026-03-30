import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { HCS2_PROTOCOL, HCS2_OPERATION } from '@/hooks/hol-audit-trail-hook/hol/constants';

type Hcs2Operation = (typeof HCS2_OPERATION)[keyof typeof HCS2_OPERATION];

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
