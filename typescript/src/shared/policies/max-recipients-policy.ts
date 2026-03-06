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

function _getDefaultRelevantTools(): string[] {
  return [
    coreAccountPluginToolNames.TRANSFER_HBAR_TOOL,
    coreAccountPluginToolNames.TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
    coreTokenPluginToolNames.AIRDROP_FUNGIBLE_TOKEN_TOOL,
    coreTokenPluginToolNames.TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
    coreTokenPluginToolNames.TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
    coreTokenPluginToolNames.TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
  ];
}

function _isPositiveAmount(v: any): boolean {
  if (!('amount' in v)) return true; // NFT — no amount means it's a recipient
  if (
    v.amount != null &&
    typeof v.amount === 'object' &&
    typeof v.amount.isNegative === 'function'
  ) {
    return !v.amount.isNegative() && !v.amount.isZero?.();
  }
  return Number(v.amount) > 0;
}

function _countTransferHbar(
  params: z.infer<ReturnType<typeof transferHbarParametersNormalised>>,
): number {
  return (params.hbarTransfers || []).filter(_isPositiveAmount).length;
}

function _countTransferHbarWithAllowance(
  params: z.infer<ReturnType<typeof transferHbarWithAllowanceParametersNormalised>>,
): number {
  // In TS, transfer_hbar_with_allowance sets hbarTransfers with positive amounts
  return (params.hbarTransfers || []).filter(_isPositiveAmount).length;
}

function _countAirdropFungibleToken(
  params: z.infer<ReturnType<typeof airdropFungibleTokenParametersNormalised>>,
): number {
  return (params.tokenTransfers || []).filter(_isPositiveAmount).length;
}

function _countTransferFungibleTokenWithAllowance(
  params: z.infer<ReturnType<typeof transferFungibleTokenWithAllowanceParametersNormalised>>,
): number {
  return (params.tokenTransfers || []).filter(_isPositiveAmount).length;
}

function _countTransferNftWithAllowance(
  params: z.infer<ReturnType<typeof transferNonFungibleTokenWithAllowanceParametersNormalised>>,
): number {
  return (params.transfers || []).length;
}

function _countTransferNonFungibleToken(
  params: z.infer<ReturnType<typeof transferNonFungibleTokenParametersNormalised>>,
): number {
  return (params.transfers || []).length;
}

let _builtinStrategiesCache: Record<string, (params: any) => number> | null = null;
function _getBuiltinStrategies(): Record<string, (params: any) => number> {
  if (!_builtinStrategiesCache) {
    _builtinStrategiesCache = {
      [coreAccountPluginToolNames.TRANSFER_HBAR_TOOL]: _countTransferHbar,
      [coreAccountPluginToolNames.TRANSFER_HBAR_WITH_ALLOWANCE_TOOL]:
        _countTransferHbarWithAllowance,
      [coreTokenPluginToolNames.AIRDROP_FUNGIBLE_TOKEN_TOOL]: _countAirdropFungibleToken,
      [coreTokenPluginToolNames.TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL]:
        _countTransferFungibleTokenWithAllowance,
      [coreTokenPluginToolNames.TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL]:
        _countTransferNftWithAllowance,
      [coreTokenPluginToolNames.TRANSFER_NON_FUNGIBLE_TOKEN_TOOL]: _countTransferNonFungibleToken,
    };
  }
  return _builtinStrategiesCache;
}

/**
 * Limits the maximum number of recipients allowed in a single transfer / airdrop call.
 *
 * Works for HBAR transfers, fungible-token transfers, NFT transfers and airdrops.
 * The policy is evaluated *after* parameter normalization so it operates on the
 * already-parsed SDK objects rather than raw LLM text.
 *
 * If you are adding custom tools using the `additionalTools` parameter, you must
 * also provide a strategy to count the recipients using the `customStrategies` parameter.
 *
 * @example
 * ```typescript
 * function myCustomToolStrategy(normalizedParams: any): number {
 *     // Custom logic to count recipients from the normalized params
 *     return normalizedParams.customRecipients.length;
 * }
 *
 * const policy = new MaxRecipientsPolicy(
 * 5,
 * ['my_custom_tool'],
 * { my_custom_tool: myCustomToolStrategy }
 * );
 * ```
 */
export class MaxRecipientsPolicy extends Policy {
  name = 'Max Recipients Policy';
  description: string;
  relevantTools: string[];

  private maxRecipients: number;
  private customStrategies: Record<string, (params: any) => number>;

  /**
   * @param maxRecipients The maximum number of recipients allowed.
   * @param additionalTools Optional list of tool names to apply the policy to, in addition to the default tools.
   * @param customStrategies Optional dictionary mapping tool names to functions that calculate the number of recipients for the tool. Required for any tools provided in `additionalTools`.
   */
  constructor(
    maxRecipients: number,
    additionalTools?: string[],
    customStrategies?: Record<string, (params: any) => number>,
  ) {
    super();
    this.maxRecipients = maxRecipients;
    this.description = `Limits the maximum number of recipients to ${maxRecipients} `;

    this.relevantTools = [..._getDefaultRelevantTools()];
    if (additionalTools) {
      this.relevantTools.push(...additionalTools);
    }

    this.customStrategies = customStrategies || {};
  }

  protected shouldBlockPostParamsNormalization(
    _context: Context,
    allParams: PostParamsNormalizationParams,
    _client: Client,
    method: string,
  ): boolean {
    try {
      const params = allParams.normalisedParams;
      let recipientCount = 0;
      const builtins = _getBuiltinStrategies();

      if (method in this.customStrategies) {
        recipientCount = this.customStrategies[method](params);
      } else if (method in builtins) {
        recipientCount = builtins[method](params);
      } else {
        throw new Error(
          `MaxRecipientsPolicy: unhandled tool '${method}'. ` +
            `Please provide a custom counting strategy for this tool via the ` +
            `'customStrategies' constructor parameter.`,
        );
      }

      if (recipientCount > this.maxRecipients) {
        console.log(
          `MaxRecipientsPolicy: ${method} tool call rejected - expected max ${this.maxRecipients} recipients, got ${recipientCount} `,
        );
        return true;
      }

      return false;
    } catch (error) {
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(
        `MaxRecipientsPolicy: An unknown error occurred in MaxRecipientsPolicy in tool ${method} `,
      );
    }
  }
}
