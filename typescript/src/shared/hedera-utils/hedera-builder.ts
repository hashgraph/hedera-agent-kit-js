import {
  TokenAirdropTransaction,
  TokenCreateTransaction,
  TopicCreateTransaction,
  TopicMessageSubmitTransaction,
  TransferTransaction,
  ContractExecuteTransaction,
  TokenMintTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountUpdateTransaction,
} from '@hashgraph/sdk';
import {
  airdropFungibleTokenParametersNormalised,
  createFungibleTokenParametersNormalised,
  createNonFungibleTokenParametersNormalised,
  mintFungibleTokenParametersNormalised,
  mintNonFungibleTokenParametersNormalised,
} from '@/shared/parameter-schemas/token.zod';
import z from 'zod';
import {
  createAccountParametersNormalised,
  deleteAccountParametersNormalised,
  transferHbarParametersNormalised,
  updateAccountParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';
import {
  createTopicParametersNormalised,
  submitTopicMessageParametersNormalised,
} from '@/shared/parameter-schemas/consensus.zod';
import { contractExecuteTransactionParametersNormalised } from '@/shared/parameter-schemas/evm.zod';

export default class HederaBuilder {
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

  static createAccount(params: z.infer<ReturnType<typeof createAccountParametersNormalised>>) {
    return new AccountCreateTransaction(params);
  }

  static deleteAccount(params: z.infer<ReturnType<typeof deleteAccountParametersNormalised>>) {
    return new AccountDeleteTransaction(params);
  }

  static updateAccount(params: z.infer<ReturnType<typeof updateAccountParametersNormalised>>) {
    return new AccountUpdateTransaction(params);
  }
}
