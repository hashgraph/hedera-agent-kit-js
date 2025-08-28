# create-hedera-agent

Scaffold a Next.js 15 app wired with Hedera Agent Kit and WalletConnect.

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
