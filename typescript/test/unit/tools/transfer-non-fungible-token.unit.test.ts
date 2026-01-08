import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
    TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
} from '@/plugins/core-token-plugin/tools/non-fungible-token/transfer-non-fungible-token';

vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
    default: {
        normaliseTransferNonFungibleToken: vi.fn(params => ({
            normalised: true,
            ...params,
        })),
    },
}));
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
    default: { transferNonFungibleToken: vi.fn(() => ({ tx: 'transferTx' })) },
}));
vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
    handleTransaction: vi.fn(async (_tx, _client, _context, post) => {
        const raw = {
            status: 'SUCCESS',
            transactionId: '0.0.1234@1700000000.000000001',
        };
        return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) };
    }),
}));
vi.mock('@/shared/utils/prompt-generator', () => ({
    PromptGenerator: {
        getContextSnippet: vi.fn(() => 'CTX'),
        getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
        getScheduledTransactionParamsDescription: vi.fn(() => 'Scheduled Params'),
    },
}));

const makeClient = () => Client.forNetwork({});

describe('transfer-non-fungible-token tool', () => {
    const context: any = { accountId: '0.0.1001' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exposes correct metadata', () => {
        const tool = toolFactory(context);
        expect(tool.method).toBe(TRANSFER_NON_FUNGIBLE_TOKEN_TOOL);
        expect(tool.name).toBe('Transfer Non Fungible Token');
        expect(typeof tool.description).toBe('string');
        expect(tool.parameters).toBeTruthy();
    });

    it('executes successfully and returns formatted message', async () => {
        const tool = toolFactory(context);
        const client = makeClient();

        const params = {
            tokenId: '0.0.2001',
            recipients: [{ recipientId: '0.0.3001', serialNumber: 1 }],
            transactionMemo: 'NFT transfer test',
        };

        const res: any = await tool.execute(client, context, params);
        expect(res.raw.status).toBe('SUCCESS');
        expect(res.humanMessage).toMatch(
            /Non-fungible tokens successfully transferred. Transaction ID:/i,
        );
    });

    it('supports multiple recipient transfers', async () => {
        const tool = toolFactory(context);
        const client = makeClient();

        const params = {
            tokenId: '0.0.2001',
            recipients: [
                { recipientId: '0.0.3001', serialNumber: 1 },
                { recipientId: '0.0.3002', serialNumber: 2 },
            ],
        };

        const res: any = await tool.execute(client, context, params);
        expect(res.raw.status).toBe('SUCCESS');
    });

    it('returns scheduled transaction info when scheduled', async () => {
        const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
        (handleTransaction as any).mockImplementationOnce(
            async (
                _tx: any,
                _client: any,
                _context: any,
                post: (arg0: { status: string; transactionId: string; scheduleId: string }) => any,
            ) => {
                const raw = {
                    status: 'SUCCESS',
                    transactionId: '0.0.1234@1700000000.000000001',
                    scheduleId: '0.0.5678',
                };
                return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) };
            },
        );

        const tool = toolFactory(context);
        const client = makeClient();

        const params = {
            tokenId: '0.0.2001',
            recipients: [{ recipientId: '0.0.3001', serialNumber: 1 }],
            schedulingParams: { isScheduled: true },
        };

        const res: any = await tool.execute(client, context, params);
        expect(res.raw.status).toBe('SUCCESS');
        expect(res.humanMessage).toContain(
            'Scheduled non-fungible token transfer created successfully',
        );
        expect(res.humanMessage).toContain('Schedule ID: 0.0.5678');
    });

    it('returns aligned error when thrown', async () => {
        const tool = toolFactory(context);
        const client = makeClient();

        const { default: builder } = await import('@/shared/hedera-utils/hedera-builder');
        (builder.transferNonFungibleToken as any).mockImplementation(() => {
            throw new Error('boom');
        });

        const res = await tool.execute(client, context, {
            tokenId: '0.0.2001',
            recipients: [{ recipientId: '0.0.3001', serialNumber: 1 }],
        });
        expect(res.humanMessage).toContain('Failed to transfer non-fungible token:');
        expect(res.humanMessage).toContain('boom');
    });
});
