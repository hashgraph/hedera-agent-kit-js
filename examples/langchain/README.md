# Hedera Agent Kit - LangChain Examples

This directory contains examples of using the Hedera Agent Kit with LangChain (Classic).
For more information navigate to (DEVEXAMPLES.md)[https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/DEVEXAMPLES.md]

> [!IMPORTANT]
> **Migrating from v3 to v4?** Check out our [Migration Guide](../../docs/MIGRATION-v4.md).
> 
> **Note on Plugins:** Starting with v4, you must **explicitly pass all plugins** in the configuration. An empty plugin array will no longer result in all default tools being imported. For more details, see [Explicit Plugin Opt-In](https://github.com/hashgraph/hedera-agent-kit-js/blob/feat/release/16.04/docs/MIGRATION-v4.md#4-explicit-plugin-opt-in-behavioral-change).

## Setup

1. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in your credentials:
   ```bash
   cp .env.example .env
   ```

2. **Hedera Account**:
   You'll need a Hedera Testnet account. Get one at [portal.hedera.com](https://portal.hedera.com).

##### About Private Keys

Hedera supports both **ECDSA** and **ED25519** private keys. The examples use **ECDSA** by default. To use an **ED25519** key, uncomment the appropriate line in the agent's `.ts` file:

```ts
// PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!)
```

For more information about Hedera key types and formats, see the [Hedera documentation on Keys and Signatures](https://docs.hedera.com/hedera/core-concepts/keys-and-signatures#key-types:-ecdsa-vs-ed25519).




## Available Agents

### Tool Calling Agent
`npm run langchain:tool-calling-agent`
A basic agent that can natively call tools.

### Structured Chat Agent
`npm run langchain:structured-chat-agent`
An agent that uses a structured chat prompt.

### Return Bytes Agent (Human-in-the-Loop)
`npm run langchain:return-bytes-tool-calling-agent`
An agent that returns transaction bytes for manual signing/execution instead of executing them directly.

### Return Bytes Agent (Web / Robust Parsing)
`npm run langchain:return-bytes-tool-calling-agent-web`
A variant of the Return Bytes agent with robust parsing logic for handling various Buffer serialization formats (e.g. browser `Uint8Array`, JSON objects).
