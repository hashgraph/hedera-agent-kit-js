import { Context, AgentMode } from '@/shared/configuration';
import { AccountResolver } from '@/shared';

export class PromptGenerator {
  /**
   * Generates a consistent context snippet for tool prompts.
   */
  static getContextSnippet(context: Context): string {
    const lines = ['Context:'];

    if (context.mode === AgentMode.RETURN_BYTES) {
      lines.push(`- Mode: Return Bytes (preparing transactions for user signing)`);
      if (context.accountId) {
        lines.push(`- User Account: ${context.accountId} (default for transaction parameters)`);
        lines.push(`- When no account is specified, ${context.accountId} will be used`);
      } else {
        lines.push(`- User Account: Not specified`);
        lines.push(`- When no account is specified, the operator account will be used`);
      }
    } else if (context.mode === AgentMode.AUTONOMOUS) {
      lines.push(`- Mode: Autonomous (agent executes transactions directly)`);
      if (context.accountId) {
        lines.push(`- User Account: ${context.accountId}`);
      }
      lines.push(`- When no account is specified, the operator account will be used`);
    } else {
      lines.push(`- Mode: ${context.mode || 'Not specified'}`);
      if (context.accountId) {
        lines.push(`- User Account: ${context.accountId}`);
      }
      lines.push(`- Default account will be determined at execution time`);
    }

    return lines.join('\n');
  }

  static getAnyAddressParameterDescription(
    paramName: string,
    context: Context,
    isRequired: boolean = false,
  ): string {
    if (isRequired) {
      return `${paramName} (str, required): The account address. This can be the EVM address or the Hedera account id`;
    }

    return `${paramName} (str, optional): The Hedera account ID or EVM address. If not provided, defaults to the ${AccountResolver.getDefaultAccountDescription(context)}`;
  }

  /**
   * Generates a consistent description for optional account parameters.
   */
  static getAccountParameterDescription(
    paramName: string,
    context: Context,
    isRequired: boolean = false,
  ): string {
    if (isRequired) {
      return `${paramName} (str, required): The Hedera account ID`;
    }

    const defaultAccountDesc = AccountResolver.getDefaultAccountDescription(context);
    return `${paramName} (str, optional): The Hedera account ID. If not provided, defaults to the ${defaultAccountDesc}`;
  }

  /**
   * Generates consistent parameter usage instructions.
   */
  static getParameterUsageInstructions(): string {
    return `
Important:
- Only include optional parameters if explicitly provided by the user
- Do not generate placeholder values for optional fields
- Leave optional parameters undefined if not specified by the user
- Important: If the user mentions multiple recipients or amounts and tool accepts an array, combine all recipients, tokens or similar assets into a single array and make exactly one call to that tool. Do not split the action into multiple tool calls if it's possible to do so.
`;
  }

  static getScheduledTransactionParamsDescription(context: Context): string {
    return `schedulingParams (object, optional): Parameters for scheduling this transaction instead of executing immediately.

**Fields that apply to the *schedule entity*, not the inner transaction:**

- **isScheduled** (boolean, optional, default false):  
  If true, the transaction will be created as a scheduled transaction.  
  If false or omitted, all other scheduling parameters will be ignored.

- **adminKey** (boolean|string, optional, default false):  
  Admin key that can delete or modify the scheduled transaction before execution.  
  - If true, the operator key will be used.  
  - If false or omitted, no admin key is set.  
  - If a string is passed, it will be used as the admin key.

- **payerAccountId** (string, optional):  
  Account that will pay the transaction fee when the scheduled transaction executes.  
  Defaults to the ${AccountResolver.getDefaultAccountDescription(context)}.

- **expirationTime** (string, optional, ISO 8601):  
  Time when the scheduled transaction will expire if not fully signed.
  
- **waitForExpiry** (boolean, optional, default \`false\`):  
  Determines when the scheduled transaction executes:  
  - \`false\` (default): execute as soon as all required signatures are collected.  
  - \`true\`: execute at the scheduled expiration time, even if all signatures are already collected.  
  Requires \`expirationTime\` to be set if \`true\`. Set to \`true\` only when the user explicitly requests execution at expiration.

**Notes**
- Setting any scheduling parameter implies delayed execution through the Hedera schedule service.
- The network executes the scheduled transaction automatically once all required signatures are collected.
`;
  }
}
