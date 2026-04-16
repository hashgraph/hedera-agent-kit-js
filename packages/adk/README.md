# @hashgraph/hedera-agent-kit-adk

Google Agent Development Kit (ADK) integration for Hedera Agent Kit. Wraps Hedera tools as ADK tools so you can use them with Gemini and the ADK framework.

## Getting started

### 1. Install dependencies

```bash
npm install @hashgraph/hedera-agent-kit-adk @hashgraph/hedera-agent-kit @hiero-ledger/sdk @google/adk dotenv
```

### 2. Configure environment variables

Create a `.env` file:

```
ACCOUNT_ID=0.0.12345
PRIVATE_KEY=302e...
GEMINI_API_KEY=your-gemini-api-key
```

Get your Hedera testnet keys at https://portal.hedera.com/dashboard. We recommend using the DER-encoded private key.

### 3. Create an agent

```typescript
import 'dotenv/config';
import { Client, AccountId, PrivateKey } from '@hiero-ledger/sdk';
import { HederaADKToolkit } from '@hashgraph/hedera-agent-kit-adk';
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

const toolkit = new HederaADKToolkit({
  client,
  configuration: {
    plugins: [coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});

// toolkit.getTools() returns an array of ADK BaseTool objects
const tools = toolkit.getTools();
```

## License

Apache-2.0
