import { Policy, Context, PostParamsNormalizationParams } from '@/shared';

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

    protected shouldBlockPostParamsNormalization(
        _context: Context,
        params: PostParamsNormalizationParams,
    ): boolean {
        try {
            const { normalisedParams } = params;
            const transferList =
                normalisedParams.hbarTransfers ||
                normalisedParams.tokenTransfers ||
                normalisedParams.transfers;

            if (!transferList) {
                throw new Error(
                    `Field 'hbarTransfers', 'tokenTransfers' or 'transfers' is not defined in normalised parameters. This policy might be incorrectly applied to tool: ${params.context.mode}`,
                );
            }

            if (!Array.isArray(transferList)) {
                return false;
            }

            // NFT transfers have no 'amount' field — every entry is a recipient.
            // Fungible / HBAR transfers include the sender with a negative amount,
            // so we only count entries with a positive amount as recipients.
            // Amount can be an Hbar object, Long, or plain number depending on the normalizer.
            const recipientCount = transferList.filter(
                (entry: any) => {
                    if (!('amount' in entry)) return true; // NFT — no amount means it's a recipient
                    const amt = entry.amount;
                    if (amt != null && typeof amt === 'object' && typeof amt.isNegative === 'function') {
                        return !amt.isNegative() && !amt.isZero?.();
                    }
                    return Number(amt) > 0;
                },
            ).length;

            if (recipientCount > this.maxRecipients) {
                console.log(
                    `MaxRecipientsPolicy: tool call rejected - expected max ${this.maxRecipients} recipients, got ${recipientCount}`,
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
