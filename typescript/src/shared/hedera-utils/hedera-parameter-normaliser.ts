// optional to use methods in here

import {
  airdropFungibleTokenParameters,
  createFungibleTokenParameters,
  createFungibleTokenParametersNormalised,
  createNonFungibleTokenParameters,
  createNonFungibleTokenParametersNormalised,
  mintFungibleTokenParameters,
  mintNonFungibleTokenParameters,
} from '@/shared/parameter-schemas/token.zod';
import {
  createAccountParameters,
  createAccountParametersNormalised,
  deleteAccountParameters,
  deleteAccountParametersNormalised,
  transferHbarParameters,
  updateAccountParameters,
  updateAccountParametersNormalised,
  accountBalanceQueryParameters,
  accountTokenBalancesQueryParameters,
  signScheduleTransactionParameters,
  signScheduleTransactionParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';
import {
  createTopicParameters,
  createTopicParametersNormalised,
} from '@/shared/parameter-schemas/consensus.zod';

import { AccountId, Client, Hbar, PublicKey, TokenSupplyType, TokenType } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import z from 'zod';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { toBaseUnit } from '@/shared/hedera-utils/decimals-utils';
import Long from 'long';
import { TokenTransferMinimalParams, TransferHbarInput } from '@/shared/hedera-utils/types';
import { AccountResolver } from '@/shared/utils/account-resolver';
import { ethers } from 'ethers';
import {
  createERC20Parameters,
  createERC721Parameters,
  mintERC721Parameters,
  transferERC20Parameters,
  transferERC721Parameters,
} from '@/shared/parameter-schemas/evm.zod';
import {
  normalisedTransactionRecordQueryParameters,
  transactionRecordQueryParameters,
} from '@/shared/parameter-schemas/transaction.zod';

export default class HederaParameterNormaliser {
  static async normaliseCreateFungibleTokenParams(
    params: z.infer<ReturnType<typeof createFungibleTokenParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ): Promise<z.infer<ReturnType<typeof createFungibleTokenParametersNormalised>>> {
    const defaultAccountId = AccountResolver.getDefaultAccount(context, client);
    const treasuryAccountId = params.treasuryAccountId ?? defaultAccountId;
    if (!treasuryAccountId) throw new Error('Must include treasury account ID');

    const decimals = params.decimals ?? 0;
    const initialSupply = toBaseUnit(params.initialSupply ?? 0, decimals).toNumber();

    const isFinite = (params.supplyType ?? 'infinite') === 'finite';
    const supplyType = isFinite ? TokenSupplyType.Finite : TokenSupplyType.Infinite;

    const maxSupply = isFinite
      ? toBaseUnit(params.maxSupply ?? 1_000_000, decimals).toNumber() // default finite max supply
      : undefined;

    if (maxSupply !== undefined && initialSupply > maxSupply) {
      throw new Error(`Initial supply (${initialSupply}) cannot exceed max supply (${maxSupply})`);
    }

    const publicKey =
      (await mirrorNode.getAccount(defaultAccountId).then(r => r.accountPublicKey)) ??
      client.operatorPublicKey?.toStringDer();

    return {
      ...params,
      supplyType,
      treasuryAccountId,
      maxSupply,
      decimals,
      initialSupply,
      autoRenewAccountId: defaultAccountId,
      supplyKey: params.isSupplyKey === true ? PublicKey.fromString(publicKey) : undefined,
    };
  }

  static async normaliseCreateNonFungibleTokenParams(
    params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const defaultAccountId = AccountResolver.getDefaultAccount(context, client);

    const treasuryAccountId = params.treasuryAccountId || defaultAccountId;
    if (!treasuryAccountId) throw new Error('Must include treasury account ID');

    const publicKey =
      (await mirrorNode.getAccount(defaultAccountId).then(r => r.accountPublicKey)) ??
      client.operatorPublicKey?.toStringDer();

    const maxSupply = params.maxSupply ?? 100;
    const normalized: z.infer<ReturnType<typeof createNonFungibleTokenParametersNormalised>> = {
      ...params,
      treasuryAccountId,
      maxSupply,
      supplyKey: PublicKey.fromString(publicKey), // the supply key is mandatory in the case of NFT
      supplyType: TokenSupplyType.Finite, // NFTs supply must be finite
      autoRenewAccountId: defaultAccountId,
      tokenType: TokenType.NonFungibleUnique,
    };

    return normalized;
  }

  static normaliseTransferHbar(
    params: z.infer<ReturnType<typeof transferHbarParameters>>,
    context: Context,
    client: Client,
  ) {
    const sourceAccountId = AccountResolver.resolveAccount(params.sourceAccountId, context, client);

    const hbarTransfers: TransferHbarInput[] = [];

    let totalTinybars = Long.ZERO;

    for (const transfer of params.transfers) {
      const amount = new Hbar(transfer.amount);

      if (amount.isNegative() || amount.toTinybars().equals(Long.ZERO)) {
        throw new Error(`Invalid transfer amount: ${transfer.amount}`);
      }

      totalTinybars = totalTinybars.add(amount.toTinybars());

      hbarTransfers.push({
        accountId: transfer.accountId,
        amount,
      });
    }

    hbarTransfers.push({
      accountId: sourceAccountId,
      amount: Hbar.fromTinybars(totalTinybars.negate()),
    });

    return {
      hbarTransfers,
      transactionMemo: params.transactionMemo,
    };
  }

  static async normaliseAirdropFungibleTokenParams(
    params: z.infer<ReturnType<typeof airdropFungibleTokenParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const sourceAccountId = AccountResolver.resolveAccount(params.sourceAccountId, context, client);

    const tokenInfo = await mirrorNode.getTokenInfo(params.tokenId);
    const tokenDecimals = parseInt(tokenInfo.decimals, 10);

    const tokenTransfers: TokenTransferMinimalParams[] = [];
    let totalAmount = Long.ZERO;

    for (const recipient of params.recipients) {
      const amountRaw = Number(recipient.amount);

      if (amountRaw <= 0) {
        throw new Error(`Invalid recipient amount: ${recipient.amount}`);
      }

      const amount = Long.fromString(toBaseUnit(amountRaw, tokenDecimals).toNumber().toString());

      totalAmount = totalAmount.add(amount);

      tokenTransfers.push({
        tokenId: params.tokenId,
        accountId: recipient.accountId,
        amount,
      });
    }

    // Sender negative total
    tokenTransfers.push({
      tokenId: params.tokenId,
      accountId: sourceAccountId,
      amount: totalAmount.negate(),
    });

    return {
      tokenTransfers,
    };
  }

  static async normaliseCreateTopicParams(
    params: z.infer<ReturnType<typeof createTopicParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const defaultAccountId = AccountResolver.getDefaultAccount(context, client);
    const normalised: z.infer<ReturnType<typeof createTopicParametersNormalised>> = {
      ...params,
      autoRenewAccountId: defaultAccountId,
    };

    if (params.isSubmitKey) {
      const publicKey =
        (await mirrorNode.getAccount(defaultAccountId).then(r => r.accountPublicKey)) ??
        client.operatorPublicKey?.toStringDer();
      if (!publicKey) {
        throw new Error('Could not determine default account ID for submit key');
      }
      normalised.submitKey = PublicKey.fromString(publicKey);
    }

    return normalised;
  }

  static async normaliseCreateAccount(
    params: z.infer<ReturnType<typeof createAccountParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const initialBalance = params.initialBalance ?? 0;
    const maxAssociations = params.maxAutomaticTokenAssociations ?? -1; // unlimited if -1

    // Try resolving the publicKey in priority order
    let publicKey = params.publicKey ?? client.operatorPublicKey?.toStringDer();

    if (!publicKey) {
      const defaultAccountId = AccountResolver.getDefaultAccount(context, client);
      if (defaultAccountId) {
        const account = await mirrorNode.getAccount(defaultAccountId);
        publicKey = account?.accountPublicKey;
      }
    }

    if (!publicKey) {
      throw new Error(
        'Unable to resolve public key: no param, mirror node, or client operator key available.',
      );
    }

    const normalised: z.infer<ReturnType<typeof createAccountParametersNormalised>> = {
      accountMemo: params.accountMemo,
      initialBalance,
      key: PublicKey.fromString(publicKey),
      maxAutomaticTokenAssociations: maxAssociations,
    };

    return normalised;
  }

  static normaliseHbarBalanceParams(
    params: z.infer<ReturnType<typeof accountBalanceQueryParameters>>,
    context: Context,
    client: Client,
  ) {
    const accountId = AccountResolver.resolveAccount(params.accountId, context, client);
    return {
      ...params,
      accountId,
    };
  }

  static normaliseAccountTokenBalancesParams(
    params: z.infer<ReturnType<typeof accountTokenBalancesQueryParameters>>,
    context: Context,
    client: Client,
  ) {
    const accountId = AccountResolver.resolveAccount(params.accountId, context, client);
    return {
      ...params,
      accountId,
    };
  }

  static normaliseCreateERC20Params(
    params: z.infer<ReturnType<typeof createERC20Parameters>>,
    factoryContractId: string,
    factoryContractAbi: string[],
    factoryContractFunctionName: string,
  ) {
    // Create interface for encoding
    const iface = new ethers.Interface(factoryContractAbi);

    // Encode the function call
    const encodedData = iface.encodeFunctionData(factoryContractFunctionName, [
      params.tokenName,
      params.tokenSymbol,
      params.decimals,
      params.initialSupply,
    ]);

    const functionParameters = ethers.getBytes(encodedData);

    return {
      ...params,
      contractId: factoryContractId,
      functionParameters,
      gas: 3000000, //TODO: make this configurable
    };
  }

  static normaliseCreateERC721Params(
    params: z.infer<ReturnType<typeof createERC721Parameters>>,
    factoryContractId: string,
    factoryContractAbi: string[],
    factoryContractFunctionName: string,
  ) {
    // Create interface for encoding
    const iface = new ethers.Interface(factoryContractAbi);

    // Encode the function call
    const encodedData = iface.encodeFunctionData(factoryContractFunctionName, [
      params.tokenName,
      params.tokenSymbol,
      params.baseURI,
    ]);

    const functionParameters = ethers.getBytes(encodedData);

    return {
      ...params,
      contractId: factoryContractId,
      functionParameters,
      gas: 3000000, //TODO: make this configurable
    };
  }

  static async normaliseMintFungibleTokenParams(
    params: z.infer<ReturnType<typeof mintFungibleTokenParameters>>,
    _context: Context,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const tokenInfo = await mirrorNode.getTokenInfo(params.tokenId);
    const decimals = Number(tokenInfo.decimals);

    // Fallback to 0 if decimals are missing or NaN
    const safeDecimals = Number.isFinite(decimals) ? decimals : 0;

    const baseAmount = toBaseUnit(params.amount, safeDecimals).toNumber();
    return {
      tokenId: params.tokenId,
      amount: baseAmount,
    };
  }

  static normaliseMintNonFungibleTokenParams(
    params: z.infer<ReturnType<typeof mintNonFungibleTokenParameters>>,
    _context: Context,
  ) {
    const encoder = new TextEncoder();
    const metadata = params.uris.map(uri => encoder.encode(uri));
    return {
      ...params,
      metadata: metadata,
    };
  }

  static async normaliseTransferERC20Params(
    params: z.infer<ReturnType<typeof transferERC20Parameters>>,
    factoryContractAbi: string[],
    factoryContractFunctionName: string,
    _context: Context,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const recipientAddress = await AccountResolver.getHederaEVMAddress(
      params.recipientAddress,
      mirrorNode,
    );
    const contractId = await HederaParameterNormaliser.getHederaAccountId(
      params.contractId,
      mirrorNode,
    );
    const iface = new ethers.Interface(factoryContractAbi);
    const encodedData = iface.encodeFunctionData(factoryContractFunctionName, [
      recipientAddress,
      params.amount,
    ]);

    const functionParameters = ethers.getBytes(encodedData);

    return {
      contractId,
      functionParameters,
      gas: 100_000,
    };
  }

  static async normaliseTransferERC721Params(
    params: z.infer<ReturnType<typeof transferERC721Parameters>>,
    factoryContractAbi: string[],
    factoryContractFunctionName: string,
    context: Context,
    mirrorNode: IHederaMirrornodeService,
    client: Client,
  ) {
    // Resolve fromAddress using AccountResolver pattern, similar to transfer-hbar
    const resolvedFromAddress = AccountResolver.resolveAccount(params.fromAddress, context, client);
    const fromAddress = await AccountResolver.getHederaEVMAddress(resolvedFromAddress, mirrorNode);
    const toAddress = await AccountResolver.getHederaEVMAddress(params.toAddress, mirrorNode);
    const contractId = await HederaParameterNormaliser.getHederaAccountId(
      params.contractId,
      mirrorNode,
    );
    const iface = new ethers.Interface(factoryContractAbi);
    const encodedData = iface.encodeFunctionData(factoryContractFunctionName, [
      fromAddress,
      toAddress,
      params.tokenId,
    ]);

    const functionParameters = ethers.getBytes(encodedData);

    return {
      contractId,
      functionParameters,
      gas: 100_000,
    };
  }

  static async normaliseMintERC721Params(
    params: z.infer<ReturnType<typeof mintERC721Parameters>>,
    factoryContractAbi: string[],
    factoryContractFunctionName: string,
    _context: Context,
    mirrorNode: IHederaMirrornodeService,
    client: Client,
  ) {
    const resolvedToAddress = AccountResolver.resolveAccount(params.toAddress, _context, client);
    const toAddress = await AccountResolver.getHederaEVMAddress(resolvedToAddress, mirrorNode);
    const contractId = await HederaParameterNormaliser.getHederaAccountId(
      params.contractId,
      mirrorNode,
    );
    const iface = new ethers.Interface(factoryContractAbi);
    const encodedData = iface.encodeFunctionData(factoryContractFunctionName, [toAddress]);
    const functionParameters = ethers.getBytes(encodedData);

    return {
      contractId,
      functionParameters,
      gas: 100_000,
    };
  }

  static normaliseDeleteAccount(
    params: z.infer<ReturnType<typeof deleteAccountParameters>>,
    context: Context,
    client: Client,
  ): z.infer<ReturnType<typeof deleteAccountParametersNormalised>> {
    if (!AccountResolver.isHederaAddress(params.accountId)) {
      throw new Error('Account ID must be a Hedera address');
    }

    // if no transfer account ID is provided, use the operator account ID
    if (!params.transferAccountId) {
      params.transferAccountId = AccountResolver.getDefaultAccount(context, client);
    }

    return {
      accountId: AccountId.fromString(params.accountId),
      transferAccountId: AccountId.fromString(params.transferAccountId),
    };
  }

  static normaliseUpdateAccount(
    params: z.infer<ReturnType<typeof updateAccountParameters>>,
    context: Context,
    client: Client,
  ) {
    const accountId = AccountId.fromString(
      AccountResolver.resolveAccount(params.accountId, context, client),
    );

    const normalised: z.infer<ReturnType<typeof updateAccountParametersNormalised>> = {
      accountId,
    } as any;

    if (params.maxAutomaticTokenAssociations !== undefined) {
      normalised.maxAutomaticTokenAssociations = params.maxAutomaticTokenAssociations;
    }
    if (params.stakedAccountId !== undefined) {
      normalised.stakedAccountId = params.stakedAccountId;
    }
    if (params.accountMemo !== undefined) {
      normalised.accountMemo = params.accountMemo;
    }
    if (params.declineStakingReward !== undefined) {
      normalised.declineStakingReward = params.declineStakingReward;
    }

    return normalised;
  }

  static normaliseGetTransactionRecordParams(
    params: z.infer<ReturnType<typeof transactionRecordQueryParameters>>,
    _context: Context,
  ) {
    const normalised: z.infer<ReturnType<typeof normalisedTransactionRecordQueryParameters>> = {
      nonce: params.nonce,
    } as any;

    if (!params.transactionId) {
      throw new Error('transactionId is required');
    }

    const mirrorNodeStyleRegex = /^\d+\.\d+\.\d+-\d+-\d+$/;
    const sdkStyleRegex = /^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/;

    if (mirrorNodeStyleRegex.test(params.transactionId)) {
      // Already in mirror-node style, use as-is
      normalised.transactionId = params.transactionId;
    } else {
      const match = params.transactionId.match(sdkStyleRegex);
      if (!match) {
        throw new Error(`Invalid transactionId format: ${params.transactionId}`);
      }

      const [, accountId, seconds, nanos] = match;
      normalised.transactionId = `${accountId}-${seconds}-${nanos}`;
    }

    return normalised;
  }

  static async getHederaAccountId(
    address: string,
    mirrorNode: IHederaMirrornodeService,
  ): Promise<string> {
    if (AccountResolver.isHederaAddress(address)) {
      return address;
    }
    const account = await mirrorNode.getAccount(address);
    return account.accountId;
  }

  static normaliseSignScheduleTransactionParams(
    params: z.infer<ReturnType<typeof signScheduleTransactionParameters>>,
    _context: Context,
  ): z.infer<ReturnType<typeof signScheduleTransactionParametersNormalised>> {
    return {
      scheduleId: params.scheduleId,
    };
  }
}
