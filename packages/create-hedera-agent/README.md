# create-hedera-agent

Scaffold a Hedera Agent Kit starter project. One command, two run modes out of the box:

- `npm run web` — a Next.js 16 chat UI (browser, streaming, optional human-in-the-loop transaction signing)
- `npm run cli` — an interactive terminal chat against the same agent

The web app is locked to the **Vercel AI SDK** (its `useChat` hook drives the streaming UI). The CLI is **single-runtime per scaffolded project**: pick `ai-sdk` or `langchain` at scaffold time and only that runtime's dependencies land in your project.

## Quickstart

```bash
npx create-hedera-agent@latest
```

Answer the prompts and the CLI will:

- Apply the **scaffold rule** with your framework choice (keeps only the chosen `cli/index.<framework>.js`, renames it to `cli/index.js`, prunes the unused runtime's deps)
- Write `.env` with your operator credentials and LLM key
- Run `npm install`

Then:

```bash
cd hedera-agent-app
npm run web   # browser chat at http://localhost:3000
# or
npm run cli   # terminal chat
```

Node.js **>= 22** is required.

## Prompts

| Prompt          | Choices                                | Default            |
| --------------- | -------------------------------------- | ------------------ |
| Project name    | string                                 | `hedera-agent-app` |
| Framework       | `ai-sdk` \| `langchain` (CLI runtime)  | `ai-sdk`           |
| Operator ID     | `0.0.x`                                | —                  |
| Operator key    | ECDSA DER hex or `0x`-prefixed 64-hex  | —                  |
| OpenAI API key  | `sk-…`                                 | —                  |
| Package manager | `npm` \| `pnpm` \| `yarn` \| `bun`     | `npm`              |

Get a testnet operator account at <https://portal.hedera.com>. The CLI accepts ECDSA keys.

## Non-interactive

```bash
npx create-hedera-agent@latest \
  --name my-agent \
  --framework langchain \
  --operator-id 0.0.1234 \
  --operator-key 0x... \
  --openai-key sk-... \
  --pm pnpm \
  --yes
```

### Flag reference

| Flag                       | Value                                |
| -------------------------- | ------------------------------------ |
| `--name`                   | Project directory name               |
| `--framework`              | `ai-sdk` \| `langchain`              |
| `--operator-id`            | Hedera account ID                    |
| `--operator-key`           | ECDSA private key                    |
| `--openai-key`             | OpenAI API key                       |
| `--pm`, `--package-manager`| `npm` \| `pnpm` \| `yarn` \| `bun`   |
| `--yes`, `-y`              | Accept defaults; suppress prompts    |

## Project layout (post-scaffold)

```
my-agent/
├── shared/agent.js        # single edit surface — plugins, system prompt, client, tools, llm
├── cli/index.js           # terminal chat (AI SDK or LangChain, per --framework)
├── web/                   # Next.js project root (always AI SDK)
│   ├── next.config.js
│   ├── jsconfig.json      # @/ → web/src
│   ├── public/
│   └── src/
│       ├── app/           # layout, page, /api/chat, /api/transactions/submit-signed
│       └── features/      # chat, chat-runtime, chat-hedera, chat-wallet
├── package.json           # single root; "type": "module"; only the chosen runtime's deps
├── .env                   # operator credentials and LLM keys
└── vitest.config.js
```

`shared/agent.js` is the **only** file you need to edit to change agent behavior. Edit `plugins`, `systemPrompt`, `mode`, or `llm` and both the web app and the CLI pick it up.

## Framework choice

- **`ai-sdk`** (default): web app and CLI both use `@ai-sdk/openai` + `@ai-sdk/anthropic` + `@hashgraph/hedera-agent-kit-ai-sdk`. Single mental model end-to-end.
- **`langchain`**: web app still uses the AI SDK (its UI is tied to `useChat`), but `cli/index.js` builds a LangGraph React agent on top of `@hashgraph/hedera-agent-kit-langchain` + `@langchain/openai`/`@langchain/anthropic`.

The scaffold rule lives in `packages/create-hedera-agent` and is exported as a pure function — same input produces the same output, whether called by this CLI or by the Hedera Portal's download wizard.

### Switching frameworks after scaffolding

There is no in-source dispatch. To switch, re-scaffold with the desired `--framework` and copy your `plugins`/`systemPrompt` edits over.

## LLM provider

Both OpenAI and Anthropic SDKs are installed by default. Switch with environment variables — no `npm install`:

```env
LLM_PROVIDER=anthropic
LLM_MODEL=claude-haiku-4-5
ANTHROPIC_API_KEY=sk-ant-...
```

`LLM_MODEL` defaults: `gpt-4o-mini` (openai), `claude-haiku-4-5` (anthropic).

## Tests

The scaffold ships Vitest tests for chat state, runtime mappers, Hedera client wiring, mutating-tool detection, the chat-extension registry, and more. `npm test` runs them all from the project root.

## Learn more

- [Hedera Agent Kit](https://github.com/hashgraph/hedera-agent-kit)
- [Vercel AI SDK](https://ai-sdk.dev/)
- [LangChain JS](https://js.langchain.com/)
- [Hedera Portal](https://portal.hedera.com)
