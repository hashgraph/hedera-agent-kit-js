import { Policy, Context, PreToolExecutionParams } from '@/shared';

const TRANSFER_HBAR_TOOL = 'transfer_hbar_tool';
const TRANSFER_HBAR_WITH_ALLOWANCE_TOOL = 'transfer_hbar_with_allowance_tool';
const AIRDROP_FUNGIBLE_TOKEN_TOOL = 'airdrop_fungible_token_tool';
const TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL = 'transfer_fungible_token_with_allowance_tool';
const TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL =
    'transfer_non_fungible_token_with_allowance_tool';
const TRANSFER_NON_FUNGIBLE_TOKEN_TOOL = 'transfer_non_fungible_token_tool';

export class MaxRecipientsPolicy extends Policy {
    name = 'Max Recipients Policy';
    description = '';
    relevantTools: string[] = [
        TRANSFER_HBAR_TOOL,
        TRANSFER_HBAR_WITH_ALLOWANCE_TOOL,
        AIRDROP_FUNGIBLE_TOKEN_TOOL,
        TRANSFER_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
        TRANSFER_NON_FUNGIBLE_TOKEN_WITH_ALLOWANCE_TOOL,
        TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
    ];

    private maxRecipients: number;

    constructor(maxRecipients: number, additionalTools: string[] = []) {
        super();
        this.maxRecipients = maxRecipients;
        this.description = `Limits the maximum number of recipients to ${maxRecipients}`;
        this.relevantTools = [...this.relevantTools, ...additionalTools];
    }

    protected shouldBlockPreToolExecution(
        _context: Context,
        params: PreToolExecutionParams,
    ): boolean {
        try {
            const recipients = params.rawParams.recipients || params.rawParams.transfers;

            if (!recipients) {
                throw new Error(
                    `Field 'recipients' or 'transfers' is not defined in tool parameters. This policy might be incorrectly applied to tool: ${params.context.mode}`,
                );
            }

            const count = Array.isArray(recipients) ? recipients.length : 0;

            if (count > this.maxRecipients) {
                console.log(
                    `MaxRecipientsPolicy: tool call rejected - expected max ${this.maxRecipients} recipients, got ${count}`,
                );
                return true;
            }

            return false;
        } catch (error) {
            if (error instanceof Error) {
                throw error;
            }
            throw new Error('An unknown error occurred in MaxRecipientsPolicy');
        }
    }
}
