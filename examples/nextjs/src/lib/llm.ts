import type { BaseChatModel } from "@langchain/core/language_models/chat_models";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { ChatGroq } from "@langchain/groq";
import { ChatOllama } from "@langchain/ollama";

export type AIProvider = "openai" | "anthropic" | "groq" | "ollama";

export function createLLMFromEnv(): BaseChatModel<any> {
    const provider = (process.env.AI_PROVIDER || "").toLowerCase() as AIProvider;

    switch (provider) {
        case "openai": {
            const apiKey = process.env.OPENAI_API_KEY;
            if (!apiKey) {
                throw new Error("OPENAI_API_KEY is required when AI_PROVIDER=openai");
            }
            const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
            return new ChatOpenAI({ model, apiKey });
        }
        case "anthropic": {
            const apiKey = process.env.ANTHROPIC_API_KEY;
            if (!apiKey) {
                throw new Error("ANTHROPIC_API_KEY is required when AI_PROVIDER=anthropic");
            }
            const model = process.env.ANTHROPIC_MODEL || "claude-3-5-sonnet-20240620";
            return new ChatAnthropic({ model, apiKey });
        }
        case "groq": {
            const apiKey = process.env.GROQ_API_KEY;
            if (!apiKey) {
                throw new Error("GROQ_API_KEY is required when AI_PROVIDER=groq");
            }
            const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
            return new ChatGroq({ model, apiKey });
        }
        case "ollama": {
            const baseUrl = process.env.OLLAMA_BASE_URL;
            if (!baseUrl) {
                throw new Error("OLLAMA_BASE_URL is required when AI_PROVIDER=ollama");
            }
            const model = process.env.OLLAMA_MODEL || "llama3.1";
            return new ChatOllama({ baseUrl, model });
        }
        default: {
            throw new Error(
                "AI_PROVIDER must be one of: openai | anthropic | groq | ollama"
            );
        }
    }
}


