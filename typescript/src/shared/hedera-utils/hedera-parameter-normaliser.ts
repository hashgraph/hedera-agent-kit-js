// optional to use methods in here

import {
  airdropFungibleTokenParameters,
  createFungibleTokenParameters,
  createFungibleTokenParametersNormalised,
  createNonFungibleTokenParameters,
  createNonFungibleTokenParametersNormalised,
  dissociateTokenParameters,
  dissociateTokenParametersNormalised,
  associateTokenParameters,
  associateTokenParametersNormalised,
  mintFungibleTokenParameters,
  mintNonFungibleTokenParameters,
  updateTokenParameters,
  updateTokenParametersNormalised,
  approveNftAllowanceParameters,
  approveNftAllowanceParametersNormalised,
} from '@/shared/parameter-schemas/token.zod';
import {
  accountBalanceQueryParameters,
  accountTokenBalancesQueryParameters,
  createAccountParameters,
  createAccountParametersNormalised,
  deleteAccountParameters,
  deleteAccountParametersNormalised,
  transferHbarParameters,
  updateAccountParameters,
  updateAccountParametersNormalised,
  approveHbarAllowanceParameters,
  approveHbarAllowanceParametersNormalised,
} from '@/shared/parameter-schemas/account.zod';
import {
  createTopicParameters,
  createTopicParametersNormalised,
  deleteTopicParameters,
  deleteTopicParametersNormalised,
  updateTopicParameters,
  updateTopicParametersNormalised,
} from '@/shared/parameter-schemas/consensus.zod';

import {
  AccountId,
  Client,
  Hbar,
  PublicKey,
  TokenId,
  TokenSupplyType,
  TokenType,
  TopicId,
  HbarAllowance,
  TokenNftAllowance,
  Long,
} from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import z from 'zod';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { toBaseUnit } from '@/shared/hedera-utils/decimals-utils';
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
  static parseParamsWithSchema(
    params: any,
    schema: any,
    context: Context = {},
  ): z.infer<ReturnType<typeof schema>> {
    let parsedParams: z.infer<ReturnType<typeof schema>>;
    try {
      parsedParams = schema(context).parse(params);
    } catch (e) {
      if (e instanceof z.ZodError) {
        const issues = this.formatZodIssues(e);
        throw new Error(`Invalid parameters: ${issues}`);
      }
      throw e;
    }
    return parsedParams;
  }

  private static formatZodIssues(error: z.ZodError): string {
    return error.errors.map(err => `Field "${err.path.join('.')}" - ${err.message}`).join('; ');
  }

  static async normaliseCreateFungibleTokenParams(
    params: z.infer<ReturnType<typeof createFungibleTokenParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ): Promise<z.infer<ReturnType<typeof createFungibleTokenParametersNormalised>>> {
    const parsedParams: z.infer<ReturnType<typeof createFungibleTokenParameters>> =
      this.parseParamsWithSchema(params, createFungibleTokenParameters, context);

    const defaultAccountId = AccountResolver.getDefaultAccount(context, client);
    const treasuryAccountId = parsedParams.treasuryAccountId ?? defaultAccountId;
    if (!treasuryAccountId) throw new Error('Must include treasury account ID');

    const initialSupply = toBaseUnit(
      parsedParams.initialSupply ?? 0,
      parsedParams.decimals,
    ).toNumber();

    const isFinite = (parsedParams.supplyType ?? 'infinite') === 'finite';
    const supplyType = isFinite ? TokenSupplyType.Finite : TokenSupplyType.Infinite;

    const maxSupply = isFinite
      ? toBaseUnit(parsedParams.maxSupply ?? 1_000_000, parsedParams.decimals).toNumber() // default finite max supply
      : undefined;

    if (maxSupply !== undefined && initialSupply > maxSupply) {
      throw new Error(`Initial supply (${initialSupply}) cannot exceed max supply (${maxSupply})`);
    }

    const publicKey =
      (await mirrorNode.getAccount(defaultAccountId).then(r => r.accountPublicKey)) ??
      client.operatorPublicKey?.toStringDer();

    return {
      ...parsedParams,
      supplyType,
      treasuryAccountId,
      maxSupply,
      initialSupply,
      autoRenewAccountId: defaultAccountId,
      supplyKey: parsedParams.isSupplyKey === true ? PublicKey.fromString(publicKey) : undefined,
    };
  }

  static async normaliseCreateNonFungibleTokenParams(
    params: z.infer<ReturnType<typeof createNonFungibleTokenParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ): Promise<z.infer<ReturnType<typeof createNonFungibleTokenParametersNormalised>>> {
    const parsedParams: z.infer<ReturnType<typeof createNonFungibleTokenParameters>> =
      this.parseParamsWithSchema(params, createNonFungibleTokenParameters, context);

    const defaultAccountId = AccountResolver.getDefaultAccount(context, client);
    const treasuryAccountId = parsedParams.treasuryAccountId ?? defaultAccountId;
    if (!treasuryAccountId) throw new Error('Must include treasury account ID');

    const publicKey =
      (await mirrorNode.getAccount(defaultAccountId).then(r => r.accountPublicKey)) ??
      client.operatorPublicKey?.toStringDer();

    if (!publicKey) throw new Error('Could not determine public key for supply key');

    const maxSupply = parsedParams.maxSupply ?? 100;

    return {
      ...parsedParams,
      treasuryAccountId,
      maxSupply,
      supplyKey: PublicKey.fromString(publicKey), // the supply key is mandatory in the case of NFT
      supplyType: TokenSupplyType.Finite, // NFTs supply must be finite
      autoRenewAccountId: defaultAccountId,
      tokenType: TokenType.NonFungibleUnique,
    };
  }

  static normaliseTransferHbar(
    params: z.infer<ReturnType<typeof transferHbarParameters>>,
    context: Context,
    client: Client,
  ) {
    const parsedParams: z.infer<ReturnType<typeof transferHbarParameters>> =
      this.parseParamsWithSchema(params, transferHbarParameters, context);

    const sourceAccountId = AccountResolver.resolveAccount(
      parsedParams.sourceAccountId,
      context,
      client,
    );

    const hbarTransfers: TransferHbarInput[] = [];
    let totalTinybars = Long.ZERO;

    for (const transfer of parsedParams.transfers) {
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
      transactionMemo: parsedParams.transactionMemo,
    };
  }

  static normaliseApproveHbarAllowance(
    params: z.infer<ReturnType<typeof approveHbarAllowanceParameters>>,
    context: Context,
    client: Client,
  ) {
    const parsedParams: z.infer<ReturnType<typeof approveHbarAllowanceParameters>> =
      this.parseParamsWithSchema(params, approveHbarAllowanceParameters, context);

    const ownerAccountId = AccountResolver.resolveAccount(
      parsedParams.ownerAccountId,
      context,
      client,
    );

    const spenderAccountId = parsedParams.spenderAccountId;

    const amount = new Hbar(parsedParams.amount);
    if (amount.isNegative()) {
      throw new Error(`Invalid allowance amount: ${parsedParams.amount}`);
    }

    return {
      hbarApprovals: [
        new HbarAllowance({
          ownerAccountId: AccountId.fromString(ownerAccountId),
          spenderAccountId: AccountId.fromString(spenderAccountId),
          amount,
        }),
      ],
      transactionMemo: parsedParams.transactionMemo,
    } as z.infer<ReturnType<typeof approveHbarAllowanceParametersNormalised>>;
  }

  static normaliseApproveNftAllowance(
    params: z.infer<ReturnType<typeof approveNftAllowanceParameters>>,
    context: Context,
    client: Client,
  ) {
    const parsedParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> =
      this.parseParamsWithSchema(params, approveNftAllowanceParameters, context);

    const ownerAccountId = AccountResolver.resolveAccount(
      parsedParams.ownerAccountId,
      context,
      client,
    );

    const spenderAccountId = parsedParams.spenderAccountId;

    const serials = parsedParams.serialNumbers || [];
    if (!serials.length) {
      throw new Error('serialNumbers must contain at least one serial');
    }

    const tokenId = TokenId.fromString(parsedParams.tokenId);

    return {
      nftApprovals: [
        new TokenNftAllowance({
          allSerials: null,
          delegatingSpender: null,
          ownerAccountId: AccountId.fromString(ownerAccountId),
          spenderAccountId: AccountId.fromString(spenderAccountId),
          tokenId,
          serialNumbers: serials?.map(serialNumber => Long.fromNumber(serialNumber)),
        }),
      ],
      transactionMemo: parsedParams.transactionMemo,
    } as z.infer<ReturnType<typeof approveNftAllowanceParametersNormalised>>;
  }

  static async normaliseAirdropFungibleTokenParams(
    params: z.infer<ReturnType<typeof airdropFungibleTokenParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const parsedParams: z.infer<ReturnType<typeof airdropFungibleTokenParameters>> =
      this.parseParamsWithSchema(params, airdropFungibleTokenParameters, context);

    const sourceAccountId = AccountResolver.resolveAccount(
      parsedParams.sourceAccountId,
      context,
      client,
    );

    const tokenInfo = await mirrorNode.getTokenInfo(parsedParams.tokenId);
    const tokenDecimals = parseInt(tokenInfo.decimals, 10);

    if (isNaN(tokenDecimals)) {
      throw new Error(`Invalid token decimals for token ${parsedParams.tokenId}`);
    }

    const tokenTransfers: TokenTransferMinimalParams[] = [];
    let totalAmount = Long.ZERO;

    for (const recipient of parsedParams.recipients) {
      const amountRaw = Number(recipient.amount);

      if (amountRaw <= 0) {
        throw new Error(`Invalid recipient amount: ${recipient.amount}`);
      }

      const amount = Long.fromString(toBaseUnit(amountRaw, tokenDecimals).toNumber().toString());

      totalAmount = totalAmount.add(amount);

      tokenTransfers.push({
        tokenId: parsedParams.tokenId,
        accountId: recipient.accountId,
        amount,
      });
    }

    // Sender negative total
    tokenTransfers.push({
      tokenId: parsedParams.tokenId,
      accountId: sourceAccountId,
      amount: totalAmount.negate(),
    });

    return {
      tokenTransfers,
    };
  }

  static normaliseAssociateTokenParams(
    params: z.infer<ReturnType<typeof associateTokenParameters>>,
    context: Context,
    client: Client,
  ): z.infer<ReturnType<typeof associateTokenParametersNormalised>> {
    const parsedParams: z.infer<ReturnType<typeof associateTokenParameters>> =
      this.parseParamsWithSchema(params, associateTokenParameters, context);

    const accountId = AccountResolver.resolveAccount(parsedParams.accountId, context, client);
    return {
      accountId,
      tokenIds: parsedParams.tokenIds,
    };
  }

  static async normaliseDissociateTokenParams(
    params: z.infer<ReturnType<typeof dissociateTokenParameters>>,
    context: Context,
    client: Client,
  ): Promise<z.infer<ReturnType<typeof dissociateTokenParametersNormalised>>> {
    const parsedParams: z.infer<ReturnType<typeof dissociateTokenParameters>> =
      this.parseParamsWithSchema(params, dissociateTokenParameters, context);

    if (parsedParams.accountId === undefined) {
      parsedParams.accountId = AccountResolver.getDefaultAccount(context, client);

      if (!parsedParams.accountId) {
        throw new Error('Could not determine default account ID');
      }
    }

    return {
      ...parsedParams,
      accountId: AccountId.fromString(parsedParams.accountId),
      tokenIds: parsedParams.tokenIds.map(id => TokenId.fromString(id)),
    };
  }

  static async normaliseCreateTopicParams(
    params: z.infer<ReturnType<typeof createTopicParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ): Promise<z.infer<ReturnType<typeof createTopicParametersNormalised>>> {
    const parsedParams: z.infer<ReturnType<typeof createTopicParameters>> =
      this.parseParamsWithSchema(params, createTopicParameters, context);

    const defaultAccountId = AccountResolver.getDefaultAccount(context, client);
    if (!defaultAccountId) throw new Error('Could not determine default account ID');

    const normalised: z.infer<ReturnType<typeof createTopicParametersNormalised>> = {
      ...parsedParams,
      autoRenewAccountId: defaultAccountId,
    };

    if (parsedParams.isSubmitKey) {
      const publicKey =
        (await mirrorNode.getAccount(defaultAccountId).then(r => r.accountPublicKey)) ??
        client.operatorPublicKey?.toStringDer();
      if (!publicKey) {
        throw new Error('Could not determine public key for submit key');
      }
      normalised.submitKey = PublicKey.fromString(publicKey);
    }

    return normalised;
  }

  static normaliseDeleteTopic(
    params: z.infer<ReturnType<typeof deleteTopicParameters>>,
    context: Context,
    _client: Client,
    _mirrorNode: IHederaMirrornodeService,
  ): z.infer<ReturnType<typeof deleteTopicParametersNormalised>> {
    // First, validate against the basic schema
    const parsedParams: z.infer<ReturnType<typeof deleteTopicParameters>> =
      this.parseParamsWithSchema(params, deleteTopicParameters, context);

    // Then, validate against the normalized schema delete topic schema
    return this.parseParamsWithSchema(parsedParams, deleteTopicParametersNormalised, context);
  }

  static normaliseUpdateTopic = async (
    params: z.infer<ReturnType<typeof updateTopicParameters>>,
    context: Context,
    client: Client,
  ): Promise<z.infer<ReturnType<typeof updateTopicParametersNormalised>>> => {
    const parsedParams: z.infer<ReturnType<typeof updateTopicParameters>> =
      this.parseParamsWithSchema(params, updateTopicParameters, context);

    const topicId = TopicId.fromString(parsedParams.topicId);
    const userPublicKey = await AccountResolver.getDefaultPublicKey(context, client);

    const normalised: z.infer<ReturnType<typeof updateTopicParametersNormalised>> = {
      topicId,
    } as any;

    // Keys
    const maybeKeys: Record<string, string | boolean | undefined> = {
      adminKey: parsedParams.adminKey,
      submitKey: parsedParams.submitKey,
    };

    for (const [field, rawVal] of Object.entries(maybeKeys)) {
      const resolved = this.resolveKey(rawVal, userPublicKey);
      if (resolved) {
        (normalised as any)[field] = resolved;
      }
    }

    // Other optional props
    if (parsedParams.topicMemo) normalised.topicMemo = parsedParams.topicMemo;
    if (parsedParams.autoRenewAccountId)
      normalised.autoRenewAccountId = parsedParams.autoRenewAccountId;
    if (parsedParams.autoRenewPeriod) normalised.autoRenewPeriod = parsedParams.autoRenewPeriod;
    if (parsedParams.expirationTime) {
      normalised.expirationTime =
        parsedParams.expirationTime instanceof Date
          ? parsedParams.expirationTime
          : new Date(parsedParams.expirationTime);
    }

    return normalised;
  };

  static async normaliseCreateAccount(
    params: z.infer<ReturnType<typeof createAccountParameters>>,
    context: Context,
    client: Client,
    mirrorNode: IHederaMirrornodeService,
  ): Promise<z.infer<ReturnType<typeof createAccountParametersNormalised>>> {
    const parsedParams: z.infer<ReturnType<typeof createAccountParameters>> =
      this.parseParamsWithSchema(params, createAccountParameters, context);

    // Try resolving the publicKey in priority order
    let publicKey = parsedParams.publicKey ?? client.operatorPublicKey?.toStringDer();

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

    return {
      ...parsedParams,
      key: PublicKey.fromString(publicKey),
    };
  }

  static normaliseHbarBalanceParams(
    params: z.infer<ReturnType<typeof accountBalanceQueryParameters>>,
    context: Context,
    client: Client,
  ) {
    const parsedParams: z.infer<ReturnType<typeof accountBalanceQueryParameters>> =
      this.parseParamsWithSchema(params, accountBalanceQueryParameters, context);

    const accountId = AccountResolver.resolveAccount(parsedParams.accountId, context, client);
    return {
      ...parsedParams,
      accountId,
    };
  }

  static normaliseAccountTokenBalancesParams(
    params: z.infer<ReturnType<typeof accountTokenBalancesQueryParameters>>,
    context: Context,
    client: Client,
  ) {
    const parsedParams: z.infer<ReturnType<typeof accountTokenBalancesQueryParameters>> =
      this.parseParamsWithSchema(params, accountTokenBalancesQueryParameters, context);

    const accountId = AccountResolver.resolveAccount(parsedParams.accountId, context, client);
    return {
      ...parsedParams,
      accountId,
    };
  }

  static normaliseCreateERC20Params(
    params: z.infer<ReturnType<typeof createERC20Parameters>>,
    factoryContractId: string,
    factoryContractAbi: string[],
    factoryContractFunctionName: string,
    context: Context,
  ) {
    const parsedParams: z.infer<ReturnType<typeof createERC20Parameters>> =
      this.parseParamsWithSchema(params, createERC20Parameters, context);

    // Create an interface for encoding
    const iface = new ethers.Interface(factoryContractAbi);

    // Encode the function call
    const encodedData = iface.encodeFunctionData(factoryContractFunctionName, [
      parsedParams.tokenName,
      parsedParams.tokenSymbol,
      parsedParams.decimals,
      parsedParams.initialSupply,
    ]);

    const functionParameters = ethers.getBytes(encodedData);

    return {
      ...parsedParams,
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
    context: Context,
  ) {
    const parsedParams: z.infer<ReturnType<typeof createERC721Parameters>> =
      this.parseParamsWithSchema(params, createERC721Parameters, context);

    // Create an interface for encoding
    const iface = new ethers.Interface(factoryContractAbi);

    // Encode the function call
    const encodedData = iface.encodeFunctionData(factoryContractFunctionName, [
      parsedParams.tokenName,
      parsedParams.tokenSymbol,
      parsedParams.baseURI,
    ]);

    const functionParameters = ethers.getBytes(encodedData);

    return {
      ...parsedParams,
      contractId: factoryContractId,
      functionParameters,
      gas: 3000000, //TODO: make this configurable
    };
  }

  static async normaliseMintFungibleTokenParams(
    params: z.infer<ReturnType<typeof mintFungibleTokenParameters>>,
    context: Context,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const parsedParams: z.infer<ReturnType<typeof mintFungibleTokenParameters>> =
      this.parseParamsWithSchema(params, mintFungibleTokenParameters, context);

    const tokenInfo = await mirrorNode.getTokenInfo(parsedParams.tokenId);
    const decimals = Number(tokenInfo.decimals);

    // Fallback to 0 if decimals are missing or NaN
    const safeDecimals = Number.isFinite(decimals) ? decimals : 0;

    const baseAmount = toBaseUnit(parsedParams.amount, safeDecimals).toNumber();
    return {
      tokenId: parsedParams.tokenId,
      amount: baseAmount,
    };
  }

  static normaliseMintNonFungibleTokenParams(
    params: z.infer<ReturnType<typeof mintNonFungibleTokenParameters>>,
    context: Context,
  ) {
    const parsedParams: z.infer<ReturnType<typeof mintNonFungibleTokenParameters>> =
      this.parseParamsWithSchema(params, mintNonFungibleTokenParameters, context);

    const encoder = new TextEncoder();
    const metadata = parsedParams.uris.map(uri => encoder.encode(uri));
    return {
      ...parsedParams,
      metadata: metadata,
    };
  }

  static async normaliseTransferERC20Params(
    params: z.infer<ReturnType<typeof transferERC20Parameters>>,
    factoryContractAbi: string[],
    factoryContractFunctionName: string,
    context: Context,
    mirrorNode: IHederaMirrornodeService,
  ) {
    const parsedParams: z.infer<ReturnType<typeof transferERC20Parameters>> =
      this.parseParamsWithSchema(params, transferERC20Parameters, context);

    const recipientAddress = await AccountResolver.getHederaEVMAddress(
      parsedParams.recipientAddress,
      mirrorNode,
    );
    const contractId = await HederaParameterNormaliser.getHederaAccountId(
      parsedParams.contractId,
      mirrorNode,
    );
    const iface = new ethers.Interface(factoryContractAbi);
    const encodedData = iface.encodeFunctionData(factoryContractFunctionName, [
      recipientAddress,
      parsedParams.amount,
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
    const parsedParams: z.infer<ReturnType<typeof transferERC721Parameters>> =
      this.parseParamsWithSchema(params, transferERC721Parameters, context);

    // Resolve fromAddress using AccountResolver pattern, similar to transfer-hbar
    const resolvedFromAddress = AccountResolver.resolveAccount(
      parsedParams.fromAddress,
      context,
      client,
    );
    const fromAddress = await AccountResolver.getHederaEVMAddress(resolvedFromAddress, mirrorNode);
    const toAddress = await AccountResolver.getHederaEVMAddress(parsedParams.toAddress, mirrorNode);
    const contractId = await HederaParameterNormaliser.getHederaAccountId(
      parsedParams.contractId,
      mirrorNode,
    );
    const iface = new ethers.Interface(factoryContractAbi);
    const encodedData = iface.encodeFunctionData(factoryContractFunctionName, [
      fromAddress,
      toAddress,
      parsedParams.tokenId,
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
    context: Context,
    mirrorNode: IHederaMirrornodeService,
    client: Client,
  ) {
    const parsedParams: z.infer<ReturnType<typeof mintERC721Parameters>> =
      this.parseParamsWithSchema(params, mintERC721Parameters, context);

    const resolvedToAddress = AccountResolver.resolveAccount(
      parsedParams.toAddress,
      context,
      client,
    );
    const toAddress = await AccountResolver.getHederaEVMAddress(resolvedToAddress, mirrorNode);
    const contractId = await HederaParameterNormaliser.getHederaAccountId(
      parsedParams.contractId,
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
    const parsedParams: z.infer<ReturnType<typeof deleteAccountParameters>> =
      this.parseParamsWithSchema(params, deleteAccountParameters, context);

    if (!AccountResolver.isHederaAddress(parsedParams.accountId)) {
      throw new Error('Account ID must be a Hedera address');
    }

    // if no transfer account ID is provided, use the operator account ID
    const transferAccountId =
      parsedParams.transferAccountId ?? AccountResolver.getDefaultAccount(context, client);
    if (!transferAccountId) {
      throw new Error('Could not determine transfer account ID');
    }

    return {
      accountId: AccountId.fromString(parsedParams.accountId),
      transferAccountId: AccountId.fromString(transferAccountId),
    };
  }

  static normaliseUpdateAccount(
    params: z.infer<ReturnType<typeof updateAccountParameters>>,
    context: Context,
    client: Client,
  ): z.infer<ReturnType<typeof updateAccountParametersNormalised>> {
    const parsedParams: z.infer<ReturnType<typeof updateAccountParameters>> =
      this.parseParamsWithSchema(params, updateAccountParameters, context);

    const accountId = AccountId.fromString(
      AccountResolver.resolveAccount(parsedParams.accountId, context, client),
    );

    const normalised: z.infer<ReturnType<typeof updateAccountParametersNormalised>> = {
      accountId,
    } as any;

    if (parsedParams.maxAutomaticTokenAssociations !== undefined) {
      normalised.maxAutomaticTokenAssociations = parsedParams.maxAutomaticTokenAssociations;
    }
    if (parsedParams.stakedAccountId !== undefined) {
      normalised.stakedAccountId = parsedParams.stakedAccountId;
    }
    if (parsedParams.accountMemo !== undefined) {
      normalised.accountMemo = parsedParams.accountMemo;
    }
    if (parsedParams.declineStakingReward !== undefined) {
      normalised.declineStakingReward = parsedParams.declineStakingReward;
    }

    return normalised;
  }

  static normaliseGetTransactionRecordParams(
    params: z.infer<ReturnType<typeof transactionRecordQueryParameters>>,
    context: Context,
  ): z.infer<ReturnType<typeof normalisedTransactionRecordQueryParameters>> {
    const parsedParams: z.infer<ReturnType<typeof transactionRecordQueryParameters>> =
      this.parseParamsWithSchema(params, transactionRecordQueryParameters, context);

    const normalised: z.infer<ReturnType<typeof normalisedTransactionRecordQueryParameters>> = {
      nonce: parsedParams.nonce,
    } as any;

    if (!parsedParams.transactionId) {
      throw new Error('transactionId is required');
    }

    const mirrorNodeStyleRegex = /^\d+\.\d+\.\d+-\d+-\d+$/;
    const sdkStyleRegex = /^(\d+\.\d+\.\d+)@(\d+)\.(\d+)$/;

    if (mirrorNodeStyleRegex.test(parsedParams.transactionId)) {
      // Already in mirror-node style, use as-is
      normalised.transactionId = parsedParams.transactionId;
    } else {
      const match = parsedParams.transactionId.match(sdkStyleRegex);
      if (!match) {
        throw new Error(`Invalid transactionId format: ${parsedParams.transactionId}`);
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

  static async normaliseUpdateToken(
    params: z.infer<ReturnType<typeof updateTokenParameters>>,
    context: Context,
    client: Client,
  ): Promise<z.infer<ReturnType<typeof updateTokenParametersNormalised>>> {
    const parsedParams: z.infer<ReturnType<typeof updateTokenParameters>> =
      this.parseParamsWithSchema(params, updateTokenParameters, context);

    const tokenId = TokenId.fromString(parsedParams.tokenId);
    const userPublicKey = await AccountResolver.getDefaultPublicKey(context, client);

    const normalised: z.infer<ReturnType<typeof updateTokenParametersNormalised>> = {
      tokenId,
    };

    // Keys
    const maybeKeys: Record<string, string | boolean | undefined> = {
      adminKey: parsedParams.adminKey,
      supplyKey: parsedParams.supplyKey,
      wipeKey: parsedParams.wipeKey,
      freezeKey: parsedParams.freezeKey,
      kycKey: parsedParams.kycKey,
      feeScheduleKey: parsedParams.feeScheduleKey,
      pauseKey: parsedParams.pauseKey,
      metadataKey: parsedParams.metadataKey,
    };

    for (const [field, rawVal] of Object.entries(maybeKeys)) {
      const resolved = this.resolveKey(rawVal, userPublicKey);
      if (resolved) {
        (normalised as any)[field] = resolved;
      }
    }

    // Other optional props
    if (parsedParams.tokenName) {
      normalised.tokenName = parsedParams.tokenName;
    }
    if (parsedParams.tokenSymbol) {
      normalised.tokenSymbol = parsedParams.tokenSymbol;
    }
    if (parsedParams.treasuryAccountId) {
      normalised.treasuryAccountId = parsedParams.treasuryAccountId;
    }
    if (parsedParams.tokenMemo) {
      normalised.tokenMemo = parsedParams.tokenMemo;
    }
    if (parsedParams.metadata) {
      normalised.metadata = new TextEncoder().encode(parsedParams.metadata);
    }
    if (parsedParams.autoRenewAccountId) {
      normalised.autoRenewAccountId = parsedParams.autoRenewAccountId;
    }

    return normalised;
  }

  private static resolveKey(
    rawValue: string | boolean | undefined,
    userKey: PublicKey,
  ): PublicKey | undefined {
    if (rawValue === undefined) return undefined;
    if (typeof rawValue === 'string') {
      // we do not get the info what type of key the user is passing, so we try both ED25519 and ECDSA
      try {
        return PublicKey.fromStringED25519(rawValue);
      } catch {
        return PublicKey.fromStringECDSA(rawValue);
      }
    }
    if (rawValue) {
      return userKey;
    }
    return undefined;
  }
}
