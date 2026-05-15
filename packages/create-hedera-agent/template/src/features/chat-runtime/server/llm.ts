import { openai } from "@ai-sdk/openai";

const MODEL = "gpt-4o-mini";

export function createLLM() {
  requireEnv("OPENAI_API_KEY");
  return openai(MODEL);
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
