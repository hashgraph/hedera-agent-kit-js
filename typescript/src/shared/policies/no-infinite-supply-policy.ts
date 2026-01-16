import { Policy } from '@/shared';
import { TokenSupplyType } from '@hashgraph/sdk';

export class NoInfiniteSupplyPolicy implements Policy {
  name = 'No Infinite Supply Policy';
  description = 'Prevents the creation of tokens with Infinite supply type';
  relevantTools = ['create_fungible_token_tool', 'create_non_fungible_token_tool'];

  shouldBlock(params: any): boolean {
    // Check if supplyType is set to Infinite
    // Params are normalized, so supplyType should be a TokenSupplyType object/enum
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
