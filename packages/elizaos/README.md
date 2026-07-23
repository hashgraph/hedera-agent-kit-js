# @hashgraph/hedera-agent-kit-elizaos

ElizaOS integration for Hedera Agent Kit. Wraps Hedera tools as ElizaOS Actions so they can be registered with the ElizaOS runtime.

> **Part of the Hedera Agent Kit:** This package is an adapter for the core [`@hashgraph/hedera-agent-kit`](https://www.npmjs.com/package/@hashgraph/hedera-agent-kit) SDK.

## Getting started

### 1. Install dependencies

```bash
npm install @hashgraph/hedera-agent-kit-elizaos @hashgraph/hedera-agent-kit @hiero-ledger/sdk @elizaos/core dotenv
```

### 2. Configure environment variables

Create a `.env` file:

```
ACCOUNT_ID=0.0.12345
PRIVATE_KEY=3030...
OPENAI_API_KEY=sk-...
```

Get your Hedera testnet keys at https://portal.hedera.com/dashboard. We recommend using the DER-encoded private key.

### 3. Register Hedera actions

```typescript
import 'dotenv/config';
import { Client, AccountId, PrivateKey } from '@hiero-ledger/sdk';
import { HederaElizaOSToolkit } from '@hashgraph/hedera-agent-kit-elizaos';
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

const toolkit = new HederaElizaOSToolkit({
  client,
  configuration: {
    plugins: [coreTokenPlugin, coreAccountPlugin, coreConsensusPlugin],
    context: { mode: AgentMode.AUTONOMOUS },
  },
});

// Get all Hedera tools as ElizaOS Actions
const actions = toolkit.getTools();

// Register actions with your ElizaOS runtime
// See https://github.com/hedera-dev/eliza-plugin-hedera for a full example
```

Each action uses LLM-based parameter extraction from user messages and validates inputs against tool schemas before executing transactions on Hedera.

## Execution modes

HAK supports three transaction execution modes — set `mode` in the `context` configuration:

- `AgentMode.AUTONOMOUS` — signs and broadcasts using the operator key on the client.
- `AgentMode.RETURN_BYTES` — returns unsigned transaction bytes for external signing.
- `AgentMode.CUSTOM_EXECUTE_TX` — delegates signing and execution to a pluggable `TransactionStrategy` (TEE, MPC, KMS API, or HITL console).
- `AgentMode.CUSTOM_RETURN_BYTES` — delegates assembly to a pluggable `TransactionStrategy` that returns bytes without executing (multi-party / delegated-payer flows).

See [docs/TRANSACTION_MODES.md](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/TRANSACTION_MODES.md) for full details.

## License

Apache-2.0
