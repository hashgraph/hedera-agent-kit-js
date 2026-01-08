import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
    AccountId,
    Client,
    Key,
    NftId,
    PrivateKey,
    PublicKey,
    TokenId,
    TokenMintTransaction,
    TokenSupplyType,
    TokenType,
    TransferTransaction,
} from '@hashgraph/sdk';
import approveNftAllowanceTool from '@/plugins/core-token-plugin/tools/non-fungible-token/approve-non-fungible-token-allowance';
import deleteNftAllowanceTool from '@/plugins/core-token-plugin/tools/non-fungible-token/delete-non-fungible-token-allowance';
import { AgentMode, Context } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import {
    approveNftAllowanceParameters,
    deleteNftAllowanceParameters,
} from '@/shared/parameter-schemas/token.zod';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';
import { UsdToHbarService } from '../../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../../utils/setup/langchain-test-config';

/**
 * Integration tests for Delete NFT Allowance tool
 *
 * - Transaction succeeds with SUCCESS status and includes a transaction ID
 * - Works with an explicit owner and memo
 * - Deletes allowances for multiple NFT serial numbers at once
 * - After deletion, spender cannot transfer the NFT via approved transfer
 */

describe('Delete NFT Allowance Integration Tests', () => {
    let operatorClient: Client;
    let executorClient: Client;
    let context: Context;
    let spenderAccountId: AccountId;
    let spenderKey: PrivateKey;
    let spenderClient: Client;
    let operatorWrapper: HederaOperationsWrapper;
    let executorWrapper: HederaOperationsWrapper;
    let spenderWrapper: HederaOperationsWrapper;

    // NFT setup
    let nftTokenId: string;

    // Recipient for transfer attempts
    let recipientAccountId: AccountId;
    let recipientClient: Client;
    let recipientWrapper: HederaOperationsWrapper;

    beforeAll(async () => {
        operatorClient = getOperatorClientForTests();
        operatorWrapper = new HederaOperationsWrapper(operatorClient);

        // Create an executor account that will be the NFT treasury/owner
        const executorKeyPair = PrivateKey.generateED25519();
        const executorAccountId = await operatorWrapper
            .createAccount({
                initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.ELEVATED),
                key: executorKeyPair.publicKey,
            })
            .then((resp) => resp.accountId!);

        executorClient = getCustomClient(executorAccountId, executorKeyPair);
        executorWrapper = new HederaOperationsWrapper(executorClient);

        // Create a spender account with its own key
        spenderKey = PrivateKey.generateED25519();
        spenderAccountId = await operatorWrapper
            .createAccount({
                initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
                key: spenderKey.publicKey as Key,
            })
            .then((resp) => resp.accountId!);

        spenderClient = getCustomClient(spenderAccountId, spenderKey);
        spenderWrapper = new HederaOperationsWrapper(spenderClient);

        // Create a recipient account
        const recipientKey = PrivateKey.generateED25519();
        recipientAccountId = await operatorWrapper
            .createAccount({
                initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
                key: recipientKey.publicKey as Key,
            })
            .then((resp) => resp.accountId!);

        recipientClient = getCustomClient(recipientAccountId, recipientKey);
        recipientWrapper = new HederaOperationsWrapper(recipientClient);

        context = {
            mode: AgentMode.AUTONOMOUS,
            accountId: executorAccountId.toString(),
        };

        // Create an NFT token with executor as treasury and supply/admin keys
        const createNftResp = await executorWrapper.createNonFungibleToken({
            tokenName: 'AK-NFT-DELETE',
            tokenSymbol: 'AKND',
            tokenMemo: 'Delete allowance integration',
            tokenType: TokenType.NonFungibleUnique,
            supplyType: TokenSupplyType.Finite,
            maxSupply: 100,
            adminKey: executorClient.operatorPublicKey! as PublicKey,
            supplyKey: executorClient.operatorPublicKey! as PublicKey,
            treasuryAccountId: executorAccountId.toString(),
            autoRenewAccountId: executorAccountId.toString(),
        });
        nftTokenId = createNftResp.tokenId!.toString();

        // Mint a few NFTs so we have serial numbers to work with
        const mintTx = new TokenMintTransaction()
            .setTokenId(TokenId.fromString(nftTokenId))
            .setMetadata([
                Buffer.from('ipfs://meta-a.json'),
                Buffer.from('ipfs://meta-b.json'),
                Buffer.from('ipfs://meta-c.json'),
            ]);
        const mintResp = await mintTx.execute(executorClient);
        await mintResp.getReceipt(executorClient);

        await wait(MIRROR_NODE_WAITING_TIME);

        // Associate spender and recipient with the NFT token
        await spenderWrapper.associateToken({
            accountId: spenderAccountId.toString(),
            tokenId: nftTokenId,
        });
        await recipientWrapper.associateToken({
            accountId: recipientAccountId.toString(),
            tokenId: nftTokenId,
        });
    });

    afterAll(async () => {
        try {
            // Best-effort cleanup
            if (recipientWrapper && recipientAccountId) {
                await returnHbarsAndDeleteAccount(
                    recipientWrapper,
                    recipientAccountId,
                    operatorClient.operatorAccountId!,
                );
            }
            if (spenderWrapper && spenderAccountId) {
                await returnHbarsAndDeleteAccount(
                    spenderWrapper,
                    spenderAccountId,
                    operatorClient.operatorAccountId!,
                );
            }
            if (executorWrapper && executorClient) {
                await returnHbarsAndDeleteAccount(
                    executorWrapper,
                    executorClient.operatorAccountId!,
                    operatorClient.operatorAccountId!,
                );
            }
        } catch (error) {
            console.warn('Failed cleanup (accounts might still hold NFTs or tokens):', error);
        } finally {
            executorClient?.close();
            spenderClient?.close();
            recipientClient?.close();
            operatorClient?.close();
        }
    });

    it('deletes NFT allowance with explicit owner and memo for a single serial', async () => {
        // First approve the allowance
        const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
            ownerAccountId: context.accountId!,
            spenderAccountId: spenderAccountId.toString(),
            tokenId: nftTokenId,
            serialNumbers: [1],
            transactionMemo: 'Approve for delete test',
        };

        const approveTool = approveNftAllowanceTool(context);
        const approveResult = await approveTool.execute(executorClient, context, approveParams);
        expect(approveResult.raw.status).toBe('SUCCESS');

        await wait(MIRROR_NODE_WAITING_TIME);

        // Now delete the allowance
        const deleteParams: z.infer<ReturnType<typeof deleteNftAllowanceParameters>> = {
            ownerAccountId: context.accountId!,
            tokenId: nftTokenId,
            serialNumbers: [1],
            transactionMemo: 'Delete NFT allowance (single) integration test',
        };

        const tool = deleteNftAllowanceTool(context);
        const result = await tool.execute(executorClient, context, deleteParams);

        expect(result.humanMessage).toContain('NFT allowance(s) deleted successfully');
        expect(result.humanMessage).toContain('Transaction ID:');
        expect(result.raw.status).toBe('SUCCESS');
        expect(result.raw.transactionId).toBeDefined();
    });

    it('deletes NFT allowance using default owner (from context) for multiple serials', async () => {
        // First approve the allowances
        const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
            spenderAccountId: spenderAccountId.toString(),
            tokenId: nftTokenId,
            serialNumbers: [2, 3],
        };

        const approveTool = approveNftAllowanceTool(context);
        const approveResult = await approveTool.execute(executorClient, context, approveParams);
        expect(approveResult.raw.status).toBe('SUCCESS');

        await wait(MIRROR_NODE_WAITING_TIME);

        // Now delete the allowances
        const deleteParams: z.infer<ReturnType<typeof deleteNftAllowanceParameters>> = {
            tokenId: nftTokenId,
            serialNumbers: [2, 3],
        };

        const tool = deleteNftAllowanceTool(context);
        const result = await tool.execute(executorClient, context, deleteParams);

        expect(result.humanMessage).toContain('NFT allowance(s) deleted successfully');
        expect(result.humanMessage).toContain('Transaction ID:');
        expect(result.raw.status).toBe('SUCCESS');
        expect(result.raw.transactionId).toBeDefined();
    });

    it('prevents spender from transferring NFT after allowance is deleted', async () => {
        // First approve the allowance
        const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
            ownerAccountId: context.accountId!,
            spenderAccountId: spenderAccountId.toString(),
            tokenId: nftTokenId,
            serialNumbers: [1],
        };

        const approveTool = approveNftAllowanceTool(context);
        await approveTool.execute(executorClient, context, approveParams);

        await wait(MIRROR_NODE_WAITING_TIME);

        // Delete the allowance
        const deleteParams: z.infer<ReturnType<typeof deleteNftAllowanceParameters>> = {
            ownerAccountId: context.accountId!,
            tokenId: nftTokenId,
            serialNumbers: [1],
        };

        const deleteTool = deleteNftAllowanceTool(context);
        const deleteResult = await deleteTool.execute(executorClient, context, deleteParams);
        expect(deleteResult.raw.status).toBe('SUCCESS');

        await wait(MIRROR_NODE_WAITING_TIME);

        // Attempt transfer with spender - should fail
        const nft = new NftId(TokenId.fromString(nftTokenId), 1);
        const tx = new TransferTransaction().addApprovedNftTransfer(
            nft,
            AccountId.fromString(context.accountId!),
            recipientAccountId,
        );

        await expect(async () => {
            const exec = await tx.execute(spenderClient);
            await exec.getReceipt(spenderClient);
        }).rejects.toThrow(/SPENDER_DOES_NOT_HAVE_ALLOWANCE|INVALID_ALLOWANCE_OWNER_ID/);
    });
});
