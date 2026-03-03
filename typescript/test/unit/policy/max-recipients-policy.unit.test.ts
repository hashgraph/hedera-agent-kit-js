import { describe, it, expect } from 'vitest';
import { MaxRecipientsPolicy, Context, AgentMode } from '@/shared';

describe('MaxRecipientsPolicy Unit Tests', () => {
    const context: Context = { mode: AgentMode.AUTONOMOUS };

    describe('HBAR transfers (hbarTransfers)', () => {
        it('should block if positive-amount hbar recipients exceed maxRecipients', () => {
            const policy = new MaxRecipientsPolicy(1);
            const params = {
                context,
                rawParams: {},
                normalisedParams: {
                    hbarTransfers: [
                        { accountId: '0.0.100', amount: -2 }, // sender (negative)
                        { accountId: '0.0.1', amount: 1 },
                        { accountId: '0.0.2', amount: 1 },
                    ],
                },
            };

            expect(policy['shouldBlockPostParamsNormalization'](context, params)).toBe(true);
        });

        it('should not block if positive-amount hbar recipients are within maxRecipients', () => {
            const policy = new MaxRecipientsPolicy(2);
            const params = {
                context,
                rawParams: {},
                normalisedParams: {
                    hbarTransfers: [
                        { accountId: '0.0.100', amount: -2 }, // sender (negative)
                        { accountId: '0.0.1', amount: 1 },
                        { accountId: '0.0.2', amount: 1 },
                    ],
                },
            };

            expect(policy['shouldBlockPostParamsNormalization'](context, params)).toBe(false);
        });
    });

    describe('HBAR transfers with SDK objects (Hbar/Long amounts)', () => {
        // Simulates Hbar/Long objects that have isNegative() and isZero() methods
        const mockHbar = (val: number) => ({
            isNegative: () => val < 0,
            isZero: () => val === 0,
        });

        it('should block if positive Hbar-object recipients exceed maxRecipients', () => {
            const policy = new MaxRecipientsPolicy(1);
            const params = {
                context,
                rawParams: {},
                normalisedParams: {
                    hbarTransfers: [
                        { accountId: '0.0.100', amount: mockHbar(-2) }, // sender
                        { accountId: '0.0.1', amount: mockHbar(1) },
                        { accountId: '0.0.2', amount: mockHbar(1) },
                    ],
                },
            };

            expect(policy['shouldBlockPostParamsNormalization'](context, params)).toBe(true);
        });

        it('should not block if positive Hbar-object recipients are within maxRecipients', () => {
            const policy = new MaxRecipientsPolicy(2);
            const params = {
                context,
                rawParams: {},
                normalisedParams: {
                    hbarTransfers: [
                        { accountId: '0.0.100', amount: mockHbar(-2) }, // sender
                        { accountId: '0.0.1', amount: mockHbar(1) },
                        { accountId: '0.0.2', amount: mockHbar(1) },
                    ],
                },
            };

            expect(policy['shouldBlockPostParamsNormalization'](context, params)).toBe(false);
        });

        it('should not count zero-amount entries as recipients', () => {
            const policy = new MaxRecipientsPolicy(1);
            const params = {
                context,
                rawParams: {},
                normalisedParams: {
                    hbarTransfers: [
                        { accountId: '0.0.100', amount: mockHbar(-1) }, // sender
                        { accountId: '0.0.1', amount: mockHbar(1) },   // recipient
                        { accountId: '0.0.2', amount: mockHbar(0) },   // zero — not a recipient
                    ],
                },
            };

            expect(policy['shouldBlockPostParamsNormalization'](context, params)).toBe(false);
        });
    });

    describe('Fungible token transfers (tokenTransfers)', () => {
        it('should block if positive-amount token recipients exceed maxRecipients', () => {
            const policy = new MaxRecipientsPolicy(1);
            const params = {
                context,
                rawParams: {},
                normalisedParams: {
                    tokenTransfers: [
                        { tokenId: '0.0.999', accountId: '0.0.100', amount: -50 }, // sender
                        { tokenId: '0.0.999', accountId: '0.0.1', amount: 25 },
                        { tokenId: '0.0.999', accountId: '0.0.2', amount: 25 },
                    ],
                },
            };

            expect(policy['shouldBlockPostParamsNormalization'](context, params)).toBe(true);
        });

        it('should not block if positive-amount token recipients are within maxRecipients', () => {
            const policy = new MaxRecipientsPolicy(2);
            const params = {
                context,
                rawParams: {},
                normalisedParams: {
                    tokenTransfers: [
                        { tokenId: '0.0.999', accountId: '0.0.100', amount: -50 }, // sender
                        { tokenId: '0.0.999', accountId: '0.0.1', amount: 25 },
                        { tokenId: '0.0.999', accountId: '0.0.2', amount: 25 },
                    ],
                },
            };

            expect(policy['shouldBlockPostParamsNormalization'](context, params)).toBe(false);
        });
    });

    describe('NFT transfers (transfers)', () => {
        it('should block if NFT recipients exceed maxRecipients', () => {
            const policy = new MaxRecipientsPolicy(1);
            const params = {
                context,
                rawParams: {},
                normalisedParams: {
                    transfers: [
                        { nftId: 'nft-1', receiver: '0.0.1' },
                        { nftId: 'nft-2', receiver: '0.0.2' },
                    ],
                },
            };

            expect(policy['shouldBlockPostParamsNormalization'](context, params)).toBe(true);
        });

        it('should not block if NFT recipients are within maxRecipients', () => {
            const policy = new MaxRecipientsPolicy(2);
            const params = {
                context,
                rawParams: {},
                normalisedParams: {
                    transfers: [
                        { nftId: 'nft-1', receiver: '0.0.1' },
                        { nftId: 'nft-2', receiver: '0.0.2' },
                    ],
                },
            };

            expect(policy['shouldBlockPostParamsNormalization'](context, params)).toBe(false);
        });
    });

    it('should throw error if none of the expected transfer fields exist in normalisedParams', () => {
        const policy = new MaxRecipientsPolicy(1);
        const params = {
            context,
            rawParams: {},
            normalisedParams: {
                otherField: 'val',
            },
        };

        expect(() => policy['shouldBlockPostParamsNormalization'](context, params)).toThrow(
            "'hbarTransfers', 'tokenTransfers' or 'transfers' is not defined in normalised parameters",
        );
    });

    it('should include additional tools from constructor', () => {
        const policy = new MaxRecipientsPolicy(1, ['customTool']);
        expect(policy.relevantTools).toContain('customTool');
        expect(policy.relevantTools).toContain('transfer_hbar_tool');
    });
});
