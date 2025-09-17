import { createLLMFromEnv } from '@/lib/llm';
import { createAgentBootstrap, createToolkitConfiguration, createHederaClient, type AgentBootstrap } from '@/lib/agent-config';
import { HederaLangchainToolkit } from 'hedera-agent-kit';
import { ChatPromptTemplate, MessagesPlaceholder } from '@langchain/core/prompts';
import { AgentExecutor, createToolCallingAgent } from 'langchain/agents';

export function initializeLLM() {
    try {
        return createLLMFromEnv();
    } catch (e) {
        const message = e instanceof Error ? e.message : 'Invalid AI provider configuration';
        throw new Error(message);
    }
}

export function createHederaToolkit(bootstrap?: AgentBootstrap, accountId?: string) {
    const agentBootstrap = bootstrap || createAgentBootstrap();
    const client = createHederaClient(agentBootstrap);
    const baseConfiguration = createToolkitConfiguration(agentBootstrap);
    if (accountId) {
        baseConfiguration.context = baseConfiguration.context || {};
        baseConfiguration.context.accountId = accountId;
    }

    const hederaToolkit = new HederaLangchainToolkit({ client, configuration: baseConfiguration });
    const tools = hederaToolkit.getTools();

    return { bootstrap: agentBootstrap, tools };
}

export function createChatPrompt(systemMessage: string) {
    return ChatPromptTemplate.fromMessages([
        ['system', systemMessage],
        new MessagesPlaceholder('history'),
        ['human', '{input}'],
        ['placeholder', '{agent_scratchpad}'],
    ]);
}

export function createAgentExecutorWithPrompt(
    llm: ReturnType<typeof createLLMFromEnv>,
    tools: ReturnType<HederaLangchainToolkit['getTools']>,
    prompt: ChatPromptTemplate,
    returnIntermediateSteps = false
) {
    const agent = createToolCallingAgent({ llm, tools, prompt });
    return new AgentExecutor({ agent, tools, returnIntermediateSteps });
}

/**
 * Extracts a human-readable string from a heterogeneous agent/LLM response.
 *
 * Supported shapes for `response.output`:
 * - string → returned as-is
 * - Array<{ text: string } | unknown> → returns first element's `text` if present
 * - { text: string } → returns `text`
 *
 * Returns an empty string when no text can be extracted.
 */
export function extractResultFromResponse(response: unknown): string {
    if (typeof response === 'object' && response !== null && 'output' in response) {
        const output = (response as { output: unknown }).output;

        if (typeof output === 'string') return output;

        // Some toolchains return an array of message-like objects; prefer the first item's text
        if (Array.isArray(output)) {
            const first = output[0];
            if (first && typeof first === 'object' && 'text' in first) {
                const text = (first as { text?: unknown }).text;
                return typeof text === 'string' ? text : '';
            }
            return '';
        }

        // Fallback: single object with a `text` field
        if (typeof output === 'object' && output !== null && 'text' in output) {
            const text = (output as { text?: unknown }).text;
            return typeof text === 'string' ? text : '';
        }
    }
    return '';
}