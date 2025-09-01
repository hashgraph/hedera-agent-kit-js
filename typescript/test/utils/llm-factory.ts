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
  provider?: LLMProvider;
  model?: string;
  temperature?: number;
  apiKey?: string;
  baseURL?: string;
  // Test-specific options
  maxIterations?: number;
  systemPrompt?: string;
}

/**
 * Factory class for creating LLMs based on the specified provider and options.
 */
export class LLMFactory {
  static createLLM(options: LlmOptions): BaseChatModel {
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

  static fromEnvironment(): BaseChatModel {
    const provider = (process.env.LLM_PROVIDER || LLMProvider.OPENAI) as LLMProvider;
    const model = this.getDefaultModel(provider);
    const temperature = parseFloat(process.env.LLM_TEMPERATURE || '0');

    return this.createLLM({
      provider,
      model: process.env.LLM_MODEL || model,
      temperature,
      apiKey: process.env.LLM_API_KEY,
      baseURL: process.env.LLM_BASE_URL,
    });
  }

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
