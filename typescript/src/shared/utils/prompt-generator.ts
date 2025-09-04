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
- Leave optional parameters undefined if not specified by the user`;
  }
}
