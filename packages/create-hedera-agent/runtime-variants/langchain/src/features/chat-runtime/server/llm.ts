import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";

const DEFAULT_MODELS = {
  openai: "gpt-4o-mini",
  anthropic: "claude-haiku-4-5",
} as const;

export function createLLM(): BaseChatModel {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const model = process.env.LLM_MODEL?.trim();
  if (provider === "anthropic") {
    requireEnv("ANTHROPIC_API_KEY");
    return new ChatAnthropic({ model: model || DEFAULT_MODELS.anthropic });
  }
  if (provider !== "openai") {
    throw new Error(
      `Unsupported LLM_PROVIDER="${provider}". Use "openai" or "anthropic".`,
    );
  }
  requireEnv("OPENAI_API_KEY");
  return new ChatOpenAI({ model: model || DEFAULT_MODELS.openai });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is required. Set it in .env.local before starting the dev server.`,
    );
  }
  return value;
}
