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
import { approveNftAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import { deleteNftAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import {
    createLangchainTestSetup,
    getCustomClient,
    getOperatorClientForTests,
    HederaOperationsWrapper,
    type LangchainTestSetup,
} from '../utils';
import { wait } from '../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../utils/test-constants';
import { z } from 'zod';
import { returnHbarsAndDeleteAccount } from '../utils/teardown/account-teardown';
import { itWithRetry } from '../utils/retry-util';
import { UsdToHbarService } from '../utils/usd-to-hbar-service';
import { BALANCE_TIERS } from '../utils/setup/langchain-test-config';

/**
 * E2E test: Create an HTS NFT, approve NFT allowance for a spender, delete the allowance,
 * and verify the spender can no longer transfer the NFT.
 */

describe('Delete NFT Allowance E2E', () => {
    let testSetup: LangchainTestSetup;

    let operatorClient: Client;
    let operatorWrapper: HederaOperationsWrapper;

    let ownerClient: Client; // owner/treasury/executor
    let ownerWrapper: HederaOperationsWrapper;
    let ownerAccountId: AccountId;

    let spenderAccount: AccountId; // Account A (spender)
    let spenderKey: PrivateKey;
    let spenderClient: Client;
    let spenderWrapper: HederaOperationsWrapper;

    let nftTokenId: string;
    const serialToUse = 1; // we'll mint at least one NFT and use serial 1

    let recipientAccount: AccountId; // separate recipient to receive NFT
    let recipientClient: Client;
    let recipientWrapper: HederaOperationsWrapper;

    beforeAll(async () => {
        // 1) Operator funds accounts
        operatorClient = getOperatorClientForTests();
        operatorWrapper = new HederaOperationsWrapper(operatorClient);

        // 2) Create owner (executor) account and client
        const ownerKey = PrivateKey.generateED25519();
        ownerAccountId = await operatorWrapper
            .createAccount({
                key: ownerKey.publicKey,
                initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
            })
            .then((resp) => resp.accountId!);

        ownerClient = getCustomClient(ownerAccountId, ownerKey);
        ownerWrapper = new HederaOperationsWrapper(ownerClient);

        // 3) Create a spender account with its own key and client
        spenderKey = PrivateKey.generateED25519();
        spenderAccount = await operatorWrapper
            .createAccount({
                key: spenderKey.publicKey as Key,
                initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
            })
            .then((resp) => resp.accountId!);

        spenderClient = getCustomClient(spenderAccount, spenderKey);
        spenderWrapper = new HederaOperationsWrapper(spenderClient);

        // 3b) Create a separate recipient account
        const recipientKey = PrivateKey.generateED25519();
        recipientAccount = await operatorWrapper
            .createAccount({
                key: recipientKey.publicKey as Key,
                initialBalance: UsdToHbarService.usdToHbar(BALANCE_TIERS.STANDARD),
            })
            .then((resp) => resp.accountId!);
        recipientClient = getCustomClient(recipientAccount, recipientKey);
        recipientWrapper = new HederaOperationsWrapper(recipientClient);

        // 4) Start LangChain test setup with the owner client
        testSetup = await createLangchainTestSetup(undefined, undefined, ownerClient);

        // 5) Create an HTS NFT with an owner as treasury/admin/supply keys
        const createResp = await ownerWrapper.createNonFungibleToken({
            tokenName: 'AK-NFT-DELETE-E2E',
            tokenSymbol: 'AKNDE',
            tokenMemo: 'Delete NFT allowance E2E',
            tokenType: TokenType.NonFungibleUnique,
            supplyType: TokenSupplyType.Finite,
            maxSupply: 10,
            adminKey: ownerClient.operatorPublicKey! as PublicKey,
            supplyKey: ownerClient.operatorPublicKey! as PublicKey,
            treasuryAccountId: ownerClient.operatorAccountId!.toString(),
            autoRenewAccountId: ownerClient.operatorAccountId!.toString(),
        });
        nftTokenId = createResp.tokenId!.toString();

        // 6) Mint 2 serials for the NFT
        const mintTx = new TokenMintTransaction()
            .setTokenId(TokenId.fromString(nftTokenId))
            .setMetadata([Buffer.from('ipfs://meta-1.json'), Buffer.from('ipfs://meta-2.json')]);
        const mintResp = await mintTx.execute(ownerClient);
        await mintResp.getReceipt(ownerClient);

        // 7) Associate spender and recipient with the NFT token
        await spenderWrapper.associateToken({
            accountId: spenderAccount.toString(),
            tokenId: nftTokenId,
        });
        await recipientWrapper.associateToken({
            accountId: recipientAccount.toString(),
            tokenId: nftTokenId,
        });

        await wait(MIRROR_NODE_WAITING_TIME);
    }, 180_000);

    afterAll(async () => {
        try {
            if (recipientWrapper) {
                await returnHbarsAndDeleteAccount(
                    recipientWrapper,
                    recipientAccount,
                    operatorClient.operatorAccountId!,
                );
            }
            if (spenderWrapper) {
                await returnHbarsAndDeleteAccount(
                    spenderWrapper,
                    spenderAccount,
                    operatorClient.operatorAccountId!,
                );
            }
            if (ownerWrapper) {
                await returnHbarsAndDeleteAccount(
                    ownerWrapper,
                    ownerAccountId,
                    operatorClient.operatorAccountId!,
                );
            }
        } finally {
            testSetup?.cleanup();
            operatorClient?.close();
            ownerClient?.close();
            spenderClient?.close();
            recipientClient?.close();
        }
    });

    it(
        'should delete specific serial NFT allowance and prevent spender from transferring',
        itWithRetry(async () => {
            // 1) Approve NFT allowance for serial 1
            const approveTool = approveNftAllowanceTool({});
            const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
                ownerAccountId: ownerClient.operatorAccountId!.toString(),
                spenderAccountId: spenderAccount.toString(),
                tokenId: nftTokenId,
                serialNumbers: [serialToUse],
                transactionMemo: 'E2E approve NFT allowance for delete test',
            };
            const approveResult = await approveTool.execute(ownerClient, {}, approveParams);
            expect(approveResult.raw.status).toBe('SUCCESS');

            await wait(MIRROR_NODE_WAITING_TIME);

            // 2) Delete NFT allowance for serial 1
            const deleteTool = deleteNftAllowanceTool({});
            const deleteParams: z.infer<ReturnType<typeof deleteNftAllowanceParameters>> = {
                ownerAccountId: ownerClient.operatorAccountId!.toString(),
                tokenId: nftTokenId,
                serialNumbers: [serialToUse],
                transactionMemo: 'E2E delete NFT allowance',
            };
            const deleteResult = await deleteTool.execute(ownerClient, {}, deleteParams);
            expect(deleteResult.raw.status).toBe('SUCCESS');

            await wait(MIRROR_NODE_WAITING_TIME);

            // 3) Verify spender can no longer transfer the NFT
            const nft = new NftId(TokenId.fromString(nftTokenId), serialToUse);
            const tx = new TransferTransaction().addApprovedNftTransfer(
                nft,
                AccountId.fromString(ownerClient.operatorAccountId!.toString()),
                AccountId.fromString(recipientAccount.toString()),
            );

            // Expect the transfer to fail because allowance was deleted
            await expect(async () => {
                const exec = await tx.execute(spenderClient);
                await exec.getReceipt(spenderClient);
            }).rejects.toThrow(/SPENDER_DOES_NOT_HAVE_ALLOWANCE|INVALID_ALLOWANCE_OWNER_ID/);
        }),
        180_000,
    );

    it(
        'should delete multiple serial NFT allowances',
        itWithRetry(async () => {
            const serialsToUse = [1, 2];

            // 1) Approve NFT allowances for serials 1 and 2
            const approveTool = approveNftAllowanceTool({});
            const approveParams: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
                ownerAccountId: ownerClient.operatorAccountId!.toString(),
                spenderAccountId: spenderAccount.toString(),
                tokenId: nftTokenId,
                serialNumbers: serialsToUse,
                transactionMemo: 'E2E approve multiple NFT allowances',
            };
            const approveResult = await approveTool.execute(ownerClient, {}, approveParams);
            expect(approveResult.raw.status).toBe('SUCCESS');

            await wait(MIRROR_NODE_WAITING_TIME);

            // 2) Delete NFT allowances for serials 1 and 2
            const deleteTool = deleteNftAllowanceTool({});
            const deleteParams: z.infer<ReturnType<typeof deleteNftAllowanceParameters>> = {
                ownerAccountId: ownerClient.operatorAccountId!.toString(),
                tokenId: nftTokenId,
                serialNumbers: serialsToUse,
                transactionMemo: 'E2E delete multiple NFT allowances',
            };
            const deleteResult = await deleteTool.execute(ownerClient, {}, deleteParams);
            expect(deleteResult.raw.status).toBe('SUCCESS');

            await wait(MIRROR_NODE_WAITING_TIME);

            // 3) Verify spender can no longer transfer serial 1
            const nft1 = new NftId(TokenId.fromString(nftTokenId), 1);
            const tx1 = new TransferTransaction().addApprovedNftTransfer(
                nft1,
                AccountId.fromString(ownerClient.operatorAccountId!.toString()),
                AccountId.fromString(recipientAccount.toString()),
            );

            await expect(async () => {
                const exec = await tx1.execute(spenderClient);
                await exec.getReceipt(spenderClient);
            }).rejects.toThrow(/SPENDER_DOES_NOT_HAVE_ALLOWANCE|INVALID_ALLOWANCE_OWNER_ID/);
        }),
        180_000,
    );
});
