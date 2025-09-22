import {
  TokenAirdropTransaction,
  TokenCreateTransaction,
  TokenDeleteTransaction,
  TopicCreateTransaction,
  TopicDeleteTransaction,
  TopicMessageSubmitTransaction,
  TransferTransaction,
  ContractExecuteTransaction,
  TokenMintTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountUpdateTransaction,
  ScheduleSignTransaction,
  ScheduleCreateTransaction,
  ScheduleDeleteTransaction,
  TokenDissociateTransaction,
  TopicUpdateTransaction,
} from '@hashgraph/sdk';
import {
  airdropFungibleTokenParametersNormalised,
  createFungibleTokenParametersNormalised,
  createNonFungibleTokenParametersNormalised,
  deleteTokenParametersNormalised,
  dissociateTokenParametersNormalised,
  mintFungibleTokenParametersNormalised,
  mintNonFungibleTokenParametersNormalised,
} from '@/shared/parameter-schemas/token.zod';
import z from 'zod';
import {
  createAccountParametersNormalised,
  deleteAccountParametersNormalised,
  transferHbarParametersNormalised,
  updateAccountParametersNormalised,
  createScheduleTransactionParametersNormalised,
  signScheduleTransactionParameters,
  scheduleDeleteTransactionParameters,
} from '@/shared/parameter-schemas/account.zod';
import {
  createTopicParametersNormalised,
  deleteTopicParametersNormalised,
  submitTopicMessageParametersNormalised,
  updateTopicParametersNormalised,
} from '@/shared/parameter-schemas/consensus.zod';
import { contractExecuteTransactionParametersNormalised } from '@/shared/parameter-schemas/evm.zod';

export default class HederaBuilder {
  static createScheduleTransaction(
    params: z.infer<ReturnType<typeof createScheduleTransactionParametersNormalised>>,
  ) {
    return new ScheduleCreateTransaction(params.params).setScheduledTransaction(
      params.scheduledTransaction,
    );
  }

  static createFungibleToken(
    params: z.infer<ReturnType<typeof createFungibleTokenParametersNormalised>>,
  ) {
    return new TokenCreateTransaction(params);
  }

  static createNonFungibleToken(
    params: z.infer<ReturnType<typeof createNonFungibleTokenParametersNormalised>>,
  ) {
    return new TokenCreateTransaction(params);
  }

  static transferHbar(params: z.infer<ReturnType<typeof transferHbarParametersNormalised>>) {
    return new TransferTransaction(params);
  }

  static airdropFungibleToken(
    params: z.infer<ReturnType<typeof airdropFungibleTokenParametersNormalised>>,
  ) {
    return new TokenAirdropTransaction(params as any);
  }

  static createTopic(params: z.infer<ReturnType<typeof createTopicParametersNormalised>>) {
    return new TopicCreateTransaction(params);
  }

  static submitTopicMessage(
    params: z.infer<ReturnType<typeof submitTopicMessageParametersNormalised>>,
  ) {
    return new TopicMessageSubmitTransaction(params);
  }

  static updateTopic(params: z.infer<ReturnType<typeof updateTopicParametersNormalised>>) {
    return new TopicUpdateTransaction(params);
  }

  static executeTransaction(
    params: z.infer<ReturnType<typeof contractExecuteTransactionParametersNormalised>>,
  ) {
    return new ContractExecuteTransaction(params);
  }

  static mintFungibleToken(
    params: z.infer<ReturnType<typeof mintFungibleTokenParametersNormalised>>,
  ) {
    return new TokenMintTransaction(params);
  }

  static mintNonFungibleToken(
    params: z.infer<ReturnType<typeof mintNonFungibleTokenParametersNormalised>>,
  ) {
    return new TokenMintTransaction(params);
  }

  static dissociateToken(params: z.infer<ReturnType<typeof dissociateTokenParametersNormalised>>) {
    return new TokenDissociateTransaction(params);
  }

  static createAccount(params: z.infer<ReturnType<typeof createAccountParametersNormalised>>) {
    return new AccountCreateTransaction(params);
  }

  static deleteAccount(params: z.infer<ReturnType<typeof deleteAccountParametersNormalised>>) {
    return new AccountDeleteTransaction(params);
  }

  static updateAccount(params: z.infer<ReturnType<typeof updateAccountParametersNormalised>>) {
    return new AccountUpdateTransaction(params);
  }

  static deleteToken(params: z.infer<ReturnType<typeof deleteTokenParametersNormalised>>) {
    return new TokenDeleteTransaction(params);
  }

  static deleteTopic(params: z.infer<ReturnType<typeof deleteTopicParametersNormalised>>) {
    return new TopicDeleteTransaction(params);
  }

  static signScheduleTransaction(
    params: z.infer<ReturnType<typeof signScheduleTransactionParameters>>,
  ) {
    return new ScheduleSignTransaction(params);
  }

  static deleteScheduleTransaction(
    params: z.infer<ReturnType<typeof scheduleDeleteTransactionParameters>>,
  ) {
    return new ScheduleDeleteTransaction(params as any);
  }
}
