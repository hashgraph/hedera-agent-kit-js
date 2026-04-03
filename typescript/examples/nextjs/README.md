# Hedera Agent Kit Next.js Example

This is a [Next.js 15](https://nextjs.org/) template bootstrapped for the Hedera Agent Kit, supporting both **AUTONOMOUS** and **RETURN_BYTES (HITL)** execution modes.

## Quickstart

1. **Install dependencies:**

   ```bash
   npm install
   # or
   yarn
   # or
   pnpm install
   ```

2. **Copy and configure environment variables:**

   ```bash
   cp .env.local.example .env.local
   ```
Edit your `.env.local` to set your keys and mode:

| Variable                    | Mode       | Description                                 |
| --------------------------- | ---------- | ------------------------------------------- |
| `NEXT_PUBLIC_AGENT_MODE`    | all        | `autonomous` or `human` (RETURN_BYTES/HITL) |
| `NEXT_PUBLIC_NETWORK`       | all        | `testnet` (default) or `mainnet`            |
| `AI_PROVIDER`               | all        | AI provider (`openai`, `anthropic`, `groq`, or `ollama)` |
| `HEDERA_OPERATOR_ID`        | autonomous | Operator account ID (server only)           |
| `HEDERA_OPERATOR_KEY`       | autonomous | Operator private key (server only)          |
| `NEXT_PUBLIC_WC_PROJECT_ID` | human/HITL | WalletConnect Project ID (client safe)      |
| `WC_RELAY_URL`              | human/HITL | (Optional) Custom WalletConnect relay URL   |
| `OPENAI_API_KEY`            | optional   | (Optional) For OpenAI integration           |

> **Note:** Never expose `HEDERA_OPERATOR_KEY` or non-public AI keys to the client.

3. **Run the development server:**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Autonomous Mode: ECDSA Key Requirement

**If using autonomous mode**, you must use an **ECDSA private key** for `HEDERA_OPERATOR_KEY`. This application is set up only to use ECDSA keys for autonomous transaction signing.

### Getting Your ECDSA Key

1. Visit [https://portal.hedera.com](https://portal.hedera.com)
2. Create or access your Hedera account
3. Generate or retrieve your **ECDSA private key** (not ED25519)
4. The key format should be:
   - DER hex starting with `303002...` OR
   - 0x-prefixed 64-character hex string

> **Important:** It is possible to use ED25519 keys for autonomous mode, however, this example application is configured for ECDSA keys. If you want to use ED25519 you can update the `createHederaClient` function in `src/lib/agent-config.ts`

## Project Structure

```
nextjs/
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── agent/
│   │   │   │   └── route.ts        # Autonomous agent execution endpoint
│   │   │   └── wallet/
│   │   │       └── prepare/
│   │   │           └── route.ts    # Human-in-the-loop transaction preparation
│   │   ├── layout.tsx              # Root layout, global styles
│   │   ├── page.tsx                # Home page
│   │   ├── globals.css             # Base styles
│   │   └── favicon.ico
│   ├── components/
│   │   ├── Chat.tsx                # Main chat interface
│   │   ├── MessageInput.tsx        # Chat input
│   │   ├── MessageList.tsx         # Chat message list
│   │   ├── TransactionStatus.tsx   # Transaction status display
│   │   ├── WalletConnect.tsx       # WalletConnect integration
│   │   ├── WalletConnectClient.tsx # WalletConnect client wrapper
│   │   └── ui/                     # Reusable UI components (shadcn/ui)
│   ├── hooks/
│   │   ├── useAutoSign.ts          # Auto-signing hook (autonomous mode)
│   │   ├── useMessageSubmit.ts     # Chat submit handling
│   │   └── useWalletConnect.tsx    # WalletConnect lifecycle hook
│   ├── lib/
│   │   ├── agent-config.ts         # Agent bootstrap and toolkit configuration
│   │   ├── agent-factory.ts        # LLM/toolkit/agent executor factory
│   │   ├── api-utils.ts            # API helpers
│   │   ├── bytes-utils.ts          # Byte encoding/decoding helpers
│   │   ├── constants.ts            # App constants
│   │   ├── llm.ts                  # LLM integration
│   │   ├── schemas.ts              # Zod validation schemas
│   │   ├── utils.ts                # General utilities
│   │   └── walletconnect.ts        # WalletConnect setup
│   └── types/
│       └── index.ts                # App types
├── public/                         # Static assets
├── package.json                    # Scripts and dependencies
├── tsconfig.json                   # TypeScript configuration
├── next.config.ts                  # Next.js configuration
└── README.md                       # This file
```

## Included Dependencies

- `next@15`, `react@19`, `typescript`, `zod`
- `@hashgraph/hedera-agent-kit`, `@hashgraph/sdk`
- `@walletconnect/universal-provider`, `@hashgraph/hedera-wallet-connect`

## Requirements & Notes

- Requires **Node.js >= 20** and **Next.js 15**.
- Default network is **testnet**; mainnet use is discouraged for development.
- API routes must run with `runtime = 'nodejs'` for SDK compatibility.
- Keep server-only secrets off the client at all times.
- This template intentionally omits automated tests.

## Learn More

- [Hedera Agent Kit Documentation](https://github.com/hashgraph/hedera-agent-kit-js)
- [Next.js Documentation](https://nextjs.org/docs)
- [WalletConnect Docs](https://docs.walletconnect.com/)
