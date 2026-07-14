# Using Local Models

This guide walks you through setting up your AI agent to use a locally running model. As the ecosystem for open-source models is rapidly improving, using these models can save you money during your development cycles before moving on to frontier models (depending on your use-case).

## Contents

- [How It Works](#how-it-works)
- [Supported Model Providers](#supported-model-providers)
- [Choosing the Right Model](#choosing-the-right-model)
- [Configuring Your Agent](#configuring-your-agent)
  - [Pre-requisites](#pre-requisites)
  - [Steps](#steps)
- [Troubleshooting](#troubleshooting)

## How It Works

The Hedera Agent Kit is model-agnostic. Each framework adapter (LangChain, Vercel AI SDK, etc.) simply hands your tools to whatever model object you give it. To use a local model you point that model object at your local server's URL instead of a hosted API.

The Agent Kit assumes the underlying provider speaks the OpenAI `chat/completions` API (the same request/response shape used by `@langchain/openai` and `@ai-sdk/openai`), so any local server that exposes an OpenAI-compatible endpoint will work — you only change the `baseURL`, `apiKey`, and `model` name.

## Supported Model Providers

You can use any local model provider that exposes an OpenAI-compatible `chat/completions` endpoint, such as [Ollama](https://ollama.com/), [LM Studio](https://lmstudio.ai/), and [llama.cpp](https://github.com/ggml-org/llama.cpp). Before wiring it into an agent, confirm your provider exposes the OpenAI-compatible endpoint (see the [Pre-requisites](#pre-requisites) below).

## Choosing the Right Model

There are thousands of models on the open-source market, but choosing the right one depends entirely on your use-case and the hardware you have available. Below are some general rules of thumb to follow when considering which model to use with the Hedera Agent Kit:

- **Tool calling is required.** The Agent Kit works by exposing Hedera operations as tools, so you *must* pick a model that supports tool/function calling. Many small or older models do not so be sure to check the model card before committing to one.
- **Give it enough context window.** Loading multiple plugins means loading many tool definitions into the prompt. Pick a model with a context window large enough to hold your tool definitions plus the conversation.
- **Only load the plugins/tools you need.** Every extra tool consumes context and increases the chance the model picks the wrong one. Register just the plugins your agent actually uses.
- **Be thorough in your system prompt.** Clear instructions reduce hallucinations and wrong tool calls, which smaller local models are more prone to than frontier models.
- **Aim for the ~20–35B parameter range**, depending on your hardware.
  - If you're limited by system RAM/VRAM, prefer a Mixture of Experts (MoE) model over a dense one — MoE models activate only a fraction of their parameters per token, so they run faster for a given size.
- **Use a model build optimized for your hardware.**
  - On an Apple Silicon machine, prefer an MLX-based build.
  - On a DGX Spark (or similar NVIDIA hardware), prefer an NVFP4 build.
  - For all other cases, the GGUF variants are usually your best bet.

### Model Recommendations

These models support tool calling and run well in the target size range. Availability and exact tags vary by provider, please check your provider's model catalog for the precise name.

- `gpt-oss:20b` (should be able to run on about 16gb of memory)
- `qwen3.6:27b` (dense) or `qwen3.6:35b-a3b` (MoE) (Use these if you have at least 32gb of memory available)

Note: In terms of the actual context size for your agent, it depends on your use case and we suggest starting with a 32k context window and then tune accordingly

> Always verify the specific model/quantization you download advertises tool-calling (a.k.a. function-calling) support. A model without it will fail to invoke Hedera tools.

## Configuring Your Agent

Use the following steps to set up a locally running model with an agent built with the Hedera Agent Kit.

### Pre-requisites

- Have a local model downloaded and ready to use from your provider of choice (e.g. Ollama, LM Studio).
  - For Ollama, pull the model first, e.g. `ollama pull gpt-oss:20b`.
- Confirm your provider's local OpenAI-compatible endpoint is running:
  - For Ollama, use `http://localhost:11434/v1`
  - For LM Studio, use `http://localhost:1234/v1`
- Verify the endpoint responds before wiring it into an agent. For example, list the loaded models:

  ```bash
  # LM Studio
  curl http://localhost:1234/v1/models

  # Ollama
  curl http://localhost:11434/v1/models
  ```

  If this returns a JSON list of models, your endpoint is ready.

### Steps

1. Open your `.env` file and add the following, adjusting the values for your provider and model. Local servers don't require a real API key, but the OpenAI client libraries still expect a non-empty string, so pass any placeholder value:

   ```bash
   # Any non-empty placeholder — local servers ignore the value
   OPENAI_API_KEY="local"
   # The model name/tag as your provider reports it (see `curl .../v1/models`)
   OPENAI_API_MODEL="openai/gpt-oss-20b"
   # Your provider's local OpenAI-compatible endpoint
   OPENAI_API_ENDPOINT="http://localhost:1234/v1"
   ```

2. In the file where you create your agent, point your OpenAI client at the local endpoint. The setup differs slightly per framework:

   **LangChain**

   ```typescript
   import { ChatOpenAI } from '@langchain/openai';
   import { createAgent } from 'langchain';

   const llm = new ChatOpenAI({
     model: process.env.OPENAI_API_MODEL || '',
     apiKey: process.env.OPENAI_API_KEY || '',
     configuration: {
       baseURL: process.env.OPENAI_API_ENDPOINT || '',
     },
   });

   const agent = createAgent({
     model: llm,
     tools: [],
     systemPrompt:
       'You are a helpful assistant with access to Hedera blockchain tools',
   });
   ```

   **Vercel AI SDK**

   Use `createOpenAI` (rather than the default `openai` helper) so you can override the `baseURL`, then wrap the model with the toolkit middleware:

   ```typescript
   import { createOpenAI } from '@ai-sdk/openai';
   import { wrapLanguageModel } from 'ai';
   
   const openaiProvider = createOpenAI({
     baseURL: process.env.OPENAI_API_ENDPOINT || '',
     apiKey: process.env.OPENAI_API_KEY || '',
   });

   const model = wrapLanguageModel({
     model: openaiProvider.chat(process.env.OPENAI_API_MODEL || ''),
     middleware: [],
   });
   ```

   The rest of your agent code (building the toolkit, selecting plugins, choosing `AgentMode`, and running the chat loop) is unchanged — see the [Developer Examples](./DEVEXAMPLES.md) for the surrounding boilerplate. The only difference when using a local model is the `baseURL`, `apiKey`, and `model` values above.

## Troubleshooting

- **The agent never calls a tool / ignores Hedera commands.** The model most likely doesn't support tool calling, or the quantization you downloaded dropped it. Switch to a model that advertises function/tool calling.
- **Connection refused or `ECONNREFUSED`.** The local server isn't running or is on a different port. Re-run the `curl .../v1/models` check and confirm the port in `OPENAI_API_ENDPOINT`.
- **404 Not Found.** Make sure your `OPENAI_API_ENDPOINT` includes the `/v1` path segment (e.g. `http://localhost:11434/v1`), not just the host and port.
- **Model not found.** The `OPENAI_API_MODEL` value must match exactly what your provider reports in `curl .../v1/models`. Provider tags differ (for example, Ollama uses `gpt-oss:20b` while LM Studio may expose `openai/gpt-oss-20b`).
- **Poor or inconsistent tool selection.** Reduce the number of registered plugins/tools, tighten your system prompt, or move up to a larger model. Smaller local models are far more sensitive to prompt quality than frontier models.
- **Requests time out or the machine runs out of memory.** The model is too large for your hardware. Try a smaller model, a smaller quantization (e.g. a 4-bit GGUF), or an MoE variant.