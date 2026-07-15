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

Hedera supports two key types: **ECDSA (secp256k1)** and **ED25519**. These examples default to **ECDSA**. To switch to ED25519, uncomment the appropriate line in the agent's `.ts` file:

```ts
PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!)   // default
// PrivateKey.fromStringED25519(process.env.PRIVATE_KEY!)
```

Both constructors accept hex (`0x...`) and DER-encoded keys. DER-encoded ED25519 keys start with `302e...`; DER-encoded ECDSA keys start with `3030...`. The untyped `PrivateKey.fromString()` is deprecated — use the typed constructors instead. There is no reliable way to infer the key type from the string alone, so pick the constructor matching how the key was generated (the Hedera Portal shows the type). A mismatch is rejected by the network with `INVALID_SIGNATURE`. Note: the agent kit's built-in EVM/ERC tools currently require an ECDSA operator key; the Hedera EVM itself supports both key types.

See the Hedera docs on [Keys and Signatures](https://docs.hedera.com/hedera/core-concepts/keys-and-signatures#key-types:-ecdsa-vs-ed25519) and [Accounts and Keys (EVM)](https://docs.hedera.com/evm/differences/accounts-and-keys).




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
