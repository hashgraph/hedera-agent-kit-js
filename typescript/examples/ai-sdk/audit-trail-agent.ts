import {
    AgentMode,
    coreAccountPluginToolNames,
    coreTokenPluginToolNames,
    HcsAuditTrailHook,
    HederaAIToolkit,
} from 'hedera-agent-kit';
import { Client, PrivateKey } from '@hashgraph/sdk';
import prompts from 'prompts';
import * as dotenv from 'dotenv';
import { openai } from '@ai-sdk/openai';
import { generateText, stepCountIs, wrapLanguageModel } from 'ai';

dotenv.config();

async function bootstrap(): Promise<void> {
    const operatorId = process.env.ACCOUNT_ID!;
    const operatorKey = process.env.PRIVATE_KEY!;

    const client = Client.forTestnet().setOperator(
        operatorId,
        PrivateKey.fromStringECDSA(operatorKey),
        // PrivateKey.fromStringED25519(operatorKey), // Use this line if you have an ED25519 key
    );

    // Initialize the audit trail hook
    const auditHook = new HcsAuditTrailHook(
        [
            coreAccountPluginToolNames.TRANSFER_HBAR_TOOL,
            coreTokenPluginToolNames.CREATE_FUNGIBLE_TOKEN_TOOL,
        ],
        '0.0.????', // Replace with your actual topic ID
    );

    const hederaAgentToolkit = new HederaAIToolkit({
        client,
        configuration: {
            plugins: [], // Load all plugins
            context: {
                mode: AgentMode.AUTONOMOUS,
                accountId: operatorId,
                hooks: [auditHook],
            },
        },
    });

    const model = wrapLanguageModel({
        model: openai('gpt-4o'),
        middleware: hederaAgentToolkit.middleware(),
    });

    console.log(
        'Hedera Agent CLI Chatbot with HcsAuditTrailHook Plugin Support — type "exit" to quit',
    );
    console.log('This agent has an audit hook on TRANSFER_HBAR_TOOL and CREATE_FUNGIBLE_TOKEN_TOOL.');
    console.log('IMPORTANT: This agent works only in mode: AgentMode.AUTONOMOUS');
    console.log('');

    // Chat memory: conversation history
    const conversationHistory: { role: 'user' | 'assistant'; content: string }[] = [];

    while (true) {
        const { userInput } = await prompts({
            type: 'text',
            name: 'userInput',
            message: 'You',
        });

        if (!userInput || ['exit', 'quit'].includes(userInput.trim().toLowerCase())) {
            console.log('Goodbye!');
            break;
        }

        // Add a user message to the history
        conversationHistory.push({ role: 'user', content: userInput });

        try {
            const response = await generateText({
                model,
                messages: conversationHistory,
                tools: hederaAgentToolkit.getTools(),
                stopWhen: stepCountIs(2),
            });

            // Add AI response to history
            conversationHistory.push({ role: 'assistant', content: response.text });

            // Print the AI's answer
            console.log(`AI: ${response.text}`);
        } catch (err) {
            console.error('Error:', err);
        }
    }
}

bootstrap()
    .catch(err => {
        console.error('Fatal error during CLI bootstrap:', err);
        process.exit(1);
    })
    .then(() => {
        process.exit(0);
    });
