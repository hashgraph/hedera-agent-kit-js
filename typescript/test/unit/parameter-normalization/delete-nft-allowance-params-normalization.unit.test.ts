import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Client, AccountId, TokenId, NftId } from '@hashgraph/sdk';
import { Context } from '@/shared/configuration';
import { AccountResolver } from '@/shared/utils/account-resolver';
import HederaParameterNormaliser from '@/shared/hedera-utils/hedera-parameter-normaliser';

// Mock the AccountResolver
vi.mock('@/shared/utils/account-resolver', () => ({
    AccountResolver: { resolveAccount: vi.fn() },
}));

describe('HederaParameterNormaliser.normaliseDeleteNftAllowance', () => {
    let mockContext: Context;
    let mockClient: Client;
    const operatorId = AccountId.fromString('0.0.5005').toString();

    beforeEach(() => {
        vi.clearAllMocks();
        mockContext = {} as any;
        mockClient = {} as Client;
        vi.mocked(AccountResolver.resolveAccount).mockReturnValue(operatorId);
    });

    it('normalises params with explicit owner, tokenId, serialNumbers and memo', () => {
        const params = {
            ownerAccountId: '0.0.1111',
            tokenId: '0.0.7777',
            serialNumbers: [1, 2, 3],
            transactionMemo: 'delete NFT allowance memo',
        };

        const res = HederaParameterNormaliser.normaliseDeleteNftAllowance(
            params as any,
            mockContext,
            mockClient,
        );

        expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(
            '0.0.1111',
            mockContext,
            mockClient,
        );

        expect(res.nftWipes).toBeDefined();
        expect(res.nftWipes.length).toBe(3);

        // Verify each NftId
        res.nftWipes.forEach((nftId, index) => {
            expect(nftId).toBeInstanceOf(NftId);
            expect(nftId.tokenId.toString()).toBe(TokenId.fromString('0.0.7777').toString());
            expect(nftId.serial.toNumber()).toBe(index + 1);
        });

        expect(res.ownerAccountId.toString()).toBe(operatorId);
        expect(res.transactionMemo).toBe('delete NFT allowance memo');
    });

    it('defaults ownerAccountId using AccountResolver when not provided', () => {
        const params = {
            tokenId: '0.0.4444',
            serialNumbers: [10],
        };

        const res = HederaParameterNormaliser.normaliseDeleteNftAllowance(
            params as any,
            mockContext,
            mockClient,
        );

        expect(AccountResolver.resolveAccount).toHaveBeenCalledWith(undefined, mockContext, mockClient);

        expect(res.nftWipes.length).toBe(1);
        expect(res.nftWipes[0].tokenId.toString()).toBe(TokenId.fromString('0.0.4444').toString());
        expect(res.nftWipes[0].serial.toNumber()).toBe(10);
        expect(res.ownerAccountId.toString()).toBe(operatorId);
    });

    it('throws when serialNumbers is empty', () => {
        const params = {
            ownerAccountId: '0.0.1111',
            tokenId: '0.0.7777',
            serialNumbers: [],
        };

        expect(() =>
            HederaParameterNormaliser.normaliseDeleteNftAllowance(params as any, mockContext, mockClient),
        ).toThrowError(/serialNumbers/i);
    });

    it('throws when serialNumbers is not provided', () => {
        const params = {
            ownerAccountId: '0.0.1111',
            tokenId: '0.0.7777',
        };

        expect(() =>
            HederaParameterNormaliser.normaliseDeleteNftAllowance(params as any, mockContext, mockClient),
        ).toThrowError();
    });

    it('correctly converts multiple serial numbers to NftId array', () => {
        const params = {
            ownerAccountId: '0.0.2222',
            tokenId: '0.0.8888',
            serialNumbers: [5, 10, 15],
        };

        const res = HederaParameterNormaliser.normaliseDeleteNftAllowance(
            params as any,
            mockContext,
            mockClient,
        );

        expect(res.nftWipes.length).toBe(3);
        expect(res.nftWipes[0].serial.toNumber()).toBe(5);
        expect(res.nftWipes[1].serial.toNumber()).toBe(10);
        expect(res.nftWipes[2].serial.toNumber()).toBe(15);

        // All should have the same tokenId
        res.nftWipes.forEach((nftId) => {
            expect(nftId.tokenId.toString()).toBe(TokenId.fromString('0.0.8888').toString());
        });
    });
});
