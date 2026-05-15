# create-hedera-agent

Scaffold a Next.js 15 chatbot wired with the [Hedera Agent Kit](https://github.com/hashgraph/hedera-agent-kit). One command, one `npm run dev`, working chat with streaming, tool-call cards, and human-in-the-loop signing.

Two framework backends are supported: **Vercel AI SDK** (default) and **LangChain**. The chat UI is identical for both; only `src/lib/runtime/` differs.

## Quickstart

```bash
npx create-hedera-agent@latest
```

Answer the prompts and the CLI will:

- Copy the template into a new directory
- Apply the framework overlay you picked (AI SDK or LangChain)
- Write a populated `.env.local` with your operator credentials and OpenAI API key
- Run `npm install` (or your selected package manager)
- Initialise a git repo with a first commit

Then:

```bash
cd hedera-agent-app
npm run dev
```

Open <http://localhost:3000> and start chatting.

Node.js **>= 20** is required.

## Prompts

| Prompt              | Choices                                  | Default            |
| ------------------- | ---------------------------------------- | ------------------ |
| Project name        | string                                   | `hedera-agent-app` |
| Framework           | `ai-sdk` \| `langchain`                  | `ai-sdk`           |
| Operator ID         | string (`0.0.x`)                         | -                  |
| Operator key        | ECDSA DER hex or `0x`-prefixed 64-hex    | -                  |
| OpenAI API key      | `sk-…`                                   | -                  |
| Package manager     | `npm` \| `pnpm` \| `yarn` \| `bun`       | `npm`              |

Get a testnet operator account at <https://portal.hedera.com>. The CLI accepts **ECDSA** keys only. ED25519 needs a manual edit to `src/features/chat-hedera/server/hedera-client.ts`. The scaffold runs on `testnet` by default; switch to mainnet by editing `src/features/chat-hedera/utils/network.ts`.

## Non-interactive mode

Every prompt has a matching flag. Pass `--yes` to skip prompts and apply defaults:

```bash
npx create-hedera-agent@latest \
  --name my-agent \
  --framework ai-sdk \
  --operator-id 0.0.1234 \
  --operator-key 0x... \
  --openai-key sk-... \
  --pm pnpm \
  --yes
```

### Flag reference

| Flag                       | Value                                       |
| -------------------------- | ------------------------------------------- |
| `--name`                   | Project directory name                      |
| `--framework`              | `ai-sdk` \| `langchain`                     |
| `--operator-id`            | Hedera account ID                           |
| `--operator-key`           | ECDSA private key                           |
| `--openai-key`             | OpenAI API key                              |
| `--pm`, `--package-manager`| `npm` \| `pnpm` \| `yarn` \| `bun`          |
| `--yes`, `-y`              | Accept defaults; suppress prompts           |

## What the scaffold includes

- Streaming chat surface built on the AI SDK UIMessage protocol and Vercel AI Elements
- Left sidebar with multi-chat persistence (localStorage), per-chat URLs, rename, delete
- Inline `<TransactionCard>` for every mutating tool call with state-machine rendering (`executing → confirmed | failed` in auto mode, or `awaiting-approval` → user signs offline and pastes signed bytes → `signing → confirmed | rejected | failed` in human mode)
- `POST /api/chat` for streaming and `POST /api/transactions/submit-signed` for broadcasting user-signed transactions in `human` mode
- All ten Hedera Agent Kit core plugins enabled (token, account, consensus, EVM, plus query plugins and misc/transaction history)
- A `prompts/system.md` system prompt with `{{operatorId}}`, `{{network}}`, `{{mode}}` substitutions
- A populated `.env.local` (gitignored)

The scaffolded project's own `README.md` covers env contract, mode behavior, the HITL threat model, framework swapping, and AgentLab integration.

## Framework choice

Picking `ai-sdk` ships `@ai-sdk/openai` and `@hashgraph/hedera-agent-kit-ai-sdk`. Picking `langchain` ships `@langchain/openai` (plus `@langchain/core`, `@langchain/langgraph`, `langchain`) and `@hashgraph/hedera-agent-kit-langchain`. Only the chosen framework's dependencies land in `package.json`. There is no co-installed deadweight.

All framework-specific code lives in `src/lib/runtime/`. The rest of the app imports only AI SDK UIMessage types, so changing your mind later means swapping that single directory and the matching `package.json` entries.

## Replacing a previous scaffold

The 0.1.x template shipped a WalletConnect-based chat UI with a modal HITL flow. The 0.2 rewrite removes that path entirely. If you scaffolded against the old template, you'll want to start fresh. The scaffolded project's `README.md` has a migration note covering what's removed and why old chats can't be imported.

## Learn more

- [Hedera Agent Kit](https://github.com/hashgraph/hedera-agent-kit)
- [Vercel AI SDK](https://ai-sdk.dev/)
- [LangChain JS](https://js.langchain.com/)
- [Hedera Portal](https://portal.hedera.com)
