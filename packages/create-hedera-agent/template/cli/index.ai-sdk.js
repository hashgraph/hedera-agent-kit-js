import "dotenv/config";

import { stdout } from "node:process";

import { AgentMode as HederaAgentMode } from "@hashgraph/hedera-agent-kit";
import { HederaAIToolkit } from "@hashgraph/hedera-agent-kit-ai-sdk";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, stepCountIs, streamText } from "ai";
import prompts from "prompts";

import { client, config, extraContext, hooks, mode, plugins, systemPrompt } from "../shared/config.js";

const toolkit = new HederaAIToolkit({
  client,
  configuration: {
    plugins,
    context: {
      mode:
        mode === "human"
          ? HederaAgentMode.RETURN_BYTES
          : HederaAgentMode.AUTONOMOUS,
      hooks,
      config,
      ...extraContext,
    },
  },
});
const tools = toolkit.getTools();
const llm = createLLM();

const history = [];

async function chat(userInput) {
  history.push({ role: "user", parts: [{ type: "text", text: userInput }] });

  const result = streamText({
    model: llm,
    system: systemPrompt,
    messages: await convertToModelMessages(history),
    tools,
    stopWhen: stepCountIs(10),
    onStepFinish({ toolCalls }) {
      for (const call of toolCalls || []) {
        stdout.write(`\n[tool: ${call.toolName}]\n`);
      }
    },
  });

  let assistantText = "";
  for await (const chunk of result.textStream) {
    stdout.write(chunk);
    assistantText += chunk;
  }
  stdout.write("\n");

  history.push({ role: "assistant", parts: [{ type: "text", text: assistantText }] });
}

async function main() {
  console.log("Hedera Agent CLI (AI SDK). Type 'exit' to quit.\n");
  for (;;) {
    const { input } = await prompts(
      { type: "text", name: "input", message: "you >" },
      { onCancel: () => process.exit(0) },
    );
    const trimmed = (input ?? "").trim();
    if (!trimmed) continue;
    if (trimmed === "exit" || trimmed === "quit") break;
    try {
      await chat(trimmed);
    } catch (err) {
      console.error("\n[error]", err?.message || err);
    }
  }
}

function createLLM() {
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
