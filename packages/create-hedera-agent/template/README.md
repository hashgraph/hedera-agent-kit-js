# Hedera Agent App

A starter project scaffolded by `create-hedera-agent`. Ships two run modes out of the box:

- `npm run web` — Next.js chat UI with optional human-in-the-loop transaction signing
- `npm run cli` — interactive terminal chat against the same agent

## Quick start

```bash
cp .env.example .env
# fill HEDERA_OPERATOR_ID, HEDERA_OPERATOR_KEY, and OPENAI_API_KEY (or ANTHROPIC_API_KEY)

npm install
npm run web   # open http://localhost:3000
# or
npm run cli
```

## What to edit

All agent wiring lives in **`shared/agent.js`**:

- `plugins` — the list of Hedera Agent Kit plugins available to the agent
- `systemPrompt` — the inline system prompt
- `mode` — `"auto"` (server signs and submits) or `"human"` (browser wallet signs)
- `client` — the Hedera SDK client bound to your operator
- `tools`, `llm` — Vercel-AI-SDK-shaped exports consumed by the web route and AI SDK CLI

Both run modes pick up edits to that file. The web app always uses the Vercel AI SDK; the CLI uses whichever framework was selected at scaffold time (`--framework ai-sdk` or `--framework langchain`).

## Switching frameworks

Re-scaffold with `npx create-hedera-agent --framework <ai-sdk|langchain>` and copy your plugin selection + custom prompt into the new `shared/agent.js`.

## Project layout

```
shared/agent.js              # single edit surface for agent wiring
cli/index.js                 # terminal chat (AI SDK or LangChain, per scaffold)
web/                         # Next.js project root
  src/app/page.jsx           # chat home
  src/app/api/chat/route.js  # chat-completion endpoint (AI SDK)
  src/features/              # chat UI + Hedera integration + wallet
.env                         # operator credentials and LLM keys (never commit)
```

## Environment variables

| Variable | Purpose |
|---|---|
| `HEDERA_OPERATOR_ID` | Account ID like `0.0.x` |
| `HEDERA_OPERATOR_KEY` | ECDSA private key (DER hex or `0x`-prefixed 64-hex) |
| `HEDERA_NETWORK` | `testnet` (default) or `mainnet` |
| `LLM_PROVIDER` | `openai` or `anthropic` |
| `LLM_MODEL` | Model id; provider-specific defaults apply if unset |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Pick the one matching `LLM_PROVIDER` |

## Deploying the web app

`web/` is a standard Next.js 16 project root. Point Vercel's root-directory setting at `web/` and deploy.

## Tests

```bash
npm test
```
