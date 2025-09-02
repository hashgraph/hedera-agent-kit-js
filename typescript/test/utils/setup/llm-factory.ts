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
  model: string;
  temperature: number;
  apiKey?: string;
  baseURL?: string;
  // Test-specific options
  maxIterations: number;
  systemPrompt: string;
}

/**
 * Factory class for creating LLMs based on the specified provider and options.
 */
export class LLMFactory {
  /**
   * Creates and returns an instance of a language model based on the specified provider and options.
   *
   * @param {LlmOptions} options - Configuration options for the language model.
   * @param {LLMProvider} options.provider - The provider of the language model (e.g., OpenAI, Anthropic, Groq). Defaults to OpenAI.
   * @param {string} [options.model] - The specific model to use. Defaults to the provider's default model.
   * @param {number} [options.temperature=0] - The temperature setting for the language model, controlling randomness in response generation.
   * @param {string} [options.apiKey] - The API key for authenticating with the provider. If not provided, a default environment variable will be used.
   * @param {string} [options.baseURL] - Base URL for the API requests, applicable for some providers.
   * @returns {BaseChatModel} An instance of the appropriate chat model configured based on the provider and options.
   */
  static createLLM(options: LlmOptions): BaseChatModel {
    // default to OpenAI if the provider is not specified
    const { provider = LLMProvider.OPENAI, model, temperature = 0, apiKey, baseURL } = options;

    const defaultModel = model || this.getDefaultModel(provider);

    switch (provider) {
      case LLMProvider.OPENAI:
        return new ChatOpenAI({
          model: defaultModel,
          temperature,
          apiKey: apiKey || process.env.OPENAI_API_KEY,
          configuration: baseURL ? { baseURL } : undefined,
        });

      case LLMProvider.ANTHROPIC:
        return new ChatAnthropic({
          model: defaultModel,
          temperature,
          apiKey: apiKey || process.env.ANTHROPIC_API_KEY,
        });

      case LLMProvider.GROQ:
        return new ChatGroq({
          model: defaultModel,
          temperature,
          apiKey: apiKey || process.env.GROQ_API_KEY,
        });

      default:
        throw new Error(`Unsupported LLM provider: ${provider}`);
    }
  }

  /**
   * Retrieves the default model identifier based on the specified LLMProvider.
   *
   * @param {LLMProvider} provider - The provider whose default model is to be retrieved.
   * @return {string} The default model identifier for the given provider.
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
        return 'gpt-4o-mini';
    }
  }
}
