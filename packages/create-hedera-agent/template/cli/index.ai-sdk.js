import "dotenv/config";

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { AgentMode as HederaAgentMode } from "@hashgraph/hedera-agent-kit";
import { HederaAIToolkit } from "@hashgraph/hedera-agent-kit-ai-sdk";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { convertToModelMessages, stepCountIs, streamText } from "ai";

import { client, config, hooks, mode, plugins, systemPrompt } from "../shared/config.js";

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

function prompt(rl) {
  return new Promise((resolve) => rl.question("you > ", resolve));
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  console.log("Hedera Agent CLI (AI SDK). Type 'exit' to quit.\n");
  for (;;) {
    const input = (await prompt(rl)).trim();
    if (!input) continue;
    if (input === "exit" || input === "quit") break;
    try {
      await chat(input);
    } catch (err) {
      console.error("\n[error]", err?.message || err);
    }
  }
  rl.close();
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
