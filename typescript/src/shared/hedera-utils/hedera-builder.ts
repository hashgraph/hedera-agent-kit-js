import {
  AccountAllowanceApproveTransaction,
  AccountCreateTransaction,
  AccountDeleteTransaction,
  AccountId,
  AccountUpdateTransaction,
  ContractExecuteTransaction,
  ScheduleCreateTransaction,
  ScheduleDeleteTransaction,
  ScheduleSignTransaction,
  TokenAirdropTransaction,
  TokenAssociateTransaction,
  TokenCreateTransaction,
  TokenDeleteTransaction,
  TokenDissociateTransaction,
  TokenId,
  TokenMintTransaction,
  TokenUpdateTransaction,
  TopicCreateTransaction,
  TopicDeleteTransaction,
  TopicMessageSubmitTransaction,
  TopicUpdateTransaction,
  Transaction,
  TransferTransaction,
} from '@hashgraph/sdk';
import {
  airdropFungibleTokenParametersNormalised,
  approveNftAllowanceParametersNormalised,
  associateTokenParametersNormalised,
  createFungibleTokenParametersNormalised,
  createNonFungibleTokenParametersNormalised,
  deleteTokenParametersNormalised,
  dissociateTokenParametersNormalised,
  mintFungibleTokenParametersNormalised,
  mintNonFungibleTokenParametersNormalised,
  updateTokenParametersNormalised,
  transferFungibleTokenWithAllowanceParametersNormalised,
  transferNonFungibleTokenWithAllowanceParametersNormalised,
} from '@/shared/parameter-schemas/token.zod';
import z from 'zod';
import {
  approveHbarAllowanceParametersNormalised,
  approveTokenAllowanceParametersNormalised,
  createAccountParametersNormalised,
  deleteAccountParametersNormalised,
  scheduleDeleteTransactionParameters,
  signScheduleTransactionParameters,
  transferHbarParametersNormalised,
  transferHbarWithAllowanceParametersNormalised,
  updateAccountParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';
import {
  createTopicParametersNormalised,
  deleteTopicParametersNormalised,
  submitTopicMessageParametersNormalised,
  updateTopicParametersNormalised,
} from '@/shared/parameter-schemas/consensus.zod';
import { contractExecuteTransactionParametersNormalised } from '@/shared/parameter-schemas/evm.zod';
import { optionalScheduledTransactionParamsNormalised } from '@/shared/parameter-schemas/common.zod';

export default class HederaBuilder {
  static createFungibleToken(
    params: z.infer<ReturnType<typeof createFungibleTokenParametersNormalised>>,
  ) {
    const tx = new TokenCreateTransaction(params);
    return HederaBuilder.maybeWrapInSchedule(tx, params.schedulingParams);
  }

  static createNonFungibleToken(
    params: z.infer<ReturnType<typeof createNonFungibleTokenParametersNormalised>>,
  ) {
    const tx = new TokenCreateTransaction(params);
    return HederaBuilder.maybeWrapInSchedule(tx, params.schedulingParams);
  }

  static transferHbar(params: z.infer<ReturnType<typeof transferHbarParametersNormalised>>) {
    const tx = new TransferTransaction(params);
    return HederaBuilder.maybeWrapInSchedule(tx, params.schedulingParams);
  }

  static transferNonFungibleTokenWithAllowance(
    params: z.infer<ReturnType<typeof transferNonFungibleTokenWithAllowanceParametersNormalised>>,
  ) {
    const tx = new TransferTransaction();

    for (const transfer of params.transfers) {
      tx.addApprovedNftTransfer(transfer.nftId, params.sourceAccountId, transfer.receiver);
    }

    if (params.transactionMemo) {
      tx.setTransactionMemo(params.transactionMemo);
    }

    return tx;
  }

  static transferHbarWithAllowance(
    params: z.infer<ReturnType<typeof transferHbarWithAllowanceParametersNormalised>>,
  ) {
    // transfers are passed through the constructor
    const tx = new TransferTransaction(params);

    // Add approved transfer (allowance-based) - approved transfer passing through a constructor is not supported
    tx.addApprovedHbarTransfer(
      params.hbarApprovedTransfer.ownerAccountId,
      params.hbarApprovedTransfer.amount,
    );

    if (params.transactionMemo) {
      tx.setTransactionMemo(params.transactionMemo);
    }

    return tx;
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

    return HederaBuilder.maybeWrapInSchedule(tx, params.schedulingParams);
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
    return HederaBuilder.maybeWrapInSchedule(tx, params.schedulingParams);
  }

  static updateTopic(params: z.infer<ReturnType<typeof updateTopicParametersNormalised>>) {
    return new TopicUpdateTransaction(params);
  }

  static executeTransaction(
    params: z.infer<ReturnType<typeof contractExecuteTransactionParametersNormalised>>,
  ) {
    const tx = new ContractExecuteTransaction(params);
    return HederaBuilder.maybeWrapInSchedule(tx, params.schedulingParams);
  }

  static mintFungibleToken(
    params: z.infer<ReturnType<typeof mintFungibleTokenParametersNormalised>>,
  ) {
    const tx = new TokenMintTransaction(params);
    return HederaBuilder.maybeWrapInSchedule(tx, params.schedulingParams);
  }

  static mintNonFungibleToken(
    params: z.infer<ReturnType<typeof mintNonFungibleTokenParametersNormalised>>,
  ) {
    const tx = new TokenMintTransaction(params);
    return HederaBuilder.maybeWrapInSchedule(tx, params.schedulingParams);
  }

  static dissociateToken(params: z.infer<ReturnType<typeof dissociateTokenParametersNormalised>>) {
    return new TokenDissociateTransaction(params);
  }

  static createAccount(params: z.infer<ReturnType<typeof createAccountParametersNormalised>>) {
    const tx = new AccountCreateTransaction(params);
    return HederaBuilder.maybeWrapInSchedule(tx, params.schedulingParams);
  }

  static deleteAccount(params: z.infer<ReturnType<typeof deleteAccountParametersNormalised>>) {
    return new AccountDeleteTransaction(params);
  }

  static updateAccount(params: z.infer<ReturnType<typeof updateAccountParametersNormalised>>) {
    const tx = new AccountUpdateTransaction(params);
    return HederaBuilder.maybeWrapInSchedule(tx, params.schedulingParams);
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

  static maybeWrapInSchedule(
    tx: Transaction,
    schedulingParams?: z.infer<
      ReturnType<typeof optionalScheduledTransactionParamsNormalised>
    >['schedulingParams'],
  ): Transaction {
    if (schedulingParams?.isScheduled) {
      return new ScheduleCreateTransaction(schedulingParams)
        .setScheduledTransaction(tx)
        .setWaitForExpiry(schedulingParams.waitForExpiry || false) // passing through constructor is failing
        .setExpirationTime(schedulingParams.expirationTime || null); // passing through constructor is failing
    }
    return tx;
  }
}
