import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    AccountId,
    Client,
    PrivateKey,
    PublicKey,
    TokenType,
    TokenSupplyType,
} from '@hashgraph/sdk';
import { AgentMode, Context } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import transferNonFungibleToken from '@/plugins/core-token-plugin/tools/non-fungible-token/transfer-non-fungible-token';
import { mintNonFungibleTokenParametersNormalised } from '@/shared/parameter-schemas/token.zod';
import { z } from 'zod';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';
import { wait } from '../../utils/general-util';
import { UsdToHbarService } from '../../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../../utils/setup/langchain-test-config';

describe('Transfer NFT Integration Tests', () => {
    let operatorClient: Client;
    let ownerClient: Client;
    let recipientClient: Client;
    let ownerWrapper: HederaOperationsWrapper;
    let operatorWrapper: HederaOperationsWrapper;
    let recipientWrapper: HederaOperationsWrapper;
    let ownerAccountId: AccountId;
    let recipientAccountId: AccountId;
    let nftTokenId: string;
    let context: Context;

    beforeAll(async () => {
        operatorClient = getOperatorClientForTests();
        operatorWrapper = new HederaOperationsWrapper(operatorClient);

        // Create an owner (treasury) account
        const ownerKey = PrivateKey.generateED25519();
        ownerAccountId = await operatorWrapper
            .createAccount({ initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.ELEVATED), key: ownerKey.publicKey })
            .then(resp => resp.accountId!);
        ownerClient = getCustomClient(ownerAccountId, ownerKey);
        ownerWrapper = new HederaOperationsWrapper(ownerClient);

        // Create a recipient account
        const recipientKey = PrivateKey.generateECDSA();
        recipientAccountId = await operatorWrapper
            .createAccount({ initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD), key: recipientKey.publicKey })
            .then(resp => resp.accountId!);
        recipientClient = getCustomClient(recipientAccountId, recipientKey);
        recipientWrapper = new HederaOperationsWrapper(recipientClient);

        // Context for tool execution (owner executes)
        context = {
            mode: AgentMode.AUTONOMOUS,
            accountId: ownerAccountId.toString(),
        };

        // Create NFT token
        const tokenCreate = await ownerWrapper.createNonFungibleToken({
            tokenName: 'TestNFT',
            tokenSymbol: 'TNFT',
            tokenMemo: 'Transfer integration test',
            tokenType: TokenType.NonFungibleUnique,
            supplyType: TokenSupplyType.Finite,
            maxSupply: 10,
            treasuryAccountId: ownerAccountId.toString(),
            adminKey: ownerClient.operatorPublicKey! as PublicKey,
            supplyKey: ownerClient.operatorPublicKey! as PublicKey,
            autoRenewAccountId: ownerAccountId.toString(),
        });
        nftTokenId = tokenCreate.tokenId!.toString();

        // Mint NFTs via the mintNft method
        const mintParams: z.infer<ReturnType<typeof mintNonFungibleTokenParametersNormalised>> = {
            tokenId: nftTokenId,
            metadata: [
                new TextEncoder().encode('ipfs://meta-1.json'),
                new TextEncoder().encode('ipfs://meta-2.json'),
            ],
        };

        await ownerWrapper.mintNft(mintParams);

        // Associate recipient with token
        await recipientWrapper.associateToken({
            accountId: recipientAccountId.toString(),
            tokenId: nftTokenId,
        });
    });

    afterAll(async () => {
        try {
            // Cleanup accounts and HBARs
            await returnHbarsAndDeleteAccount(
                ownerWrapper,
                recipientAccountId,
                operatorClient.operatorAccountId!,
            );
            await returnHbarsAndDeleteAccount(
                ownerWrapper,
                ownerAccountId,
                operatorClient.operatorAccountId!,
            );
        } catch (err) {
            console.warn('Cleanup failed:', err);
        }
        ownerClient?.close();
        recipientClient?.close();
        operatorClient?.close();
    });

    it('should transfer NFT from owner to recipient', async () => {
        const params = {
            tokenId: nftTokenId,
            recipients: [{ recipientId: recipientAccountId.toString(), serialNumber: 1 }],
            transactionMemo: 'NFT transfer test',
        };

        const tool = transferNonFungibleToken(context);
        const result = await tool.execute(ownerClient, context, params);

        expect(result.raw.status).toBe('SUCCESS');
        expect(result.humanMessage).toContain(
            'Non-fungible tokens successfully transferred. Transaction ID:',
        );

        await wait(MIRROR_NODE_WAITING_TIME);
        const recipientNfts = await recipientWrapper.getAccountNfts(recipientAccountId.toString());
        expect(
            recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 1),
        ).toBeTruthy();
    });

    it('should transfer multiple NFTs to the same recipient', async () => {
        const params = {
            tokenId: nftTokenId,
            recipients: [{ recipientId: recipientAccountId.toString(), serialNumber: 2 }],
            transactionMemo: 'NFT transfer second serial',
        };

        const tool = transferNonFungibleToken(context);
        const result = await tool.execute(ownerClient, context, params);

        expect(result.raw.status).toBe('SUCCESS');

        await wait(MIRROR_NODE_WAITING_TIME);
        const recipientNfts = await recipientWrapper.getAccountNfts(recipientAccountId.toString());
        expect(
            recipientNfts.nfts.find(nft => nft.token_id === nftTokenId && nft.serial_number === 2),
        ).toBeTruthy();
    });

    it('should fail when trying to transfer NFT not owned', async () => {
        // Recipient trying to transfer an NFT they don't own
        const recipientContext: Context = {
            mode: AgentMode.AUTONOMOUS,
            accountId: recipientAccountId.toString(),
        };

        const params = {
            tokenId: nftTokenId,
            recipients: [{ recipientId: ownerAccountId.toString(), serialNumber: 99 }], // non-existent serial
        };

        const tool = transferNonFungibleToken(recipientContext);
        const result = await tool.execute(recipientClient, recipientContext, params);

        expect(result.raw.status).not.toBe('SUCCESS');
        expect(result.humanMessage).toContain('Failed to transfer non-fungible token');
    });

    it('should schedule an NFT transfer', async () => {
        const params = {
            tokenId: nftTokenId,
            recipients: [{ recipientId: recipientAccountId.toString(), serialNumber: 3 }],
            transactionMemo: 'Scheduled NFT transfer test',
            schedulingParams: {
                isScheduled: true,
            },
        };

        const tool = transferNonFungibleToken(context);
        const result = await tool.execute(ownerClient, context, params);

        expect(result.raw.status).toBe('SUCCESS');
        expect(result.humanMessage).toContain(
            'Scheduled non-fungible token transfer created successfully',
        );
        expect(result.humanMessage).toContain('Schedule ID:');
    });
});
