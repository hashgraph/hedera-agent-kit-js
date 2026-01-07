import { Client, PublicKey } from '@hashgraph/sdk';
import { Context, AgentMode } from '@/shared/configuration';
import { IHederaMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-service.interface';
import { getMirrornodeService } from '@/shared/hedera-utils/mirrornode/hedera-mirrornode-utils';

export class AccountResolver {
  /**
   * Gets the default account based on the agent mode and context.
   * In RETURN_BYTES mode, prefers context.accountId (user's account).
   * In AUTONOMOUS mode or when no context account, uses an operator account.
   */
  static getDefaultAccount(context: Context, client: Client): string {
    // Prefer context.accountId (user's account) if it is set
    if (context.accountId) {
      return context.accountId;
    }

    // Use operator account if context.accountId is not set
    const operatorAccount = client.operatorAccountId?.toString();
    if (!operatorAccount) {
      throw new Error('No account available: neither context.accountId nor operator account');
    }

    return operatorAccount;
  }

  static async getDefaultPublicKey(context: Context, client: Client): Promise<PublicKey> {
    if (context.mode === AgentMode.AUTONOMOUS) {
      return client.operatorPublicKey!;
    }

    const defaultAccount = this.getDefaultAccount(context, client);
    const mirrornodeService = getMirrornodeService(context.mirrornodeService!, client.ledgerId!);

    const defaultAccountDetails = await mirrornodeService.getAccount(defaultAccount);

    if (!defaultAccountDetails?.accountPublicKey) {
      throw new Error('No public key available for the default account');
    }

    return PublicKey.fromString(defaultAccountDetails.accountPublicKey);
  }

  /**
   * Resolves an account ID, using the provided account or falling back to the default.
   */
  static resolveAccount(
    providedAccount: string | undefined,
    context: Context,
    client: Client,
  ): string {
    return providedAccount || this.getDefaultAccount(context, client);
  }

  /**
   * Gets a description of which account will be used as default for prompts.
   */
  static getDefaultAccountDescription(context: Context): string {
    if (context.mode === AgentMode.RETURN_BYTES && context.accountId) {
      return `user account (${context.accountId})`;
    }
    return 'operator account';
  }

  static isHederaAddress(address: string): boolean {
    return address.startsWith('0.') || address.startsWith('0.0.');
  }

  static async getHederaEVMAddress(
    address: string,
    mirrorNode: IHederaMirrornodeService,
  ): Promise<string> {
    if (!AccountResolver.isHederaAddress(address)) {
      return address;
    }
    const account = await mirrorNode.getAccount(address);
    return account.evmAddress;
  }
}
