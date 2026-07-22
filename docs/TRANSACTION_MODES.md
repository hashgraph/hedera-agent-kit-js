# Transaction Signing and Execution Modes

This document describes the available transaction execution and signing modes in the Hedera Agent Kit (HAK) JS, their use cases, and how to implement custom or delegated signing strategies.

---

## 1. Overview of Modes

The transaction execution pipeline is governed by the `mode` parameter inside the request `Context`. HAK supports four transaction execution modes:

| Mode | signing Strategy | Execution Path | Key Use Case |
|---|---|---|---|
| `AgentMode.AUTONOMOUS` | Local Private Key (Operator) | Synchronous on-chain broadcast and receipt retrieval. | Local testing, autonomous agents, and scripts with self-custodied keys. |
| `AgentMode.RETURN_BYTES` | Out-of-band Client Wallet | Pipeline halts; returns serialized raw unsigned `Uint8Array` bytes to caller. | Stateless MCP servers, browser extensions, dApps, or frontend-mediated flows. |
| `AgentMode.CUSTOM_EXECUTE_TX` | Delegated Signing Strategy (`TransactionStrategy` → `ExecuteStrategyResult`) | Synchronous delegated signing (via TEE, MPC, API) and receipt retrieval. | Remote secure enclaves, MPC threshold signature networks, custodial APIs, or console-based HITL. |
| `AgentMode.CUSTOM_RETURN_BYTES` | Delegated Assembly Strategy (`TransactionStrategy` → `ReturnBytesStrategyResult`) | Strategy freezes and returns serialized bytes; no execution. | Multi-party / delegated-payer flows where the fee payer differs from the asset-owning subject. |

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
> In `RETURN_BYTES` mode, `accountId` is required in the `Context` when running **transaction tools**. It is needed to generate a transaction ID for the payer account before the bytes are frozen. Query tools do not require `accountId`.

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

## 4. Custom Execute Mode (`AgentMode.CUSTOM_EXECUTE_TX`)

Custom execute mode enables **synchronous delegated signing** within HAK. Instead of halting the tool flow (like `RETURN_BYTES`) or signing locally (like `AUTONOMOUS`), HAK delegates the signing step to a custom class implementing the `TransactionStrategy` interface. The strategy is expected to sign, execute, and return an `ExecuteStrategyResult` (`{ raw, humanMessage }`).

This is the recommended approach for integrating secure and institutional key-management systems, such as:
1. **Remote TEEs (Trusted Execution Environments)**: Sending transaction bytes to a secure enclave that verifies policies before signing.
2. **MPC (Multi-Party Computation) Services**: Performing threshold signing ceremonies out-of-band.
3. **API-guarded Custodial Signers**: Dispatching transactions to services like Fireblocks, Web3Auth, or AWS KMS.
4. **Human-in-the-Loop (HITL) Consoles**: Prompting developers or admins directly in the terminal to authorize transactions.

> [!NOTE]
> In `CUSTOM_EXECUTE_TX` mode, passing `accountId` in the `Context` is highly recommended. Most custom strategies require it to set the correct payer on the transaction before sending it to the remote service.

### Defining a Custom Strategy (Reference Implementation)

Below is a reference implementation of a custom strategy using a remote enclave/TEE endpoint:

```typescript
import { Client, Transaction } from '@hiero-ledger/sdk';
import { TransactionStrategy, RawTransactionResponse, Context } from '@hashgraph/hedera-agent-kit';

export class RemoteTeeSigningStrategy implements TransactionStrategy {
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

### Audit Trail Hooks in Custom Mode

Because a `CUSTOM_EXECUTE_TX` strategy returns `ExecuteStrategyResult`
(`{ raw: RawTransactionResponse, humanMessage: string }`), both `HcsAuditTrailHook` and `HolAuditTrailHook` work
identically in `CUSTOM_EXECUTE_TX` mode as they do in `AUTONOMOUS` mode. You can attach them directly to your context
without any additional configuration:

```typescript
import { HcsAuditTrailHook } from '@hashgraph/hedera-agent-kit/hooks';

const context: Context = {
  mode: AgentMode.CUSTOM_EXECUTE_TX,
  accountId: '0.0.12345',
  transactionStrategy: new RemoteTeeSigningStrategy('https://enclave.mycompany.com/sign', process.env.TEE_API_KEY!),
  hooks: [new HcsAuditTrailHook(['transfer_hbar'], '0.0.99999')],
};
```

> [!NOTE]
> The audit-trail hooks are **not** supported in `CUSTOM_RETURN_BYTES` mode (nor in `RETURN_BYTES`). Because no
> transaction is executed, there is no receipt to audit, so the hooks throw before the tool runs.

### Initializing HAK with Custom Execute Mode
To enable the custom strategy, register it in the `Context`:

```typescript
import { HederaAgentKit, AgentMode } from '@hashgraph/hedera-agent-kit';

const agent = new HederaAgentKit({
  client,
  configuration: {
    context: {
      mode: AgentMode.CUSTOM_EXECUTE_TX,
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

## 5. Custom Return-Bytes Mode (`AgentMode.CUSTOM_RETURN_BYTES`)

Custom return-bytes mode is the extensibility point for **multi-party / delegated-payer** flows. Like `RETURN_BYTES`,
the tool does not execute — but instead of the built-in `ReturnBytesStrategy` (which generates the transaction ID from a
single `context.accountId`), you supply a `TransactionStrategy` that assembles the transaction however you need and
returns `ReturnBytesStrategyResult` (`{ bytes: Uint8Array }`).

The canonical use case is **fee delegation**: a service (the *payer*) covers the HBAR transaction fee while the user
(the *subject*, `context.accountId`) remains the asset owner who must sign. The strategy sets the transaction ID from the
payer account so the payer is the named fee payer, freezes, and returns the bytes for the subject's wallet to sign
out-of-band. The payer identity is typically injected via the strategy constructor (it is static), while the subject is
read from `context.accountId`.

> [!NOTE]
> HAK does not implement the delegated-payer flow itself — `CUSTOM_RETURN_BYTES` is the sanctioned seam so you can build
> it in your own strategy with the correct return type and downstream handling (post-execution lookups are skipped and
> receipt-based audit hooks are rejected, exactly as in `RETURN_BYTES`).

### Defining a Delegated-Payer Strategy (Reference Sketch)

```typescript
import { AccountId, Client, Transaction, TransactionId } from '@hiero-ledger/sdk';
import { TransactionStrategy, ReturnBytesStrategyResult, Context } from '@hashgraph/hedera-agent-kit';

export class DelegatedPayerBytesStrategy implements TransactionStrategy<ReturnBytesStrategyResult> {
  // Payer (fee-covering service) is static → injected via the constructor.
  constructor(private payerAccountId: string) {}

  async handle(tx: Transaction, client: Client, context: Context): Promise<ReturnBytesStrategyResult> {
    if (!context.accountId) throw new Error('Subject accountId is required in context');

    // Name the payer (service) as the fee payer, while the subject (context.accountId) still owns the assets.
    tx.setTransactionId(TransactionId.generate(AccountId.fromString(this.payerAccountId)));
    tx.freezeWith(client);

    // Return unsigned bytes for the subject's wallet to sign out-of-band.
    // The submit side (add payer signature + execute) is a separate step in your app.
    return { bytes: tx.toBytes() };
  }
}
```

### Initializing HAK with Custom Return-Bytes Mode

```typescript
import { HederaAgentKit, AgentMode } from '@hashgraph/hedera-agent-kit';

const agent = new HederaAgentKit({
  client,
  configuration: {
    context: {
      mode: AgentMode.CUSTOM_RETURN_BYTES,
      accountId: '0.0.12345', // the subject (asset owner) who must sign
      transactionStrategy: new DelegatedPayerBytesStrategy('0.0.5000'), // the payer (service)
    },
    plugins: [...]
  }
});
```

---

## 6. Example Projects & References

For practical examples, check out:
- **LangChain Example**: [custom-signing-tool-calling-agent.ts](../examples/langchain/custom-signing-tool-calling-agent.ts) - An interactive human-in-the-loop CLI strategy built using standard prompts.
- **LangChain v1 (LangGraph) Example**: [custom-signing-tool-calling-agent.ts](../examples/langchain-v1/custom-signing-tool-calling-agent.ts) - Same console-based HITL strategy, integrated into a multi-turn LangGraph agent.
- **LangChain Delegated Payer Example**: [delegated-payer-bytes-agent.ts](../examples/langchain/delegated-payer-bytes-agent.ts) - `CUSTOM_RETURN_BYTES` strategy that stamps the user's account as fee payer and returns unsigned bytes for out-of-band signing.
- **LangChain v1 (LangGraph) Delegated Payer Example**: [delegated-payer-bytes-agent.ts](../examples/langchain-v1/delegated-payer-bytes-agent.ts) - Same delegated-payer pattern integrated into a multi-turn LangGraph agent.
