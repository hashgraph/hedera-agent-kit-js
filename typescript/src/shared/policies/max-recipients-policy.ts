import { Policy, Context, PostParamsNormalizationParams } from '@/shared';
import { Client } from '@hashgraph/sdk';
import { coreAccountPluginToolNames } from '@/plugins/core-account-plugin';
import { coreTokenPluginToolNames } from '@/plugins/core-token-plugin';
import z from 'zod';

import {
  airdropFungibleTokenParametersNormalised,
  transferFungibleTokenWithAllowanceParametersNormalised,
  transferNonFungibleTokenParametersNormalised,
  transferNonFungibleTokenWithAllowanceParametersNormalised,
} from '@/shared/parameter-schemas/token.zod';
import {
  transferHbarParametersNormalised,
  transferHbarWithAllowanceParametersNormalised,
} from '../parameter-schemas/account.zod';

export class MaxRecipientsPolicy extends Policy {
  readonly name = 'Max Recipients Policy';
  readonly description: string;
  readonly relevantTools: string[];

  private readonly maxRecipients: number;
  private readonly customStrategies: Record<string, (params: any) => number>;
  private _builtinStrategiesCache: Record<string, (params: any) => number> | null = null;

  constructor(
    maxRecipients: number,
    additionalTools: string[] = [],
    customStrategies: Record<string, (params: any) => number> = {},
  ) {
    super();
    this.maxRecipients = maxRecipients;
    this.description = `Limits the maximum number of recipients to ${maxRecipients}`;
    this.customStrategies = customStrategies;

    // Initialize tools list
    this.relevantTools = [
      coreAccountPluginToolNames.TRANSFER_HBAR_TOOL,
      coreAccountPluginToolNames.TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
      coreTokenPluginToolNames.AIRDROP_FUNGIBLE_TOKEN_TOOL,
      coreTokenPluginToolNames.TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
      coreTokenPluginToolNames.TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
      coreTokenPluginToolNames.TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
      ...additionalTools,
    ];
  }

  protected shouldBlockPostParamsNormalization(
    _context: Context,
    allParams: PostParamsNormalizationParams,
    _client: Client,
    method: string,
  ): boolean {
    const params = allParams.normalisedParams;
    const builtins = this._getBuiltinStrategies();

    // Strategy resolution priority: Custom > Built-in
    const strategy = this.customStrategies[method] ?? builtins[method];

    if (!strategy) {
      throw new Error(
        `MaxRecipientsPolicy: Unhandled tool '${method}'. Provide a custom strategy in the constructor.`,
      );
    }

    const recipientCount = strategy(params);

    if (recipientCount > this.maxRecipients) {
      console.warn(
        `MaxRecipientsPolicy: ${method} blocked. Recipient count ${recipientCount} exceeds limit of ${this.maxRecipients}.`,
      );
      return true;
    }

    return false;
  }

  // --- Helper: Recipient Identification ---

  private _isRecipient = (transfer: any): boolean => {
    if (!transfer) return false;

    // 1. NFTs: No amount property means it's a recipient by definition (since each transfer is 1 NFT)
    if (!('amount' in transfer)) return true;

    const amt = transfer.amount;

    // 2. Objects (Hbar / BigNumber)
    if (amt && typeof amt === 'object') {
      // Use toBigNumber() if it's an Hbar, otherwise assume it's already a BigNumber
      const bn = typeof amt.toBigNumber === 'function' ? amt.toBigNumber() : amt;

      // bignumber.js provides .isPositive() and .isZero()
      // We want strictly greater than zero
      return typeof bn.isGreaterThan === 'function' ? bn.isGreaterThan(0) : Number(amt) > 0;
    }

    // 3. Primitives (number / string)
    return Number(amt) > 0;
  };

  // --- Explicit Strategies ---

  private _countHbar = (params: z.infer<ReturnType<typeof transferHbarParametersNormalised>>) =>
    (params.hbarTransfers ?? []).filter(this._isRecipient).length;

  private _countHbarAllowance = (
    params: z.infer<ReturnType<typeof transferHbarWithAllowanceParametersNormalised>>,
  ) => (params.hbarTransfers ?? []).filter(this._isRecipient).length;

  private _countAirdrop = (
    params: z.infer<ReturnType<typeof airdropFungibleTokenParametersNormalised>>,
  ) => (params.tokenTransfers ?? []).filter(this._isRecipient).length;

  private _countTokenAllowance = (
    params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParametersNormalised>>,
  ) => (params.tokenTransfers ?? []).filter(this._isRecipient).length;

  private _countNft = (
    params: z.infer<ReturnType<typeof transferNonFungibleTokenParametersNormalised>>,
  ) => (params.transfers ?? []).length;

  private _countNftAllowance = (
    params: z.infer<ReturnType<typeof transferNonFungibleTokenWithAllowanceParametersNormalised>>,
  ) => (params.transfers ?? []).length;

  private _getBuiltinStrategies(): Record<string, (params: any) => number> {
    if (!this._builtinStrategiesCache) {
      this._builtinStrategiesCache = {
        [coreAccountPluginToolNames.TRANSFER_HBAR_TOOL]: this._countHbar,
        [coreAccountPluginToolNames.TRANSFER_HBAR_WITH_ALLOWANCE_TOOL]: this._countHbarAllowance,
        [coreTokenPluginToolNames.AIRDROP_FUNGIBLE_TOKEN_TOOL]: this._countAirdrop,
        [coreTokenPluginToolNames.TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL]:
          this._countTokenAllowance,
        [coreTokenPluginToolNames.TRANSFER_NON_FUNGIBLE_TOKEN_TOOL]: this._countNft,
        [coreTokenPluginToolNames.TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL]:
          this._countNftAllowance,
      };
    }
    return this._builtinStrategiesCache;
  }
}
