# LangChain runtime variant

This directory is the LangChain build of `template/src/features/chat-runtime/`.
The default template ships the AI SDK variant; this one is overlaid by the CLI
when the user picks `--framework=langchain` (and by AgentLab's code generator
for the same selection in the portal).

## How the overlay works

The CLI performs the following steps when `framework === "langchain"`:

1. Copy `template/` → target directory (the AI SDK baseline).
2. Replace `target/src/features/chat-runtime/` with the contents of this
   directory's `src/features/chat-runtime/`.
3. Overlay `target/src/features/chat-hedera/server/toolkit.ts` with this
   directory's LangChain-flavoured version (the only chat-hedera file that is
   runtime-coupled — its body wires `HederaAIToolkit` on the AI SDK side and
   `HederaLangchainToolkit` on the LangChain side; everything else under
   `chat-hedera/server/` is runtime-agnostic and stays shared).
4. Apply the dep diff in `package.deps.json` to `target/package.json` — remove
   the entries listed in `remove.dependencies`, merge in `add.dependencies`.
5. Strip co-located `*.test.ts(x)` files from the overlaid directories (they
   exist for the standalone `npm run test` here; the scaffolded project does
   not ship the langchain-specific test setup).

## What's the same as the AI SDK variant

These files live exclusively under `template/` and are reused by both
variants — the langchain overlay never duplicates them:

- `chat-hedera/server/plugins.ts` — Hedera Agent Kit plugin list (kept
  identical so plugin choices carry across framework swaps).
- `chat-hedera/server/mutating-tools.ts` — derives the mutating tool method
  set from the plugin list.
- `chat-hedera/server/hedera-client.ts` — operator client construction.
- `chat-hedera/server/system-prompt.ts` — system prompt template loader.
- `chat-hedera/server/submit-signed.ts` — `/api/transactions/submit-signed`
  handler that broadcasts pre-signed transactions.
- `chat-hedera/server/get-hedera-tools.ts` and
  `chat-hedera/server/get-hedera-system-prompt.ts` — the providers passed to
  `createChatHandler`. Their signatures depend on the runtime-defined
  `ChatHandlerToolset` / `ChatHandlerRequestBody` types but their bodies do
  not mention the runtime.
- `chat-hedera/utils/agent-mode.ts` — the canonical `AgentMode` type and
  env-default resolver.
- The chat substrate (`features/chat/`) and the rest of `chat-hedera/`
  (components, hooks, utils, the extension registration object) are entirely
  runtime-agnostic.

## What's LangChain-specific

Everything below ships in this overlay:

### `src/features/chat-runtime/`

- `hooks/useChatAgent.ts` — client-side runtime entrypoint. Wraps
  `useChat` from `@ai-sdk/react` and exposes the substrate's canonical
  `ChatMessage` / `ChatStatus` interface. Identical in shape to the AI SDK
  variant because the wire format on the client ↔ server boundary remains the
  ai-sdk UIMessage stream protocol — only the server-side adapter differs.
- `utils/mappers.ts` — canonical ↔ ai-sdk `UIMessage` mappers shared between
  the client hook and the server's request decoder.
- `server/llm.ts` — `createLLM()` switching on `AI_PROVIDER` and instantiating
  the matching LangChain chat model (`ChatOpenAI` / `ChatAnthropic` /
  `ChatGroq` / `ChatOllama`). Same env contract as the AI SDK variant.
- `server/messages.ts` — converts canonical `ChatMessage[]` to LangChain
  `BaseMessage[]` (HumanMessage / AIMessage with `tool_calls` / ToolMessage),
  letting the agent resume cleanly after the offline-sign round-trip.
- `server/create-chat-handler.ts` — `createChatHandler({ getTools,
  getSystemPrompt })` factory. Returns a Next.js POST handler that drives the
  LangGraph agent with `streamMode: ["messages", "updates"]` and adapts each
  event to AI SDK UIMessage chunks (`text-delta`, `tool-input-available`,
  `tool-output-available`). Aborts the agent when an awaiting-approval payload
  is emitted so the LLM doesn't burn an extra call on a placeholder result.

### `src/features/chat-hedera/server/toolkit.ts`

Wraps `HederaLangchainToolkit` and intercepts mutating tools in `human` mode,
emitting an awaiting-approval payload as the tool result instead of executing.
Returns the LangChain-shaped `ChatHandlerToolset` (`{ tools:
StructuredToolInterface[]; mutatingToolMethods: Set<string> }`) that the
LangChain `createChatHandler` consumes.

## Contract with the rest of the template

`useChatAgent`, `createChatHandler`, the canonical `ChatMessage` /
`ChatStatus` types, the `getTools` / `getSystemPrompt` provider signatures,
and the JSON shape of tool outputs (the `{ raw, humanMessage }` envelope) are
identical between variants. The chat substrate, transaction card, signing
hook, mode toggle, and storage code do not change between framework builds.

## Verifying the overlay

From this directory:

```bash
npm install
npm run typecheck   # tsc --noEmit against the overlaid code
npm run test        # vitest run (mappers, messages, createChatHandler)
```

`tsconfig.json` and `vitest.config.ts` resolve `@/features/chat-runtime/*`
and `@/features/chat-hedera/server/toolkit` against this directory's `src/`
first, falling through to `../../template/src/` for everything that is
shared. This is the same precedence the CLI achieves at scaffold time by
overwriting those exact paths in the target project.
