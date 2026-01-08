import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Client } from '@hashgraph/sdk';
import toolFactory, {
    DELETE_NFT_ALLOWANCE_TOOL,
} from '@/plugins/core-token-plugin/tools/non-fungible-token/delete-non-fungible-token-allowance';

// Mocks for dependencies
vi.mock('@/shared/hedera-utils/hedera-parameter-normaliser', () => ({
    default: {
        normaliseDeleteNftAllowance: vi.fn((params: any) => ({ normalised: true, ...params })),
    },
}));
vi.mock('@/shared/hedera-utils/hedera-builder', () => ({
    default: { deleteNftAllowance: vi.fn((_params: any) => ({ tx: 'deleteNftAllowanceTx' })) },
}));
vi.mock('@/shared/strategies/tx-mode-strategy', () => ({
    handleTransaction: vi.fn(async (_tx: any, _client: any, _context: any, post?: any) => {
        const raw = {
            status: 22,
            accountId: null,
            tokenId: null,
            transactionId: '0.0.2345@1700000000.000000002',
            topicId: null,
        };
        return { raw, humanMessage: post ? post(raw) : JSON.stringify(raw) };
    }),
    RawTransactionResponse: {} as any,
}));
vi.mock('@/shared/utils/prompt-generator', () => ({
    PromptGenerator: {
        getContextSnippet: vi.fn(() => 'CTX'),
        getAccountParameterDescription: vi.fn(() => 'ownerAccountId (string): Owner account ID'),
        getParameterUsageInstructions: vi.fn(() => 'Usage: Provide the parameters as JSON.'),
    },
}));

const makeClient = () => {
    return Client.forNetwork({});
};

describe('delete-nft-allowance tool (unit)', () => {
    const context: any = { accountId: '0.0.1001' };

    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('exposes correct metadata', () => {
        const tool = toolFactory(context);
        expect(tool.method).toBe(DELETE_NFT_ALLOWANCE_TOOL);
        expect(tool.name).toBe('Delete Non Fungible Token Allowance');
        expect(typeof tool.description).toBe('string');
        expect(tool.description).toContain('deletes NFT allowance');
        expect(tool.parameters).toBeTruthy();
    });

    it('executes happy path and returns formatted human message with tx id', async () => {
        const tool = toolFactory(context);
        const client = makeClient();

        const params = {
            ownerAccountId: '0.0.1001',
            tokenId: '0.0.7777',
            serialNumbers: [1, 2],
            transactionMemo: 'unit test delete NFT allowance',
        };

        const res: any = await tool.execute(client, context, params as any);

        expect(res).toBeDefined();
        expect(res.raw).toBeDefined();
        expect(res.humanMessage).toMatch(/NFT allowance\(s\) deleted successfully\./);
        expect(res.humanMessage).toMatch(/Transaction ID:/);

        const { handleTransaction } = await import('@/shared/strategies/tx-mode-strategy');
        expect(handleTransaction).toHaveBeenCalledTimes(1);

        const { default: HederaBuilder } = await import('@/shared/hedera-utils/hedera-builder');
        expect(HederaBuilder.deleteNftAllowance).toHaveBeenCalledTimes(1);

        const { default: HederaParameterNormaliser } = await import(
            '@/shared/hedera-utils/hedera-parameter-normaliser'
        );
        expect(HederaParameterNormaliser.normaliseDeleteNftAllowance).toHaveBeenCalledWith(
            params,
            context,
            client,
        );
    });

    it('handles error gracefully when normalisation fails', async () => {
        const { default: HederaParameterNormaliser } = await import(
            '@/shared/hedera-utils/hedera-parameter-normaliser'
        );
        (HederaParameterNormaliser.normaliseDeleteNftAllowance as any).mockImplementationOnce(() => {
            throw new Error('Normalisation error');
        });

        const tool = toolFactory(context);
        const client = makeClient();

        const params = {
            tokenId: '0.0.7777',
            serialNumbers: [1],
        };

        const res: any = await tool.execute(client, context, params as any);

        expect(res).toBeDefined();
        expect(res.humanMessage).toContain('Failed to delete NFT allowance');
        expect(res.humanMessage).toContain('Normalisation error');
    });
});
