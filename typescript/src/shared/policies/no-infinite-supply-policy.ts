import { Policy, ToolExecutionPoint, PolicyValidationParams } from '@/shared';
import { TokenSupplyType } from '@hashgraph/sdk';

export class NoInfiniteSupplyPolicy implements Policy {
  name = 'No Infinite Supply Policy';
  description = 'Prevents the creation of tokens with Infinite supply type';
  relevantTools = ['create_fungible_token_tool', 'create_non_fungible_token_tool']; //FIXME: those tools do not support policies yet
  affectedPoints = [ToolExecutionPoint.PostParamsNormalization];

  shouldBlock(validationParams: PolicyValidationParams): boolean {
    // Check if supplyType is set to Infinite
    // Params are normalized, so supplyType should be a TokenSupplyType object/enum
    const params = validationParams.normalisedParams;
    if (!params) return false;

    if (params.supplyType) {
      // Direct comparison with SDK enum/object
      if (params.supplyType === TokenSupplyType.Infinite) {
        return true;
      }
      // Fallback toString check just in case of weird binding/marshaling
      if (params.supplyType.toString() === 'Infinite') {
        return true;
      }
    }
    return false;
  }
}
