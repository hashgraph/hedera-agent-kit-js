import { LedgerId } from '@hashgraph/sdk';
import { HederaMirrornodeServiceDefaultImpl } from './hedera-mirrornode-service-default-impl';
import { IHederaMirrornodeService } from './hedera-mirrornode-service.interface';

export const getMirrornodeService = (
  mirrornodeService: IHederaMirrornodeService | undefined,
  ledgerId: LedgerId,
) => {
  if (mirrornodeService) {
    return mirrornodeService;
  }
  return new HederaMirrornodeServiceDefaultImpl(ledgerId);
};
