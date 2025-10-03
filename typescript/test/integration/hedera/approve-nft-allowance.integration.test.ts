import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  AccountId,
  Client,
  Key,
  PrivateKey,
  PublicKey,
  TokenId,
  TokenMintTransaction,
  TokenSupplyType,
  TokenType,
} from '@hashgraph/sdk';
import approveNftAllowanceTool from '@/plugins/core-token-plugin/tools/non-fungible-token/approve-non-fungible-token-allowance';
import { AgentMode, Context } from '@/shared/configuration';
import { getCustomClient, getOperatorClientForTests, HederaOperationsWrapper } from '../../utils';
import { z } from 'zod';
import { approveNftAllowanceParameters } from '@/shared/parameter-schemas/token.zod';
import { wait } from '../../utils/general-util';
import { MIRROR_NODE_WAITING_TIME } from '../../utils/test-constants';
import { returnHbarsAndDeleteAccount } from '../../utils/teardown/account-teardown';

/**
 * Integration tests for Approve NFT Allowance tool
 *
 * - Transaction succeeds with SUCCESS status and includes a transaction ID
 * - Works with an explicit owner and memo
 * - Works when ownerAccountId is omitted (defaults to context operator)
 * - Approves multiple NFT serial numbers at once
 */

describe('Approve NFT Allowance Integration Tests', () => {
  let operatorClient: Client;
  let executorClient: Client;
  let context: Context;
  let spenderAccountId: AccountId;
  let operatorWrapper: HederaOperationsWrapper;
  let executorWrapper: HederaOperationsWrapper;

  // NFT setup
  let nftTokenId: string;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // Create an executor account that will be the NFT treasury/owner
    const executorKeyPair = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({
        initialBalance: 35, // cover fees for token creation/minting/approvals
        key: executorKeyPair.publicKey,
      })
      .then(resp => resp.accountId!);

    executorClient = getCustomClient(executorAccountId, executorKeyPair);
    executorWrapper = new HederaOperationsWrapper(executorClient);

    // Create a spender account using the executor's public key, so the executor can sign association if needed
    spenderAccountId = await executorWrapper
      .createAccount({ initialBalance: 20, key: executorClient.operatorPublicKey as Key })
      .then(resp => resp.accountId!);

    context = {
      mode: AgentMode.AUTONOMOUS,
      accountId: executorAccountId.toString(),
    };

    // Create an NFT token with executor as treasury and supply/admin keys
    const createNftResp = await executorWrapper.createNonFungibleToken({
      tokenName: 'AK-NFT',
      tokenSymbol: 'AKN',
      tokenMemo: 'Approve allowance integration',
      tokenType: TokenType.NonFungibleUnique,
      supplyType: TokenSupplyType.Finite,
      maxSupply: 100,
      adminKey: executorClient.operatorPublicKey! as PublicKey,
      supplyKey: executorClient.operatorPublicKey! as PublicKey,
      treasuryAccountId: executorAccountId.toString(),
      autoRenewAccountId: executorAccountId.toString(),
    });
    nftTokenId = createNftResp.tokenId!.toString();

    // Mint a few NFTs so we have serial numbers to approve (use SDK directly, not another tool)
    const mintTx = new TokenMintTransaction()
      .setTokenId(TokenId.fromString(nftTokenId))
      .setMetadata([
        Buffer.from('ipfs://meta-a.json'),
        Buffer.from('ipfs://meta-b.json'),
        Buffer.from('ipfs://meta-c.json'),
      ]);
    const mintResp = await mintTx.execute(executorClient);
    await mintResp.getReceipt(executorClient);

    // Give mirror node a moment where needed in case subsequent queries happen
    await wait(MIRROR_NODE_WAITING_TIME);

    // Associate spender with the NFT token to ensure they can receive transfers later if needed
    await executorWrapper.associateToken({
      accountId: spenderAccountId.toString(),
      tokenId: nftTokenId,
    });
  });

  afterAll(async () => {
    if (executorClient) {
      try {
        // Best-effort cleanup: return HBARs from spender and executor back to operator and delete if possible
        await returnHbarsAndDeleteAccount(
          executorWrapper,
          spenderAccountId,
          operatorClient.operatorAccountId!,
        );
        await returnHbarsAndDeleteAccount(
          executorWrapper,
          executorClient.operatorAccountId!,
          operatorClient.operatorAccountId!,
        );
      } catch (error) {
        console.warn('Failed cleanup (accounts might still hold NFTs or tokens):', error);
      }
      executorClient.close();
    }
    if (operatorClient) {
      operatorClient.close();
    }
  });

  it('approves NFT allowance with explicit owner and memo for a single serial', async () => {
    const params: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
      ownerAccountId: context.accountId!,
      spenderAccountId: spenderAccountId.toString(),
      tokenId: nftTokenId,
      serialNumbers: [1],
      transactionMemo: 'Approve NFT allowance (single) integration test',
    };

    const tool = approveNftAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('NFT allowance approved successfully');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });

  it('approves NFT allowance using default owner (from context) for multiple serials', async () => {
    const params: z.infer<ReturnType<typeof approveNftAllowanceParameters>> = {
      spenderAccountId: spenderAccountId.toString(),
      tokenId: nftTokenId,
      serialNumbers: [2, 3],
    };

    const tool = approveNftAllowanceTool(context);
    const result = await tool.execute(executorClient, context, params);

    expect(result.humanMessage).toContain('NFT allowance approved successfully');
    expect(result.humanMessage).toContain('Transaction ID:');
    expect(result.raw.status).toBe('SUCCESS');
    expect(result.raw.transactionId).toBeDefined();
  });
});
