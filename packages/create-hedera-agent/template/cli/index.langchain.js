import "dotenv/config";

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { AgentMode as HederaAgentMode } from "@hashgraph/hedera-agent-kit";
import { HederaLangchainToolkit } from "@hashgraph/hedera-agent-kit-langchain";
import { ChatOpenAI } from "@langchain/openai";
import { ChatAnthropic } from "@langchain/anthropic";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { MemorySaver } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";

import { client, config, hooks, plugins, systemPrompt } from "../shared/agent.js";

const toolkit = new HederaLangchainToolkit({
  client,
  configuration: {
    plugins,
    context: { mode: HederaAgentMode.AUTONOMOUS, hooks, config },
  },
});

const llm = createLangChainLLM();

const agent = createReactAgent({
  llm,
  tools: toolkit.getTools(),
  checkpointer: new MemorySaver(),
});

const threadId = `cli-${Date.now()}`;

async function chat(userInput) {
  const stream = await agent.stream(
    {
      messages: [new HumanMessage(userInput)],
    },
    {
      configurable: { thread_id: threadId },
      streamMode: "values",
    },
  );

  let lastAssistant = "";
  for await (const step of stream) {
    const last = step.messages?.[step.messages.length - 1];
    if (!last) continue;
    if (last.tool_calls?.length) {
      for (const call of last.tool_calls) {
        stdout.write(`\n[tool: ${call.name}]\n`);
      }
    }
    if (typeof last.content === "string" && last._getType() === "ai" && last.content) {
      lastAssistant = last.content;
    }
  }
  stdout.write(`${lastAssistant}\n`);
}

function prompt(rl) {
  return new Promise((resolve) => rl.question("you > ", resolve));
}

function createLangChainLLM() {
  const provider = (process.env.LLM_PROVIDER || "openai").toLowerCase();
  const model = process.env.LLM_MODEL?.trim();
  if (provider === "anthropic") {
    requireEnv("ANTHROPIC_API_KEY");
    return new ChatAnthropic({ model: model || "claude-haiku-4-5" });
  }
  if (provider !== "openai") {
    throw new Error(`Unsupported LLM_PROVIDER="${provider}". Use "openai" or "anthropic".`);
  }
  requireEnv("OPENAI_API_KEY");
  return new ChatOpenAI({ model: model || "gpt-4o-mini" });
}

function requireEnv(name) {
  if (!process.env[name]?.trim()) {
    throw new Error(`${name} is required. Set it in your .env file.`);
  }
}

async function main() {
  const rl = createInterface({ input: stdin, output: stdout });
  console.log("Hedera Agent CLI (LangChain). Type 'exit' to quit.\n");
  console.log(`System prompt loaded (${systemPrompt.length} chars).\n`);
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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
