# create-hedera-agent

Scaffold a Next.js 15 app wired with Hedera Agent Kit and WalletConnect.

> **Part of the Hedera Agent Kit:** This CLI tool initializes projects pre-configured with the core [`@hashgraph/hedera-agent-kit`](https://www.npmjs.com/package/@hashgraph/hedera-agent-kit) SDK.

## Usage

```bash
npm create hedera-agent@latest
```

Prompts will configure:
- Project name, package manager
- Mode: autonomous | human (HITL)
- Network: testnet | mainnet
- AI provider (required): openai | anthropic | groq | ollama, with respective credentials

Flags:
```bash
npm create hedera-agent@latest -- --mode autonomous --network testnet --pm npm
```

Node.js >= 20 required.
