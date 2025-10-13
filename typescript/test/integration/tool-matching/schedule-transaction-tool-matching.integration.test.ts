import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from 'vitest';
import { AgentExecutor } from 'langchain/agents';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPluginToolNames } from '@/plugins';

describe('Schedule transaction params extraction test', () => {
  let testSetup: LangchainTestSetup;
  let agentExecutor: AgentExecutor;
  let toolkit: HederaLangchainToolkit;
  const { MINT_NON_FUNGIBLE_TOKEN_TOOL } = coreTokenPluginToolNames;

  beforeAll(async () => {
    testSetup = await createLangchainTestSetup();
    agentExecutor = testSetup.agentExecutor;
    toolkit = testSetup.toolkit;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  afterAll(async () => {
    if (testSetup) {
      testSetup.cleanup();
    }
  });

  describe('Tool Matching and Parameter Extraction', () => {
    it('should extract basic scheduling parameters with expiration and waitForExpiry', async () => {
      const input =
        'Schedule Mint 0.0.5005 with metadata: ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json. Make it expire tomorrow and wait for its expiration time with executing it.';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.5005',
          uris: [
            'ipfs://bafyreiao6ajgsfji6qsgbqwdtjdu5gmul7tv2v3pd6kjgcw5o65b2ogst4/metadata.json',
          ],
          schedulingParams: expect.objectContaining({
            adminKey: false,
            isScheduled: true,
            expirationTime: expect.any(String),
            waitForExpiry: true,
          }),
        }),
      );
    });

    it('should extract minimal scheduling parameters (only isScheduled)', async () => {
      const input =
        'Schedule a mint for token 0.0.5005 with metadata https://example.com/nft/1.json';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.5005',
          uris: ['https://example.com/nft/1.json'],
          schedulingParams: expect.objectContaining({
            isScheduled: true,
          }),
        }),
      );
    });

    it('should extract adminKey: true when requesting operator key as admin', async () => {
      const input =
        'Schedule mint for token 0.0.5005 with URI ipfs://QmTest123 and use my operator key as admin key';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.5005',
          uris: ['ipfs://QmTest123'],
          schedulingParams: expect.objectContaining({
            isScheduled: true,
            adminKey: true,
          }),
        }),
      );
    });

    it('should extract specific admin key when provided', async () => {
      const adminKey =
        '302a300506032b6570032100e0c8ec2758a5879ffac226a13c0c516b799e72e35141a0dd828f94d37988a4b7';
      const input = `Schedule mint NFT 0.0.5005 with metadata https://example.com/nft.json and set admin key to ${adminKey}`;

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.5005',
          uris: ['https://example.com/nft.json'],
          schedulingParams: expect.objectContaining({
            isScheduled: true,
            adminKey: adminKey,
          }),
        }),
      );
    });

    it('should extract adminKey: false when explicitly requesting no admin key', async () => {
      const input =
        'Schedule mint for token 0.0.5005 with URI https://example.com/metadata.json without admin key';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.5005',
          uris: ['https://example.com/metadata.json'],
          schedulingParams: expect.objectContaining({
            isScheduled: true,
            adminKey: false,
          }),
        }),
      );
    });

    it('should extract custom payer account ID', async () => {
      const input =
        'Schedule mint NFT for token 0.0.5005 with metadata ipfs://QmTest456 and let account 0.0.1234 pay for it';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.5005',
          uris: ['ipfs://QmTest456'],
          schedulingParams: expect.objectContaining({
            isScheduled: true,
            payerAccountId: '0.0.1234',
          }),
        }),
      );
    });

    it('should extract waitForExpiry: true from natural language', async () => {
      const input =
        'Schedule mint token 0.0.5005 with metadata ipfs://QmWaitTest and execute it at expiration time regardless of signatures';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.5005',
          uris: ['ipfs://QmWaitTest'],
          schedulingParams: expect.objectContaining({
            isScheduled: true,
            waitForExpiry: true,
          }),
        }),
      );
    });

    it('should extract waitForExpiry: false when requesting immediate execution', async () => {
      const input =
        'Schedule mint for token 0.0.5005 with URI https://example.com/meta.json and execute as soon as all signatures are collected';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.5005',
          uris: ['https://example.com/meta.json'],
          schedulingParams: expect.objectContaining({
            isScheduled: true,
            waitForExpiry: false,
          }),
        }),
      );
    });

    it('should extract multiple metadata URIs with scheduling', async () => {
      const input =
        'Schedule mint for token 0.0.5005 with metadata URIs: ipfs://QmFirst, ipfs://QmSecond, ipfs://QmThird';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      expect(spy).toHaveBeenCalledWith(
        MINT_NON_FUNGIBLE_TOKEN_TOOL,
        expect.objectContaining({
          tokenId: '0.0.5005',
          uris: ['ipfs://QmFirst', 'ipfs://QmSecond', 'ipfs://QmThird'],
          schedulingParams: expect.objectContaining({
            isScheduled: true,
          }),
        }),
      );
    });

    it('should NOT include scheduling parameters for non-scheduled mint', async () => {
      const input = 'Mint NFT for token 0.0.5005 with metadata https://example.com/nft.json';

      const hederaAPI = toolkit.getHederaAgentKitAPI();
      const spy = vi.spyOn(hederaAPI, 'run').mockResolvedValue('');

      await agentExecutor.invoke({ input });

      expect(spy).toHaveBeenCalledOnce();
      const callArgs = spy.mock.calls[0][1] as any;

      expect(callArgs).toMatchObject({
        tokenId: '0.0.5005',
        uris: ['https://example.com/nft.json'],
      });

      // Verify schedulingParams is either undefined or has isScheduled: false
      if (callArgs.schedulingParams) {
        expect(callArgs.schedulingParams.isScheduled).toBe(false);
      }
    });
  });
});
