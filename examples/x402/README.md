# Hedera Agent Kit + x402 Micropayments Example

This example demonstrates how to integrate **HTTP 402 ("Payment Required") micropayments** with the **Hedera Agent Kit** using `@x402/core` and `@x402/hedera`.

It covers the complete client-to-server lifecycle: gating autonomous agent actions and Model Context Protocol (MCP) tool executions behind cryptographic micropayments on Hedera (HBAR or custom tokens like USDC), settling transactions, executing Agent Kit tools, and returning verified HashScan explorer links.

```
┌──────────────┐         1. Request Tool Execution          ┌───────────────────────┐
│              ├───────────────────────────────────────────►│                       │
│              │◄───────────────────────────────────────────┤                       │
│    Client    │     2. HTTP 402 Payment Required           │      Server / MCP     │
│   (Wallet)   │        (Amount, PayTo, Nonce)              │                       │
│              ├───────────────────────────────────────────►│                       │
│              │     3. Submit Signed Payment Payload       │                       │
└──────┬───────┘                                            └───────────┬───────────┘
       │                                                                │
       │ 4. Settle / Verify                                             │ 5. Execute Tool
       ▼                                                                ▼
┌───────────────────────────────────────────────────────────────────────────────────┐
│                                Hedera Network / HCS                               │
│              • CryptoTransfer / TokenTransfer settled                             │
│              • submit_topic_message_tool / mint_fungible_token_tool executed       │
└───────────────────────────────────────────────────────────────────────────────────┘
```

---

## Architecture & End-to-End Flow (Steps 1–7)

The example implements the complete 7-step payment-gated lifecycle:

1. **Connect Wallet**: The client connects a Hedera wallet via WalletConnect (HashPack, Blade, Kabila) using `@hashgraph/hedera-wallet-connect` or initializes a `LocalClientHederaSigner` for automated testing.
2. **Trigger Protected Action**: The client requests execution of a high-value or rate-limited action (e.g., `submit_topic_message_tool` to publish an immutable log, or `mint_fungible_token_tool` to mint tokens).
3. **HTTP 402 Challenge**: The server responds with `402 Payment Required` with a standardized x402 payment challenge containing the recipient account, exact price (`amount`), asset ID (`0.0.0` for HBAR tinybars or token ID for USDC), and a cryptographically generated single-use `challengeNonce`.
4. **Sign Payment Payload**: The client's wallet constructs and signs an unexecuted or pre-signed Hedera `TransferTransaction` matching the challenge specifications.
5. **Verify & Settle Payment**: The server validates the transaction signature, payer account, recipient, amount, asset, and nonce validity against Hedera mirror nodes or the x402 facilitator.
6. **Execute Agent Kit Tools**: Upon confirmed payment, the server invokes the target Hedera Agent Kit tools (`submit_topic_message_tool`, `mint_fungible_token_tool`).
7. **Return HashScan Links**: The API returns verified HashScan links for all generated artifacts:
   - Payment Transaction Link: `https://hashscan.io/testnet/transaction/{txId}`
   - HCS Topic Link: `https://hashscan.io/testnet/topic/{topicId}`
   - Token Link: `https://hashscan.io/testnet/token/{tokenId}`
   - Account Link: `https://hashscan.io/testnet/account/{accountId}`

---

## Extended Scope: MCP Server & ReAct Agent Callbacks

### 1. x402 Payment-Gated MCP Server (`src/mcp/`)

This directory provides an express-based Model Context Protocol (MCP) server that gates tool calls behind micropayments.

- **`receipt-verifier.ts`**: Verifies settlement receipts before granting tool execution permissions. Checks receipt validity, replay protection, and expiration.
- **`x402-mcp-middleware.ts`**: Middleware intercepting MCP tool invocations (`tools/call`). If no valid payment receipt header is supplied, it interrupts execution and returns an MCP-compliant error containing an x402 payment challenge.
- **`hcs-gated-topic.ts`**: Manages payment-gated Hedera Consensus Service (HCS) topics. Requires micropayment per message published to an audit log topic.
- **`x402-gated-mcp-server.ts`**: Standalone runnable server exposing payment-gated tools:
  - `gated_submit_topic_message`: Publishes an immutable audit log to HCS after payment.
  - `gated_mint_fungible_token`: Mints supply of a token after paying creation/minting fees.

To run the MCP server:

```bash
npm run start:mcp
```

### 2. Async ReAct Agent Loop with Payment Callbacks (`src/agent/`)

Autonomous agents running multi-step reasoning loops (e.g. LangGraph or ReAct) often hit paywalls while executing tool chains.

- **`react-payment-agent.ts`**: Demonstrates a ReAct agent loop capable of pausing execution when an MCP tool returns an HTTP 402 challenge, dispatching an async payment request callback (e.g. to a human-in-the-loop wallet or an autonomous vault budget), and resuming the agent loop seamlessly once the receipt is signed and settled.

To test the agent loop:

```bash
npm run start:agent
```

---

## Troubleshooting Guide: Common Wild Errors

When integrating Hedera wallets with x402 micropayments, four common runtime errors frequently occur. This section details their root causes and resolutions:

### 1. HashPack "No applicable accounts"

- **Cause**: Occurs when the wallet is set to a different network (e.g. `mainnet`) than the dApp challenge (`testnet`), or when the account connected does not exist on the requested network.
- **Resolution**:
  - Ensure `NEXT_PUBLIC_NETWORK=testnet` matches the active network in your HashPack or Blade wallet.
  - In HashPack, open settings, verify the active network is set to **Testnet**, and confirm your account ID begins with `0.0.` on testnet.

### 2. Wallet Signing "list is locked"

- **Cause**: Occurs in `@hashgraph/hedera-wallet-connect` when multiple transaction signing requests are dispatched simultaneously before the wallet responds, or when a previous session is stuck in a pending pairing state.
- **Resolution**:
  - Ensure sequential execution of wallet signing calls; do not trigger concurrent signing promises on the same session.
  - Reset stale pairing sessions by calling `dAppConnector.disconnectAll()` before initiating a new pairing request.

### 3. x402 Settlement "TOKEN_NOT_ASSOCIATED_TO_ACCOUNT"

- **Cause**: When using custom fungible tokens (such as Testnet USDC `0.0.429274`) for micropayments, Hedera requires the recipient account to be explicitly associated with the token ID before it can receive funds.
- **Resolution**:
  - Associate the receiver account with the token ID prior to running the demo:
    ```typescript
    await new TokenAssociateTransaction()
      .setAccountId(receiverAccountId)
      .setTokenIds([tokenId])
      .execute(client);
    ```
  - For native HBAR micropayments (`asset: "0.0.0"`), no association is required.

### 4. Browser/API "The provided x402 payment could not be verified."

- **Cause**: Payment payload verification fails due to one of three conditions:
  1. The single-use `challengeNonce` was already used or expired (> 5 minute TTL).
  2. The transaction transferred fewer tinybars/units than the required challenge `amount`.
  3. The transfer recipient does not match the server's configured `payTo` account.
- **Resolution**:
  - Fetch a fresh challenge from `/api/x402/challenge` for each action.
  - Verify that your client transfer transfers the exact amount requested in the challenge to the exact `payTo` account.

---

## 8-Point Pre-Flight Checklist

Before deploying or demonstrating this example, verify the following 8 items:

- [ ] **1. Hedera Testnet Account**: You have a funded Testnet Account ID and Private Key from [portal.hedera.com](https://portal.hedera.com).
- [ ] **2. Testnet HBAR Balance**: Account has at least 10 HBAR for transaction fees and micropayments.
- [ ] **3. Receiver Account Configured**: `X402_RECEIVER_ACCOUNT_ID` is set to an active Hedera testnet account.
- [ ] **4. WalletConnect Project ID**: `NEXT_PUBLIC_WC_PROJECT_ID` is configured from [cloud.reown.com](https://cloud.reown.com).
- [ ] **5. Token Association (USDC)**: If testing custom token payments, the receiver account has associated the token ID.
- [ ] **6. HCS Topic Initialized**: An existing topic ID is provided in `HCS_TOPIC_ID` or operator keys have permissions to auto-create topics.
- [ ] **7. Mirror Node Connectivity**: The environment has internet connectivity to reach `testnet.mirrornode.hedera.com`.
- [ ] **8. Clean Environment**: Dependencies installed with `--legacy-peer-deps` or pnpm overrides.

---

## Quickstart

### 1. Install Dependencies

```bash
cd examples/x402
npm install --legacy-peer-deps
```

### 2. Configure Environment Variables

```bash
cp .env.example .env
```

Edit `.env` with your Hedera credentials:

```env
NEXT_PUBLIC_NETWORK=testnet
HEDERA_OPERATOR_ID=0.0.123456
HEDERA_OPERATOR_KEY=3030... # Private key
X402_RECEIVER_ACCOUNT_ID=0.0.789012
NEXT_PUBLIC_WC_PROJECT_ID=your_project_id
```

### 3. Run the Next.js Web Application

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the interactive demo, connect your wallet, trigger actions, view HTTP 402 challenges, sign payments, and inspect HashScan links.

### 4. Run Automated Smoke Tests

A comprehensive smoke test suite is included that exercises all 8 capabilities without requiring live wallet interaction:

```bash
npx tsx smoke-test.ts
```

Output:

```
======================================================================
  Hedera Agent Kit + x402 Micropayments Smoke Test Suite
======================================================================
[TEST 1] HashScan link formatters: PASS
[TEST 2] HTTP 402 challenge generation: PASS
[TEST 3] Client micropayment signing: PASS
[TEST 4] Server-side payment payload verification: PASS
[TEST 5] Hedera Agent Kit post-settlement execution: PASS
[TEST 6] MCP receipt verifier: PASS
[TEST 7] x402 payment-gated HCS topic manager: PASS
[TEST 8] Async ReAct agent loop with payment callbacks: PASS

8/8 tests passed successfully!
```

### 5. Run Unit Tests

```bash
npm test
```

Runs the Vitest test suite (`tests/unit/x402-flow.unit.test.ts`) validating challenge generation, rejection of insufficient transfers, signature validation, receipt replay prevention, and agent execution.

---

## Directory Structure

```
examples/x402/
├── .env.example                    # Environment template
├── package.json                    # Dependencies & scripts
├── tsconfig.json                   # TypeScript configuration
├── smoke-test.ts                   # 8-step smoke test suite
├── src/
│   ├── app/
│   │   ├── api/x402/challenge/     # HTTP 402 challenge API route
│   │   ├── api/x402/settle/        # Payment settlement & tool execution route
│   │   ├── layout.tsx              # Root layout
│   │   └── page.tsx                # Next.js UI dashboard
│   ├── components/
│   │   ├── PaymentDemo.tsx         # 7-step interactive payment walkthrough
│   │   └── TroubleshootingCard.tsx # Pre-flight checklist & wild error guide
│   ├── lib/
│   │   ├── agent-kit.ts            # Agent Kit tool execution wrapper
│   │   ├── hashscan.ts             # HashScan explorer URL formatters
│   │   ├── walletconnect-signer.ts # WalletConnect & Local Hedera signers
│   │   └── x402-server.ts          # Challenge generation & validation
│   ├── mcp/
│   │   ├── hcs-gated-topic.ts      # Payment-gated HCS topic manager
│   │   ├── receipt-verifier.ts     # Pre-execution receipt verification
│   │   ├── x402-gated-mcp-server.ts# Payment-gated MCP server
│   │   └── x402-mcp-middleware.ts  # Express MCP middleware
│   └── agent/
│       └── react-payment-agent.ts  # Async ReAct agent with payment callbacks
└── tests/
    └── unit/
        └── x402-flow.unit.test.ts  # Vitest unit test suite
```

---

## License

This example is licensed under the Apache-2.0 License, consistent with the `hedera-agent-kit-js` project.
