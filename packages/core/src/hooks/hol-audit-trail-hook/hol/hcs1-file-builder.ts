import { createHash } from 'crypto';
import { brotliCompressSync, constants as zlibConstants } from 'zlib';

import { PublicKey } from '@hiero-ledger/sdk';

import HederaBuilder from '@/shared/hedera-utils/hedera-builder';
import { HCS1_CHUNK_SIZE } from '@/hooks/hol-audit-trail-hook/hol/constants';

export type CreateHcs1FileParams = {
  autoRenewAccountId: string;
  submitKey: PublicKey;
  content: string;
  mimeType?: string;
};

export type Hcs1Message = {
  o: number;
  c: string;
};

export type Hcs1FileResult = {
  topicTransaction: any;
  buildMessageTransactions: (topicId: string) => any[];
};

export class Hcs1FileBuilder {
  static createFile(params: CreateHcs1FileParams): Hcs1FileResult {
    const mimeType = params.mimeType ?? 'application/json';
    const contentBuffer = Buffer.from(params.content, 'utf-8');

    const hash = createHash('sha256').update(contentBuffer).digest('hex');

    const compressed = brotliCompressSync(contentBuffer, {
      params: { [zlibConstants.BROTLI_PARAM_QUALITY]: zlibConstants.BROTLI_MAX_QUALITY },
    });
    const base64Data = compressed.toString('base64');

    const dataUri = `data:${mimeType};base64,${base64Data}`;

    const chunks: string[] = [];
    for (let i = 0; i < dataUri.length; i += HCS1_CHUNK_SIZE) {
      chunks.push(dataUri.slice(i, i + HCS1_CHUNK_SIZE));
    }

    const topicMemo = `${hash}:brotli:base64`;

    const topicTransaction = HederaBuilder.createTopic({
      topicMemo,
      autoRenewAccountId: params.autoRenewAccountId,
      isSubmitKey: false,
      submitKey: params.submitKey,
    });

    return {
      topicTransaction,
      buildMessageTransactions: (topicId: string) =>
        chunks.map((chunk, index) => {
          const chunkMessage: Hcs1Message = { o: index, c: chunk };
          return HederaBuilder.submitTopicMessage({
            topicId,
            message: JSON.stringify(chunkMessage),
          });
        }),
    };
  }
}
