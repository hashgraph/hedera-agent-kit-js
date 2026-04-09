# @hashgraph/hedera-agent-kit-ai-sdk

Vercel AI SDK integration for Hedera Agent Kit. Wraps Hedera tools as Vercel AI SDK tools so you can use them with `generateText()` and any AI SDK-compatible model.

## Getting started

### 1. Install dependencies

```bash
npm install @hashgraph/hedera-agent-kit-ai-sdk @hashgraph/hedera-agent-kit @hashgraph/sdk @ai-sdk/openai dotenv
```

### 2. Configure environment variables

Create a `.env` file:

```
ACCOUNT_ID=0.0.12345
PRIVATE_KEY=302e...
OPENAI_API_KEY=sk-...
```

Get your Hedera testnet keys at https://portal.hedera.com/dashboard. We recommend using the DER-encoded private key.

### 3. Create an agent

```typescript
import 'dotenv/config';
import { Client, AccountId, PrivateKey } from '@hashgraph/sdk';
import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';
import { HederaAIToolkit } from '@hashgraph/hedera-agent-kit-ai-sdk';
import {
  coreTokenPlugin,
  coreAccountPlugin,
  coreConsensusPlugin,
} from '@hashgraph/hedera-agent-kit/plugins';
import { AgentMode } from '@hashgraph/hedera-agent-kit';

const client = Client.forTestnet();
client.setOperator(
  AccountId.fromString(process.env.ACCOUNT_ID!),
  PrivateKey.fromStringDer(process.env.PRIVATE_KEY!),
);

const toolkit = new HederaAIToolkit({
  client,
  configuration: {
    plugins: [coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});

const response = await generateText({
  model: openai('gpt-4o'),
  tools: toolkit.getTools(),
  prompt: 'Create a new Hedera account',
});

console.log(response.text);
```

## License

Apache-2.0
