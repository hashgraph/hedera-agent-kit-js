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
  TokenAssociateTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountUpdateTransaction,
  ScheduleSignTransaction,
  ScheduleCreateTransaction,
  TokenUpdateTransaction,
  ScheduleDeleteTransaction,
  TokenDissociateTransaction,
  TopicUpdateTransaction,
  AccountId,
  TokenId,
  AccountAllowanceApproveTransaction,
} from '@hashgraph/sdk';
import {
  airdropFungibleTokenParametersNormalised,
  associateTokenParametersNormalised,
  createFungibleTokenParametersNormalised,
  createNonFungibleTokenParametersNormalised,
  deleteTokenParametersNormalised,
  dissociateTokenParametersNormalised,
  mintFungibleTokenParametersNormalised,
  mintNonFungibleTokenParametersNormalised,
  updateTokenParametersNormalised,
  approveNftAllowanceParametersNormalised,
  transferFungibleTokenWithAllowanceParametersNormalised,
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
  approveHbarAllowanceParametersNormalised,
  approveTokenAllowanceParametersNormalised,
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

  static transferFungibleTokenWithAllowance(
    params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParametersNormalised>>,
  ) {
    const tx = new TransferTransaction();

    // Add approved (allowance-based) owner transfer - constructor does not support setting approved transfers
    tx.addApprovedTokenTransfer(
      params.tokenId,
      params.approvedTransfer.ownerAccountId,
      params.approvedTransfer.amount,
    );

    // adding token transfers manually - passing through constructor results in a TRANSFERS_NOT_ZERO_SUM_FOR_TOKEN error
    for (const t of params.tokenTransfers) {
      tx.addTokenTransfer(t.tokenId, t.accountId, t.amount);
    }

    // Add approved (allowance-based) owner transfer - constructor does not support setting approved transfers
    if (params.transactionMemo) {
      tx.setTransactionMemo(params.transactionMemo);
    }

    return tx;
  }

  static updateToken(params: z.infer<ReturnType<typeof updateTokenParametersNormalised>>) {
    return new TokenUpdateTransaction(params);
  }

  static createTopic(params: z.infer<ReturnType<typeof createTopicParametersNormalised>>) {
    const { transactionMemo, ...rest } = params as any;
    const tx = new TopicCreateTransaction(rest);
    if (transactionMemo) tx.setTransactionMemo(transactionMemo);
    return tx;
  }

  static submitTopicMessage(
    params: z.infer<ReturnType<typeof submitTopicMessageParametersNormalised>>,
  ) {
    const { transactionMemo, ...rest } = params as any;
    const tx = new TopicMessageSubmitTransaction(rest);
    if (transactionMemo) tx.setTransactionMemo(transactionMemo);
    return tx;
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

  static associateToken(params: z.infer<ReturnType<typeof associateTokenParametersNormalised>>) {
    return new TokenAssociateTransaction({
      accountId: AccountId.fromString(params.accountId),
      tokenIds: params.tokenIds.map(t => TokenId.fromString(t)),
    });
  }

  private static buildAccountAllowanceApproveTx(
    params: z.infer<
      ReturnType<
        | typeof approveHbarAllowanceParametersNormalised
        | typeof approveNftAllowanceParametersNormalised
      >
    >,
  ) {
    const tx = new AccountAllowanceApproveTransaction(params as any);
    if ((params as any).transactionMemo) {
      tx.setTransactionMemo((params as any).transactionMemo);
    }
    return tx;
  }

  static approveHbarAllowance(
    params: z.infer<ReturnType<typeof approveHbarAllowanceParametersNormalised>>,
  ) {
    return this.buildAccountAllowanceApproveTx(params);
  }

  static approveNftAllowance(
    params: z.infer<ReturnType<typeof approveNftAllowanceParametersNormalised>>,
  ) {
    return this.buildAccountAllowanceApproveTx(params);
  }

  static approveTokenAllowance(
    params: z.infer<ReturnType<typeof approveTokenAllowanceParametersNormalised>>,
  ) {
    const tx = new AccountAllowanceApproveTransaction(params);
    if (params.transactionMemo) {
      tx.setTransactionMemo(params.transactionMemo);
    }
    return tx;
  }
}
