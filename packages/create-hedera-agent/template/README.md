# Hedera Agent App

A Hedera Agent Kit starter project. Ships two run modes out of the box:

- `npm run web` — Next.js chat UI with optional human-in-the-loop transaction signing
- `npm run cli` — interactive terminal chat against the same agent

## Quick start

```bash
cp .env.example .env
# fill HEDERA_ACCOUNT_ID, HEDERA_PRIVATE_KEY, and OPENAI_API_KEY (or ANTHROPIC_API_KEY)

npm install
npm run web   # open http://localhost:3000
# or
npm run cli
```

## What to edit

All agent wiring lives in **`shared/config.js`** — a data-only module:

- `plugins` — the list of Hedera Agent Kit plugins available to the agent
- `systemPrompt` — the inline system prompt
- `mode` — `"auto"` (server signs and submits) or `"human"` (browser wallet signs)
- `hooks` — policies and audit hooks applied to every tool call
- `config` — per-plugin runtime configuration
- `client` — the Hedera SDK client bound to your operator

Each runtime (CLI and web) reads from `shared/config.js` and constructs its own toolkit + LLM. Both run modes pick up edits to that file. The web app always uses the Vercel AI SDK; the CLI uses whichever framework was selected at scaffold time (`--framework ai-sdk` or `--framework langchain`).

## Third-party plugins

Plugins outside `@hashgraph/hedera-agent-kit/plugins` — including Saucerswap, Memejob, Pyth, Chainlink, and CoinCap — are **not bundled with downloads from the Hedera Portal**. If you selected one in the Agent Lab wizard, your downloaded zip ships with the 10 core plugins only.

To add a third-party plugin manually:

1. `npm install <package-name>` (e.g. `npm install chainlink-pricefeed-plugin`)
2. Import the plugin symbol in `shared/config.js` and add it to the `plugins` array.
3. If the plugin needs runtime config, add a key to the `config` export per the plugin's docs (e.g. `saucerswap: { apiKey: process.env.SAUCERSWAP_API_KEY }`).
4. Set any required env vars in `.env`.

## Switching frameworks

Re-download the project from the Hedera Portal with the other framework selected, then copy your plugin selection + custom prompt into the new `shared/config.js`.

## Project layout

```
shared/config.js             # single edit surface for agent wiring (data only)
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
| `HEDERA_ACCOUNT_ID` | Account ID like `0.0.x` |
| `HEDERA_PRIVATE_KEY` | ECDSA private key (DER hex or `0x`-prefixed 64-hex) |
| `HEDERA_NETWORK` | `testnet` (default) or `mainnet` |
| `LLM_PROVIDER` | `openai` or `anthropic` |
| `LLM_MODEL` | Model id; provider-specific defaults apply if unset |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | Pick the one matching `LLM_PROVIDER` |

## Deploying the web app to Vercel

`web/` is a standard Next.js 16 project root. `web/next.config.js` already pins `outputFileTracingRoot` one level up so the bundler picks up `shared/config.js` from outside the Next.js root — no extra Vercel config needed for that.

### Step by step (dashboard)

1. **Push your project to Git.**

   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   # then create a GitHub/GitLab/Bitbucket repo and push
   ```

   Confirm `.env` is in `.gitignore` (the scaffold ships it that way) — never commit operator credentials.

2. **Import the repo in Vercel.** Go to <https://vercel.com/new> and pick your repo.

3. **Set the Root Directory to `web`.** In the project settings during import, click "Edit" next to the auto-detected root and change it to `web`. This is critical — the scaffold's root holds `shared/` + `cli/`; Vercel deploys only what's under the Root Directory you choose.

4. **Add environment variables.** Project Settings → Environment Variables. Add each for **Production**, **Preview**, and **Development**:

   | Variable | Value |
   |---|---|
   | `HEDERA_ACCOUNT_ID` | Your account ID (e.g. `0.0.1234`) |
   | `HEDERA_PRIVATE_KEY` | Your ECDSA private key |
   | `HEDERA_NETWORK` | `testnet` or `mainnet` |
   | `LLM_PROVIDER` | `openai` or `anthropic` |
   | `LLM_MODEL` | (optional) e.g. `gpt-4o-mini` |
   | `OPENAI_API_KEY` *or* `ANTHROPIC_API_KEY` | Pick the one matching `LLM_PROVIDER` |

5. **Click Deploy.** First build takes ~2–3 minutes. Subsequent commits to the default branch auto-deploy.

### Step by step (Vercel CLI)

```bash
npm install -g vercel
vercel login
vercel link             # accept defaults; when asked for project root, enter: web
vercel env add HEDERA_ACCOUNT_ID production
vercel env add HEDERA_PRIVATE_KEY production
vercel env add HEDERA_NETWORK production
vercel env add LLM_PROVIDER production
vercel env add LLM_MODEL production
vercel env add OPENAI_API_KEY production   # or ANTHROPIC_API_KEY
vercel --prod
```

### Notes

- `cli/` is not deployed — Vercel only serves the Next.js app under `web/`. To run the CLI in production, run it locally or in a separate container with the same `.env`.
- Edits to `shared/config.js` (e.g. changing the plugin set or system prompt) require a new commit and redeploy.
- For local dev against Vercel's environment, `vercel dev` runs the project the way Vercel does and reads the same env vars from the dashboard.
