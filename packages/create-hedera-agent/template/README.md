# Hedera Agent Chat

A Next.js 15 chatbot wired with the [Hedera Agent Kit](https://github.com/hashgraph/hedera-agent-kit). Chat with an LLM that can read account state, create tokens, transfer HBAR, and submit topic messages on Hedera **testnet**.

## Getting started

### 1. Fill in `.env.local`

```env
# Hedera operator credentials
HEDERA_OPERATOR_ID=0.0.xxxx
HEDERA_OPERATOR_KEY=

# LLM API keys (set the one that matches LLM_PROVIDER below; leave the other blank)
OPENAI_API_KEY=
# ANTHROPIC_API_KEY=

# LLM provider & model
LLM_PROVIDER=openai
LLM_MODEL=gpt-4o-mini
```

| Variable              | Where to get it / what to set                                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `HEDERA_OPERATOR_ID`  | Create a testnet account at <https://portal.hedera.com>. Use the account ID shown after sign-in (`0.0.x` format).                                                                                                        |
| `HEDERA_OPERATOR_KEY` | Same portal. Reveal the **ECDSA** private key for that account and paste it here (DER hex starting `303002…` or `0x`-hex).                                                                                               |
| `OPENAI_API_KEY`      | Generate one at <https://platform.openai.com/api-keys>. Required when `LLM_PROVIDER=openai`.                                                                                                                             |
| `ANTHROPIC_API_KEY`   | Generate one at <https://console.anthropic.com/settings/keys>. Required when `LLM_PROVIDER=anthropic`.                                                                                                                   |
| `LLM_PROVIDER`        | Which provider to use: `openai` (default) or `anthropic`.                                                                                                                                                                |
| `LLM_MODEL`           | Which model to use. Examples by provider — **openai:** `gpt-4o-mini` (default), `gpt-4o`, `gpt-4.1-mini`. **anthropic:** `claude-haiku-4-5` (default), `claude-sonnet-4-6`, `claude-opus-4-7`. Leave blank for default. |

### 2. Install dependencies

```bash
npm install
```

### 3. Run the dev server

```bash
npm run dev
```

Open <http://localhost:3000>.

## Chat features

- **Hedera tools** wired through the Agent Kit: account balances, token info, token creation, HBAR transfers, topic creation, topic messages, NFT transfers, and recent-transaction lookups.
- **Auto / Human mode** toggle in the header (persisted in `localStorage`):
  - **Auto** signs and submits with the server-side operator key.
  - **Human** routes every mutating tool through the in-browser wallet drawer for explicit approval.
- **Wallet signing** in human mode: the drawer slides in from the right with each pending request and signs locally on Approve, then posts the signed bytes to `/api/transactions/submit-signed` for broadcast.
- **Transaction preview** before you sign: every approval card lists the tool name and a humanized summary of the inputs (recipients, amounts, token symbols, topic ids, etc.) so you see exactly what's about to happen.
- **Hashscan links** on every confirmed transaction so you can verify the on-chain result in one click.

The wallet drawer signs locally with the operator key the server hands over at page load. That's a **simulation** for development. For production, replace `<ChatWalletProvider>`'s `signer` prop with a real wallet integration (WalletConnect, HashPack, etc.) so the key never leaves the user's device.
