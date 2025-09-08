import { ChatOpenAI } from '@langchain/openai';
import { ChatAnthropic } from '@langchain/anthropic';
import { ChatGroq } from '@langchain/groq';
import type { BaseChatModel } from '@langchain/core/language_models/chat_models';

export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GROQ = 'groq',
}

export interface LlmOptions {
  provider: LLMProvider;
  model?: string;
  temperature: number;
  apiKey?: string;
  baseURL?: string;
  maxIterations: number;
  systemPrompt: string;
}

/**
 * Factory class for creating Large Language Model (LLM) instances based on the specified provider and configuration options.
 * Supports multiple LLM providers including OpenAI, Anthropic, and Groq.
 */
export class LLMFactory {
  /**
   * Creates and configures an LLM instance based on the provided options.
   *
   * @param {LlmOptions} options - Configuration options for the LLM
   * @param {LLMProvider} options.provider - The LLM provider to use (OPENAI, ANTHROPIC, GROQ)
   * @param {string} [options.model] - Specific model name. If not provided, uses provider default
   * @param {number} [options.temperature=0] - Controls randomness in responses (0-1, where 0 is deterministic)
   * @param {string} options.apiKey - API key for the specified provider (required)
   * @param {string} [options.baseURL] - Custom base URL for API requests (OpenAI only)
   * @returns {BaseChatModel} Configured LLM instance ready for use
   * @throws {Error} Throws an error if the API key is missing or provider is unsupported
   * @example
   * ```typescript
   * const llm = LLMFactory.createLLM({
   *   provider: LLMProvider.OPENAI,
   *   model: 'gpt-4o-mini',
   *   temperature: 0.1,
   *   apiKey: process.env.OPENAI_API_KEY
   * });
   * ```
   */
  static createLLM(options: LlmOptions): BaseChatModel {
    const provider: LLMProvider = options.provider;

    const model: string = options?.model || this.getDefaultModel(provider);

    const temperature = options?.temperature ?? 0;
    const baseURL = options?.baseURL;

    const apiKey = options?.apiKey;
    if (!apiKey) {
      throw new Error(`Missing API key for provider: ${provider}`);
    }

    switch (provider) {
      case LLMProvider.OPENAI:
        return new ChatOpenAI({
          model,
          temperature,
          apiKey,
          configuration: baseURL ? { baseURL } : undefined,
        });

      case LLMProvider.ANTHROPIC:
        return new ChatAnthropic({
          model,
          temperature,
          apiKey,
        });

      case LLMProvider.GROQ:
        return new ChatGroq({
          model,
          temperature,
          apiKey,
        });

      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  /**
   * Returns the default model name for a given LLM provider.
   *
   * @param {LLMProvider} provider - The LLM provider to get the default model for
   * @returns {string} The default model name for the specified provider
   * @private
   * @example
   * - OpenAI: 'gpt-4o-mini'
   * - Anthropic: 'claude-3-haiku-20240307'
   * - Groq: 'llama3-8b-8192'
   */
  private static getDefaultModel(provider: LLMProvider): string {
    switch (provider) {
      case LLMProvider.OPENAI:
        return 'gpt-4o-mini';
      case LLMProvider.ANTHROPIC:
        return 'claude-3-haiku-20240307';
      case LLMProvider.GROQ:
        return 'llama3-8b-8192';
      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }
}
