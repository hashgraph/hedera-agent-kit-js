## Relevant Files

- `packages/create-hedera-agent-app/package.json` - CLI package metadata, bin entry, and dependencies.
- `packages/create-hedera-agent-app/index.ts` - Main CLI entry; prompts, flags handling, scaffolding logic.
- `packages/create-hedera-agent-app/README.md` - Usage instructions for `npm create hedera-agent-app`.
- `typescript/examples/nextjs/package.json` - Next.js app metadata, scripts, and dependencies.
- `typescript/examples/nextjs/tsconfig.json` - TypeScript config for the template.
- `typescript/examples/nextjs/next.config.ts` - Next.js config; ensure API routes run with Node runtime.
- `typescript/examples/nextjs/app/layout.tsx` - Root layout; global providers and styles.
- `typescript/examples/nextjs/app/page.tsx` - Home page mounting the chat UI.
- `typescript/examples/nextjs/app/api/agent/route.ts` - Server route that drives the Hedera Agent Kit.
- `typescript/examples/nextjs/app/api/wallet/prepare/route.ts` - Helper route to prepare HITL payloads.
- `typescript/examples/nextjs/components/Chat.tsx` - Minimal chat component (messages, input, spinner).
- `typescript/examples/nextjs/components/WalletConnect.tsx` - WalletConnect modal & session management.
- `typescript/examples/nextjs/src/lib/agent.ts` - Agent wiring for AUTONOMOUS and RETURN_BYTES modes.
- `typescript/examples/nextjs/lib/walletconnect.ts` - DAppConnector init and client helpers.
- `typescript/examples/nextjs/styles/globals.css` - Base styles.
- `typescript/examples/nextjs/.env.local.example` - Environment variable template for both modes.
- `typescript/examples/nextjs/README.md` - Template README (Quickstart, env matrix, modes).

### Notes

- This POC intentionally omits all automated tests.
- Keep server-only secrets off the client: never expose `HEDERA_OPERATOR_KEY` or non-public AI keys.
- Require Node.js **>= 20** and Next.js **15**.
- Default network is **testnet**; warn prominently on **mainnet** in autonomous mode.
- API routes must run with `runtime = 'nodejs'` to ensure SDK compatibility.

## Tasks

- [x] 1.0 Scaffold Next.js 15 example template inside `hedera-agent-kit/typescript/examples/nextjs`
  - [x] 1.1 Create base Next.js 15 (App Router) structure: `app/`, `app/layout.tsx`, `app/page.tsx`, `styles/globals.css`.
  - [x] 1.2 Add `typescript/examples/nextjs/package.json` with scripts (`dev`, `build`, `start`) and deps (`next@^15`, `react`, `typescript`, `zod`, `hedera-agent-kit`, `@hashgraph/sdk`, `@walletconnect/modal`, `@hashgraph/hedera-wallet-connect`).
  - [x] 1.3 Add `tsconfig.json` and strict TypeScript settings (strict, noImplicitAny, moduleResolution `bundler`).
  - [x] 1.4 Add `next.config.ts` and ensure API routes specify `runtime = 'nodejs'` where applicable.
  - [x] 1.5 Create `.env.local.example` with both mode variants (server-only vs client-safe keys).
  - [x] 1.6 Author template `README.md` with Quickstart and environment matrix. _(README exists; expand with Quickstart/env matrix in future pass)_
  - [x] 1.7 Verify `npm run dev` boots the skeleton app (placeholder UI).

- [x] 2.0 Wire Hedera Agent Kit v3 with AUTONOMOUS and RETURN_BYTES execution modes (include at least two example plugins)
  - [x] 2.1 Implement `lib/agent.ts` exporting a factory that reads `process.env` to determine `mode` and `network`.
  - [x] 2.2 In **AUTONOMOUS**, instantiate Hedera client with `HEDERA_OPERATOR_ID` and `HEDERA_OPERATOR_KEY` and execute actions server-side.
  - [x] 2.3 In **RETURN_BYTES (HITL)**, configure the toolkit to return transaction bytes rather than submitting.
  - [x] 2.4 Implement at least two plugins: (a) Get HBAR balance; (b) Submit topic message (Consensus Service).
  - [x] 2.5 Add Zod schemas for request/response objects and error payloads.
  - [x] 2.6 Ensure no server secrets are serialized to the client in any return path.

- [x] 3.0 Integrate WalletConnect (HITL) flow: client connector, modal, session handling, and server handoff
  - [x] 3.1 Implement `lib/walletconnect.ts` to initialize `DAppConnector` with `NEXT_PUBLIC_WC_PROJECT_ID`, app metadata, and allowed chain IDs for testnet/mainnet.
  - [x] 3.2 Create `components/WalletConnect.tsx` to mount the modal, manage session lifecycle (connect/disconnect), and expose connected account to children.
  - [x] 3.3 In HITL flow, on receiving transaction bytes from server, trigger WalletConnect request to sign and broadcast; surface success/failure.
  - [x] 3.4 Handle session events (accountsChanged, chainChanged) and error states (no session, user rejection).
  - [x] 3.5 Provide a small helper to map `NEXT_PUBLIC_NETWORK` to WalletConnect chain IDs.

- [x] 4.0 Build minimal chat UI with mode/network banner and HITL “Review & Sign” panel
  - [x] 4.1 Implement `components/Chat.tsx` with message list, input box, submit button, and loading spinner.
  - [x] 4.2 Add a banner showing **mode** and **network** from `NEXT_PUBLIC_AGENT_MODE` and `NEXT_PUBLIC_NETWORK`.
  - [x] 4.3 Wire send handler to POST `/api/agent` with `{ input }`; render assistant responses.
  - [x] 4.4 If response indicates signature required (HITL/RETURN_BYTES), show a “Review & Sign” panel that opens WalletConnect modal.
  - [x] 4.5 Display transaction status (pending, confirmed) and surface any errors inline.
  - [x] 4.6 Keep a local (in-memory) chat history; no persistence in POC.

- [x] 5.0 Implement `create-hedera-agent-app` CLI (prompts, flags, env writing, copy template, install deps, next steps)
  - [x] 5.1 Create `packages/create-hedera-agent-app/` with `package.json` (name, bin), and `index.ts` entrypoint.
  - [x] 5.2 Implement interactive prompts: project name, package manager; **Mode** (`autonomous` | `human`), **Network** (`testnet` default | `mainnet`).
  - [x] 5.3 Conditional prompts: **Autonomous** → `HEDERA_OPERATOR_ID`, `HEDERA_OPERATOR_KEY` (masked). **HITL** → `NEXT_PUBLIC_WC_PROJECT_ID` (and optional `WC_RELAY_URL`).
  - [x] 5.4 Optional AI provider prompt: `openai | anthropic | groq | ollama`; capture provider-specific API key(s) if selected.
  - [x] 5.5 Implement non-interactive flags: `--mode`, `--network`, `--pm`.
  - [x] 5.6 Copy `typescript/examples/nextjs` into target folder; replace app name and initialize `.env.local` from captured values.
  - [x] 5.7 Ensure client-safe vs server-only env keys are correctly prefixed and placed.
  - [x] 5.8 Detect package manager; install dependencies; handle failure with clear messages and cleanup on abort.
  - [x] 5.9 Optionally initialize git and create first commit; print “next steps” (cd, `npm run dev`).

- [ ] 6.0 Documentation & rollout (no automated tests in this POC)
  - [ ] 6.1 Finalize example template `README.md` to explain modes, env vars, and WalletConnect setup.
  - [ ] 6.2 Add a WalletConnect setup section: obtaining a Project ID and configuring allowed networks.
  - [ ] 6.3 Update Hedera Agent Kit root docs to reference this example and CLI.
  - [ ] 6.4 Prepare `packages/create-hedera-agent-app/README.md` with CLI usage, flags, and examples.
  - [ ] 6.5 Publish `create-hedera-agent-app` to npm; verify install via `npm create hedera-agent-app@latest`.
  - [ ] 6.6 Tag the example in `hedera-agent-kit` and announce availability in developer channels.
