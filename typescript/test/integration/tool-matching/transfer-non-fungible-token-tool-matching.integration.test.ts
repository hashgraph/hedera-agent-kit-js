import { ReactAgent } from 'langchain';
import { HederaLangchainToolkit } from '@/langchain';
import { createLangchainTestSetup, type LangchainTestSetup } from '../../utils';
import { coreTokenPluginToolNames } from '@/plugins';
import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest';

describe('Transfer NFT Tool Matching Integration', () => {
    let setup: LangchainTestSetup;
    let agent: ReactAgent;
    let toolkit: HederaLangchainToolkit;
    const { TRANSFER_NON_FUNGIBLE_TOKEN_TOOL } = coreTokenPluginToolNames;

    beforeAll(async () => {
        setup = await createLangchainTestSetup();
        agent = setup.agent;
        toolkit = setup.toolkit;
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });
    afterAll(async () => setup?.cleanup());

    it('matches tool for simple NFT transfer', async () => {
        const input = 'Transfer NFT 0.0.2001 serial 5 to 0.0.3003';
        const hederaAPI = toolkit.getHederaAgentKitAPI();
        const spy = vi
            .spyOn(hederaAPI, 'run')
            .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

        await agent.invoke({
            messages: [{ role: 'user', content: input }],
        });

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
            TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
            expect.objectContaining({
                tokenId: '0.0.2001',
                recipients: [expect.objectContaining({ recipientId: '0.0.3003', serialNumber: 5 })],
            }),
        );
    });

    it('should support multiple serial transfers in one command', async () => {
        const input = 'Send NFT 0.0.2001 serial 1 to 0.0.3003 and serial 2 to 0.0.4004';
        const hederaAPI = toolkit.getHederaAgentKitAPI();
        const spy = vi
            .spyOn(hederaAPI, 'run')
            .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');
        await agent.invoke({
            messages: [{ role: 'user', content: input }],
        });

        expect(spy).toHaveBeenCalledWith(
            TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
            expect.objectContaining({
                recipients: expect.arrayContaining([
                    expect.objectContaining({ recipientId: '0.0.3003', serialNumber: 1 }),
                    expect.objectContaining({ recipientId: '0.0.4004', serialNumber: 2 }),
                ]),
            }),
        );
    });

    it('matches tool for transfer with memo', async () => {
        const input = 'Transfer my NFT 0.0.5000 serial 10 to account 0.0.6000 with memo "gift"';
        const hederaAPI = toolkit.getHederaAgentKitAPI();
        const spy = vi
            .spyOn(hederaAPI, 'run')
            .mockResolvedValue('Operation Mocked - this is a test call and can be ended here');

        await agent.invoke({
            messages: [{ role: 'user', content: input }],
        });

        expect(spy).toHaveBeenCalledOnce();
        expect(spy).toHaveBeenCalledWith(
            TRANSFER_NON_FUNGIBLE_TOKEN_TOOL,
            expect.objectContaining({
                tokenId: '0.0.5000',
                recipients: [expect.objectContaining({ recipientId: '0.0.6000', serialNumber: 10 })],
                transactionMemo: expect.stringContaining('gift'),
            }),
        );
    });
});
