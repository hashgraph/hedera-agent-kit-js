import "dotenv/config";

import { createInterface } from "node:readline";
import { stdin, stdout } from "node:process";

import { convertToModelMessages, stepCountIs, streamText } from "ai";

import { llm, systemPrompt, tools } from "../shared/agent.js";

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

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
