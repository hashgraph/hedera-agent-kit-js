import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";

// Returns the AI SDK `LanguageModel` the chat handler talks to. Reads
// LLM_PROVIDER / LLM_MODEL / OPENAI_API_KEY / ANTHROPIC_API_KEY from the
// environment. Same env contract as the CLI's local createLLM — kept
// separate so the runtime that constructs it owns its dependencies.
export function createLLM() {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const model = process.env.LLM_MODEL?.trim();
  if (provider === "anthropic") {
    requireEnv("ANTHROPIC_API_KEY");
    return anthropic(model || "claude-haiku-4-5");
  }
  if (provider !== "openai") {
    throw new Error(`Unsupported LLM_PROVIDER="${provider}". Use "openai" or "anthropic".`);
  }
  requireEnv("OPENAI_API_KEY");
  return openai(model || "gpt-4o-mini");
}

function requireEnv(name) {
  if (!process.env[name]?.trim()) {
    throw new Error(`${name} is required. Set it in your .env file.`);
  }
}
