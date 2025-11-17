export enum LLMProvider {
  OPENAI = 'openai',
  ANTHROPIC = 'anthropic',
  GROQ = 'groq',
}

export interface LlmOptions {
  provider: LLMProvider;
  model?: string;
  apiKey?: string;
}

/**
 * Factory class for creating string identifiers for Large Language Models (LLMs)
 * based on the specified provider. Supports multiple LLM providers including
 * OpenAI, Anthropic, and Groq.
 */
export class LLMFactory {
  /**
   * Creates a string identifier for an LLM based on the provided options.
   * If no model is specified, a default for the provider is used.
   *
   * @param {LlmOptions} options - Configuration options for the LLM
   * @param {LLMProvider} options.provider - The LLM provider to use (OPENAI, ANTHROPIC, GROQ)
   * @param {string} [options.model] - Specific model name. If not provided, uses provider default.
   * @returns {string} A string identifier in the format 'provider:model'
   * @throws {Error} Throws an error if the provider is unsupported
   * @example
   * ```typescript
   * const llmIdentifier = LLMFactory.createLLM({
   * provider: LLMProvider.OPENAI,
   * model: 'gpt-4o-mini'
   * });
   * // llmIdentifier = "openai:gpt-4o-mini"
   *
   * const defaultGroq = LLMFactory.createLLM({
   * provider: LLMProvider.GROQ
   * });
   * // defaultGroq = "groq:llama3-8b-8192"
   * ```
   */
  static createLLM(options: LlmOptions): string {
    const provider: LLMProvider = options.provider;

    const model: string = options?.model || this.getDefaultModel(provider);

    switch (provider) {
      case LLMProvider.OPENAI:
        return `openai:${model}`;

      case LLMProvider.ANTHROPIC:
        return `anthropic:${model}`;

      case LLMProvider.GROQ:
        return `groq:${model}`;

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
