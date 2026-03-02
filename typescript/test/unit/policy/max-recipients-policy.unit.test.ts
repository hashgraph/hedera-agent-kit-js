import { describe, it, expect } from 'vitest';
import { MaxRecipientsPolicy, Context, AgentMode } from '@/shared';

describe('MaxRecipientsPolicy Unit Tests', () => {
    const context: Context = { mode: AgentMode.AUTONOMOUS };

    it('should block if recipients length exceeds maxRecipients', () => {
        const policy = new MaxRecipientsPolicy(1);
        const params = {
            context,
            rawParams: {
                recipients: [
                    { accountId: '0.0.1', amount: 1 },
                    { accountId: '0.0.2', amount: 1 },
                ],
            },
        };

        expect(policy['shouldBlockPreToolExecution'](context, params)).toBe(true);
    });

    it('should not block if recipients length is within maxRecipients', () => {
        const policy = new MaxRecipientsPolicy(2);
        const params = {
            context,
            rawParams: {
                recipients: [
                    { accountId: '0.0.1', amount: 1 },
                    { accountId: '0.0.2', amount: 1 },
                ],
            },
        };

        expect(policy['shouldBlockPreToolExecution'](context, params)).toBe(false);
    });

    it('should block if transfers length exceeds maxRecipients', () => {
        const policy = new MaxRecipientsPolicy(1);
        const params = {
            context,
            rawParams: {
                transfers: [
                    { accountId: '0.0.1', amount: 1 },
                    { accountId: '0.0.2', amount: 1 },
                ],
            },
        };

        expect(policy['shouldBlockPreToolExecution'](context, params)).toBe(true);
    });

    it('should throw error if recipients or transfers is missing', () => {
        const policy = new MaxRecipientsPolicy(1);
        const params = {
            context,
            rawParams: {
                otherField: 'val',
            },
        };

        expect(() => policy['shouldBlockPreToolExecution'](context, params)).toThrow(
            "Field 'recipients' or 'transfers' is not defined in tool parameters",
        );
    });

    it('should include additional tools from constructor', () => {
        const policy = new MaxRecipientsPolicy(1, ['customTool']);
        expect(policy.relevantTools).toContain('customTool');
        expect(policy.relevantTools).toContain('transfer_hbar_tool');
    });
});
