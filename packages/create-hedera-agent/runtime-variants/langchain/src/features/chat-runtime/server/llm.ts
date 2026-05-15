import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";

const MODEL = "gpt-4o-mini";

export function createLLM(): BaseChatModel {
  requireEnv("OPENAI_API_KEY");
  return new ChatOpenAI({ model: MODEL });
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
