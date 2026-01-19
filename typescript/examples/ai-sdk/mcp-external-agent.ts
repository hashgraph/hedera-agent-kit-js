import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs } from 'ai';
import * as dotenv from 'dotenv';
import prompts from 'prompts';
import { Client, PrivateKey } from '@hashgraph/sdk';
import {
    HederaAIToolkit,
    AgentMode,
    coreMiscQueriesPlugin,
} from 'hedera-agent-kit';

import { experimental_createMCPClient } from '@ai-sdk/mcp';
import { Experimental_StdioMCPTransport } from '@ai-sdk/mcp/mcp-stdio';

dotenv.config();

async function bootstrap(): Promise<void> {
    const accountId = process.env.ACCOUNT_ID;
    const privateKey = process.env.PRIVATE_KEY;

    if (!accountId || !privateKey) {
        throw new Error('Please set ACCOUNT_ID and PRIVATE_KEY in .env file');
    }

    // ---------------------------------------------------------------------------
    // HEDERA CLIENT SETUP (LOCAL)
    // ---------------------------------------------------------------------------
    const client = Client.forTestnet().setOperator(
        accountId,
        PrivateKey.fromStringDer(privateKey)
    );

    const hederaAgentToolkit = new HederaAIToolkit({
        client,
        configuration: {
            plugins: [coreMiscQueriesPlugin], // One plugin as requested
            context: {
                mode: AgentMode.AUTONOMOUS,
            },
        },
    });

    // ---------------------------------------------------------------------------
    // MCP CLIENT SETUP (STDIO)
    // ---------------------------------------------------------------------------
    const transport = new Experimental_StdioMCPTransport({
        command: 'node',
        args: [
            '/home/stanislawkurzyp/Documents/arianelabs/hedera-agent-kit-v3/modelcontextprotocol/dist/index.js',
            '--ledger-id=testnet',
        ],
        env: {
            HEDERA_OPERATOR_ID: accountId,
            HEDERA_OPERATOR_KEY: privateKey,
            ...process.env,
        },
    });

    console.log('Connecting to Hedera MCP Server...');

    const mcpClient = await experimental_createMCPClient({
        transport,
    });

    console.log('Connected to MCP Server.');

    // ---------------------------------------------------------------------------
    // LOAD TOOLS (MCP + LOCAL)
    // ---------------------------------------------------------------------------
    const mcpTools = await mcpClient.tools();
    const localTools = hederaAgentToolkit.getTools();

    const allTools = {
        ...mcpTools,
        ...localTools,
    };

    console.log(`Loaded ${Object.keys(mcpTools).length} MCP tools and ${Object.keys(localTools).length} local tools.`);

    // ---------------------------------------------------------------------------
    // CLI CHAT LOOP
    // ---------------------------------------------------------------------------
    console.log('Hedera Agent CLI Chatbot (Hybrid MCP + Native) — type "exit" to quit');

    const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];

    while (true) {
        const { userInput } = await prompts({
            type: 'text',
            name: 'userInput',
            message: 'You',
        });

        if (!userInput || ['exit', 'quit'].includes(userInput.trim().toLowerCase())) {
            console.log('Goodbye!');
            await mcpClient.close();
            break;
        }

        conversationHistory.push({ role: 'user', content: userInput });

        try {
            const response = await generateText({
                model: openai('gpt-4o'),
                system: 'You are a helpful assistant. Always summarize the result of any tool actions you take in a human-readable way.',
                messages: conversationHistory,
                tools: allTools as any,
                stopWhen: stepCountIs(2),
            });

            console.log('Response keys:', Object.keys(response));
            // console.log('Response:', JSON.stringify(response, null, 2));

            // Add AI response to history
            conversationHistory.push({ role: 'assistant', content: response.text });

            console.log(`AI: ${response.text}`);
        } catch (err) {
            console.error('Error:', err);
        }
    }
}

bootstrap().catch(err => {
    console.error('Fatal error during CLI bootstrap:', err);
    process.exit(1);
});
