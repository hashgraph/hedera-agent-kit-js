import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import {
  createLangchainTestSetup,
  HederaOperationsWrapper,
  type LangchainTestSetup,
  getOperatorClientForTests,
  getCustomClient,
} from '../utils';
import { Client, PrivateKey } from '@hashgraph/sdk';
import { extractObservationFromLangchainResponse, wait } from '../utils/general-util';

function extractTokenId(observation: any): string {
  if (!observation.raw?.tokenId) {
    throw new Error('No raw.tokenId found in observation');
  }

  // raw.tokenId may be string via toString or object; normalize
  const tokenId = observation.raw.tokenId;
  if (typeof tokenId === 'string') return tokenId;
  if (tokenId.shard && tokenId.realm && tokenId.num) {
    const { shard, realm, num } = tokenId;
    return `${shard.low}.${realm.low}.${num.low}`;
  }
  if (tokenId.toString) return tokenId.toString();
  throw new Error('Unable to parse tokenId');
}

describe('Create Non-Fungible Token E2E Tests', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let executorClient: Client;
  let operatorClient: Client;
  let executorWrapper: HederaOperationsWrapper;

  beforeAll(async () => {
    operatorClient = getOperatorClientForTests();
    const operatorWrapper = new HederaOperationsWrapper(operatorClient);

    // 1. Create executor account (funded by operator)
    const executorAccountKey = PrivateKey.generateED25519();
    const executorAccountId = await operatorWrapper
      .createAccount({ key: executorAccountKey.publicKey, initialBalance: 10 })
      .then(resp => resp.accountId!);

    // 2. Build executor client
    executorClient = getCustomClient(executorAccountId, executorAccountKey);

    // 3. Start LangChain test setup with executor account
    testSetup = await createLangchainTestSetup(undefined, undefined, executorClient);
    agentExecutor = testSetup.agentExecutor;
    executorWrapper = new HederaOperationsWrapper(executorClient);

    await wait(4000);
  });

  afterAll(async () => {
    if (testSetup && operatorClient) {
      testSetup.cleanup();
      operatorClient.close();
    }
  });

  it('creates an NFT with minimal params via natural language', async () => {
    const input = `Create a non-fungible token named MyNFT with symbol MNFT`;

    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);
    const tokenId = extractTokenId(observation);

    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain('Token created successfully');
    expect(observation.raw.tokenId).toBeDefined();

    await wait(4000);

    // Verify on-chain
    const tokenInfo = await executorWrapper.getTokenInfo(tokenId);
    expect(tokenInfo.name).toBe('MyNFT');
    expect(tokenInfo.symbol).toBe('MNFT');
    expect(tokenInfo.tokenType.toString()).toBe('NON_FUNGIBLE_UNIQUE');
    expect(tokenInfo.maxSupply?.toInt()).toBe(100); // default maxSupply
  });

  it('creates an NFT with custom max supply', async () => {
    const input = 'Create a non-fungible token ArtCollection with symbol ART and max supply 500';

    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);
    const tokenId = extractTokenId(observation);

    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain('Token created successfully');
    expect(observation.raw.tokenId).toBeDefined();

    await wait(4000);

    const tokenInfo = await executorWrapper.getTokenInfo(tokenId);
    expect(tokenInfo.name).toBe('ArtCollection');
    expect(tokenInfo.symbol).toBe('ART');
    expect(tokenInfo.tokenType.toString()).toBe('NON_FUNGIBLE_UNIQUE');
    expect(tokenInfo.maxSupply?.toInt()).toBe(500);
  });

  it('creates an NFT with treasury account specification', async () => {
    const treasuryAccountId = executorClient.operatorAccountId!.toString();
    const input = `Create a non-fungible token GameItems with symbol GAME, treasury account ${treasuryAccountId}, and max supply 1000`;

    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);
    const tokenId = extractTokenId(observation);

    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain('Token created successfully');
    expect(observation.raw.tokenId).toBeDefined();

    await wait(4000);

    const tokenInfo = await executorWrapper.getTokenInfo(tokenId);
    expect(tokenInfo.name).toBe('GameItems');
    expect(tokenInfo.symbol).toBe('GAME');
    expect(tokenInfo.treasuryAccountId?.toString()).toBe(treasuryAccountId);
    expect(tokenInfo.maxSupply?.toInt()).toBe(1000);
  });

  it('handles invalid requests gracefully', async () => {
    const input = 'Create a non-fungible token without providing required parameters';

    const result = await agentExecutor.invoke({ input });
    const observation = extractObservationFromLangchainResponse(result);

    expect(observation).toBeDefined();
    expect(observation.humanMessage).toContain('error');
    expect(observation.raw.error).toBeDefined();
  });
});
