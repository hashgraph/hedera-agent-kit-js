# Product Requirements Document (PRD)

**Project name:** `create-hedera-agent-app`
**Command:** `npm create hedera-agent-app@latest` (alias of `npx create-hedera-agent-app`)
**Owner:** Jake Hall / Hashgraph Marketing
**Date:** Aug 10, 2025 (MYT)

---

## 1) Problem & Goals

Builders want a one-command starter that:

* scaffolds a **Next.js 15** app (App Router) with a minimal chat UI,
* installs and wires the **Hedera AI Agent Kit** (LangChain-ready; supports autonomous and return-bytes flows), and
* integrates **Hedera Wallet Connect** so users can approve/sign from a wallet when running in human-in-the-loop mode.

**Why now:** Agent Kit v3 emphasizes DX and exposes clear execution modes (**AUTONOMOUS** vs **RETURN\_BYTES**), which map perfectly to this template’s modes.

**Primary goals**

* G1: `npm create` prompts for mode and writes a ready `.env`.
* G2: Next.js app boots and lets the user run a basic “ask the agent” flow.
* G3: Human-in-the-loop path triggers a WalletConnect modal to sign and submit the transaction.
* G4: Autonomous path submits directly from the server using operator creds.

---

## 2) Scope & Non-Goals

**In scope**

* Interactive CLI wizard (project name, mode, network, keys, WalletConnect Project ID, AI model provider).
* Next.js 15 (App Router) TypeScript template with server route that drives the Hedera Agent Kit.
* Minimal chat UI (compose, history, status, “requires signature” handoff).
* WalletConnect integration via `@hashgraph/hedera-wallet-connect` (modal + session handling).
* Two agent execution modes using **Agent Kit**:

  * **AUTONOMOUS** → executes with server operator key.
  * **RETURN\_BYTES** → returns transaction bytes; client pushes to wallet via WalletConnect.

**Non-goals (v1)**

* Advanced tool galleries, multi-agent orchestration, or complex UI theming.
* Multi-wallet persistence UX beyond WalletConnect baseline.
* Deploy presets (Vercel/Render) – provide docs only.

---

## 3) Repo Location

This template will live **inside the Hedera Agent Kit repo** at:

```
hedera-agent-kit/typescript/examples/nextjs
```

* The `create-hedera-agent-app` CLI package will scaffold this example as the base.
* This ensures the example stays in sync with Agent Kit changes.

---

## 4) Users & Personas

* **Hackathon builders**: want speed; testnet by default; will likely choose human-in-the-loop first.
* **Startup devs**: want a clean server/client separation and a quick path to production.
* **Educators/Advocates**: need a repeatable demo setup.

---

## 5) High-Level Experience

1. Dev runs `npm create hedera-agent-app@latest`.
2. CLI prompts:

   * Project name, package manager.
   * **Mode:** Autonomous or Human-in-the-Loop.
   * **Network:** testnet (default) / mainnet.
   * If **Autonomous**: capture **ACCOUNT\_ID** and **PRIVATE\_KEY** (masked).
   * If **Human-in-the-Loop**: capture **WalletConnect Project ID**.
   * AI provider and related API key if applicable.
3. Tool copies the `typescript/examples/nextjs` folder, writes `.env`, installs deps, and prints “next steps”.
4. `npm run dev` → user visits `/` and chats:

   * In **AUTONOMOUS**, actions execute server-side via operator creds.
   * In **RETURN\_BYTES**, server replies with txn bytes → client opens WalletConnect modal; user signs and broadcasts.

---

## 6) Functional Requirements

### 6.1 CLI (create script)

* **Package name:** `create-hedera-agent-app`.
* **Prompts (required):**

  * Project name.
  * Mode: `autonomous` | `human` (HITL).
  * Network: `testnet` (default) | `mainnet`.
* **Prompts (conditional):**

  * **Autonomous:** `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY` (masked), optional AI key(s).
  * **HITL:** `NEXT_PUBLIC_WC_PROJECT_ID`, optional `WC_RELAY_URL`.
* **Prompts (optional):**

  * AI provider: `openai | anthropic | groq | ollama`.
* **Actions:**

  * Copy `typescript/examples/nextjs` into target folder.
  * Install deps.
  * Create `.env.local` with captured values.
  * Initialize git (optional).
  * Print next steps.

### 6.2 App structure (generated)

```
/app
  /api/agent/route.ts          # server route; runtime='nodejs'
  /api/wallet/prepare/route.ts # helper for HITL payload prep
  /components/Chat.tsx
  /components/WalletConnect.tsx
  /lib/agent.ts
  /lib/walletconnect.ts
  /styles/globals.css
.env.local.example
README.md
```

* Server route sets `runtime='nodejs'`.
* Client only receives public config.

### 6.3 Agent wiring

* Use **Hedera Agent Kit v3**:

  * **AUTONOMOUS:** instantiate Hedera client with operator from env.
  * **RETURN\_BYTES (HITL):** configure toolkit to return transaction bytes.
* Include at least 2 tools (e.g., get HBAR balance, submit topic message).
* Node ≥ 20 required.

### 6.4 WalletConnect integration

* Library: `@hashgraph/hedera-wallet-connect` + `@walletconnect/modal`.
* Client-side `DAppConnector` init with app metadata, WC project ID, allowed chain IDs.
* On `requiresSignature`, send transaction via WalletConnect.
* Handle session events.

### 6.5 UI

* Minimal chat: input, list of messages, spinner.
* Banner showing **mode** + **network**.
* HITL: “Review & Sign” panel that launches WalletConnect modal.

### 6.6 Configuration & Environment

* **Server-only:** `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY`, AI API keys.
* **Client-safe:** `NEXT_PUBLIC_NETWORK`, `NEXT_PUBLIC_AGENT_MODE`, `NEXT_PUBLIC_WC_PROJECT_ID`.
* Defaults: testnet, mode per user choice.

---

## 7) Technical Decisions & Dependencies

* **Core:** `next@^15`, `react`, `typescript`, `zod`
* **Hedera:** `hedera-agent-kit`, `@hashgraph/sdk`
* **WalletConnect:** `@hashgraph/hedera-wallet-connect`, `@walletconnect/modal`
* **AI (optional):** `@langchain/openai` / `@langchain/anthropic` / `@langchain/groq` / `@langchain/ollama`
* **CLI:** `prompts`, `kolorist`, `execa`, `fs-extra`

---

## 8) Security & Privacy

* Never send `HEDERA_OPERATOR_KEY` to client.
* `.env.local` is gitignored.
* Mask secrets in CLI input.
* Warn on mainnet in autonomous mode.

---

## 9) Acceptance Criteria

**A1 – Autonomous:**
`npm create hedera-agent-app` → choose Autonomous/testnet → paste creds → `npm run dev` → “What’s my balance?” returns HBAR balance server-side.

**A2 – Human-in-the-Loop:**
Choose HITL/testnet → paste WC Project ID → `npm run dev` → “Submit hello world” returns txn bytes → WalletConnect modal opens → sign & submit.

**A3 – Non-interactive flags:**
CLI accepts `--mode`, `--network`, `--pm` flags for automation.

---

## 10) Testing Plan

* CLI unit tests for prompts/env writing.
* Template build test for Next.js 15.
* Integration test for both modes.
* Manual smoke on Node 20+.

---

## 11) Documentation

* Explain modes & tradeoffs.
* WalletConnect setup guide.
* Env var matrix.
* Example prompts.
* Link to Agent Kit README, Hedera Wallet Connect README, Hedera docs.

---

## 12) Rollout Plan

* Publish `create-hedera-agent-app` to npm.
* Tag template versions in `hedera-agent-kit`.
* Announce in dev channels.

---

## 13) Risks & Mitigations

* **WalletConnect API changes** → pin stable versions.
* **Secrets exposure** → enforce public/private env separation.
* **Node runtime issues** → force `runtime='nodejs'` in API routes.
* **Missing WC Project ID** → wizard warns and disables HITL until set.

---

## 14) Deliverables

* `packages/create-hedera-agent-app/` (CLI)
* `typescript/examples/nextjs/` (template)
* CLI + template tests
* Docs