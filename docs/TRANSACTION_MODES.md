# Transaction Signing and Execution Modes

This document describes the available transaction execution and signing modes in the Hedera Agent Kit (HAK) JS, their use cases, and how to implement custom or delegated signing strategies.

---

## 1. Overview of Modes

The transaction execution pipeline is governed by the `mode` parameter inside the request `Context`. HAK supports three transaction execution modes:

| Mode | signing Strategy | Execution Path | Key Use Case |
|---|---|---|---|
| `AgentMode.AUTONOMOUS` | Local Private Key (Operator) | Synchronous on-chain broadcast and receipt retrieval. | Local testing, autonomous agents, and scripts with self-custodied keys. |
| `AgentMode.RETURN_BYTES` | Out-of-band Client Wallet | Pipeline halts; returns serialized raw unsigned `Uint8Array` bytes to caller. | Stateless MCP servers, browser extensions, dApps, or frontend-mediated flows. |
| `AgentMode.CUSTOM` | Delegated Signing Strategy (`TxModeStrategy`) | Synchronous delegated signing (via TEE, MPC, API) and receipt retrieval. | Remote secure enclaves, MPC threshold signature networks, custodial APIs, or console-based HITL. |

---

## 2. Autonomous Mode (`AgentMode.AUTONOMOUS`)

This is the default mode. The agent initializes a Hedera client with an operator account and private key. When a transaction tool is called, HAK signs the transaction locally and broadcasts it to the network.

### Configuration
```typescript
import { HederaAgentKit, AgentMode } from '@hashgraph/hedera-agent-kit';
import { Client, PrivateKey } from '@hiero-ledger/sdk';

const client = Client.forTestnet().setOperator(
  process.env.ACCOUNT_ID!,
  PrivateKey.fromStringECDSA(process.env.PRIVATE_KEY!)
);

const agent = new HederaAgentKit({
  client,
  configuration: {
    context: {
      mode: AgentMode.AUTONOMOUS,
      accountId: process.env.ACCOUNT_ID!
    },
    plugins: [...]
  }
});
```

---

## 3. Return Bytes Mode (`AgentMode.RETURN_BYTES`)

In this mode, HAK builds and freezes the transaction using the user's `accountId` but does **not** sign or execute it. Instead, the tool execution returns the serialized transaction bytes (`Uint8Array`) inside the raw envelope.

This is highly useful for stateless servers (like MCP servers) where the agent is running in the cloud and does not have access to the user's private keys. The calling application receives the bytes, signs them using a local wallet (e.g. MetaMask, HashPack, or a local file key), and broadcasts them.

> [!IMPORTANT]
> In `RETURN_BYTES` mode, `accountId` is strictly required in the `Context` on initialization. HAK validates this on initialization and throws an error if it is missing, as it is needed to generate transaction IDs for the payer account.

### Code Example: Client-Side execution of returned bytes
```typescript
// 1. Tool call output contains the bytes
const toolResult = await myAgent.invokeTool('transfer_hbar_tool', params);
const bytes = toolResult.raw.bytes; // Uint8Array

if (bytes) {
  // 2. Client-side app signs and executes the transaction
  const tx = Transaction.fromBytes(bytes);
  const result = await tx.execute(localHumanClient);
  const receipt = await result.getReceipt(localHumanClient);
  console.log(`Transaction broadcast successfully. Status: ${receipt.status}`);
}
```

---

## 4. Custom Mode (`AgentMode.CUSTOM`)

Custom mode enables **synchronous delegated signing** within HAK. Instead of halting the tool flow (like `RETURN_BYTES`) or signing locally (like `AUTONOMOUS`), HAK delegates the signing step to a custom class implementing the `TxModeStrategy` interface.

This is the recommended approach for integrating secure and institutional key-management systems, such as:
1. **Remote TEEs (Trusted Execution Environments)**: Sending transaction bytes to a secure enclave that verifies policies before signing.
2. **MPC (Multi-Party Computation) Services**: Performing threshold signing ceremonies out-of-band.
3. **API-guarded Custodial Signers**: Dispatching transactions to services like Fireblocks, Web3Auth, or AWS KMS.
4. **Human-in-the-Loop (HITL) Consoles**: Prompting developers or admins directly in the terminal to authorize transactions.

> [!NOTE]
> In `CUSTOM` mode, passing `accountId` in the `Context` is highly recommended. Most custom strategies (such as the built-in `HttpSigningStrategy`) require it to set the correct payer on the transaction before sending it to the remote service.

### Defining a Custom Strategy (Reference Implementation)

Below is a reference implementation of a custom strategy using a remote enclave/TEE endpoint:

```typescript
import { Client, Transaction } from '@hiero-ledger/sdk';
import { TxModeStrategy, RawTransactionResponse, Context } from '@hashgraph/hedera-agent-kit';

export class RemoteTeeSigningStrategy implements TxModeStrategy {
  constructor(private enclaveEndpoint: string, private apiKey: string) {}

  async handle(
    tx: Transaction,
    client: Client,
    context: Context,
    postProcess?: (response: RawTransactionResponse) => string
  ) {
    if (!context.accountId) throw new Error('Account ID is required');

    // 1. Freeze the transaction to compile stable bytes
    tx.freezeWith(client);
    const txBytes = tx.toBytes();

    // 2. Post transaction bytes to TEE/Enclave endpoint
    const response = await fetch(this.enclaveEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`
      },
      body: JSON.stringify({ transactionBytes: Buffer.from(txBytes).toString('base64') })
    });

    if (!response.ok) {
      throw new Error(`Remote enclave rejected signing request: ${await response.text()}`);
    }

    const { signedBytes } = await response.json();

    // 3. Reconstruct signed transaction and execute
    const signedTx = Transaction.fromBytes(Buffer.from(signedBytes, 'base64'));
    const submit = await signedTx.execute(client);
    const receipt = await submit.getReceipt(client);

    // 4. Return formatted response
    const rawResponse: RawTransactionResponse = {
      status: receipt.status.toString(),
      accountId: receipt.accountId,
      tokenId: receipt.tokenId,
      transactionId: signedTx.transactionId?.toString() ?? '',
      topicId: receipt.topicId,
      scheduleId: receipt.scheduleId,
    };

    return {
      raw: rawResponse,
      humanMessage: postProcess ? postProcess(rawResponse) : JSON.stringify(rawResponse),
    };
  }
}
```

### Initializing HAK with Custom Mode
To enable the custom strategy, register it in the `Context`:

```typescript
import { HederaAgentKit, AgentMode } from '@hashgraph/hedera-agent-kit';

const agent = new HederaAgentKit({
  client,
  configuration: {
    context: {
      mode: AgentMode.CUSTOM,
      accountId: '0.0.12345',
      transactionStrategy: new RemoteTeeSigningStrategy(
        'https://enclave.mycompany.com/sign',
        process.env.TEE_API_KEY!
      )
    },
    plugins: [...]
  }
});
```

---

## 5. Built-in HTTP Strategy

For basic delegated signing gateways, HAK provides `HttpSigningStrategy` out-of-the-box. It manages freezing, encoding (base64 or hex), network dispatching, parsing, and execution.

```typescript
import { HederaAgentKit, AgentMode, HttpSigningStrategy } from '@hashgraph/hedera-agent-kit';

const agent = new HederaAgentKit({
  client,
  configuration: {
    context: {
      mode: AgentMode.CUSTOM,
      accountId: '0.0.12345',
      transactionStrategy: new HttpSigningStrategy({
        endpoint: 'https://kms-api.mycompany.internal/sign-tx',
        headers: {
          'X-KMS-Auth-Token': process.env.KMS_AUTH_TOKEN!
        },
        encoding: 'base64'
      })
    },
    plugins: [...]
  }
});
```

---

## 6. Example Projects & References

For practical examples, check out:
- **LangChain Example**: [custom-signing-tool-calling-agent.ts](file:///Users/stanislawkurzyp/Documents/arianelabs/hedera-agent-kit-js/examples/langchain/custom-signing-tool-calling-agent.ts) - An interactive human-in-the-loop CLI strategy built using standard prompts.
- **LangChain v1 (LangGraph) Example**: [custom-signing-tool-calling-agent.ts](file:///Users/stanislawkurzyp/Documents/arianelabs/hedera-agent-kit-js/examples/langchain-v1/custom-signing-tool-calling-agent.ts) - Same console-based HITL strategy, integrated into a multi-turn LangGraph agent.
