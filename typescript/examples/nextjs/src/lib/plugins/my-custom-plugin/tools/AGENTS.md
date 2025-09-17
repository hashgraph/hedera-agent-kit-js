# AGENTS.md — Writing Tools (tools)

**Goal:** Teach coding agents to add or modify **tools** that the plugin exports.

A **tool** is a function factory `(ctx) => Tool` that returns:

- `method`: unique string (prefix with your plugin name)
- `name` and `description`: for humans/agents; include a **parameter table**
- `parameters`: **Zod** schema for inputs
- `execute(client, context, params)`: async handler

> Use Zod for parameter validation; give clear descriptions; respect **AgentMode** (AUTONOMOUS vs RETURN_BYTES). Route transactions through `handleTransaction` from `hedera-agent-kit` so the tx-mode strategy is applied consistently.

---

## Minimal skeleton

> **Adapt imports to your template’s types/exports.** Transaction tools should import `handleTransaction` from `hedera-agent-kit`; it encapsulates [`tx-mode-strategy`](https://github.com/hashgraph/hedera-agent-kit/blob/main/typescript/src/shared/strategies/tx-mode-strategy.ts) so AUTONOMOUS vs RETURN_BYTES stays consistent.

```ts
// tools/transfer-hbar.ts
import { z } from 'zod';
import { Client, AccountId, Hbar, TransferTransaction } from '@hashgraph/sdk';
import { handleTransaction } from 'hedera-agent-kit';
// Import your local Tool/Context types from this repo:
import type { Tool, AgentContext } from '../types'; // <— adjust path/names

export const TRANSFER_HBAR = 'yourplugin.transfer_hbar';

const paramsSchema = z.object({
  to: z.string().describe('Recipient Hedera AccountId, e.g. 0.0.1234'),
  amount: z.number().positive().describe('HBAR amount (whole HBAR)'),
  from: z.string().optional().describe('Sender AccountId; defaults to context.accountId'),
  memo: z.string().max(100).optional().describe('Optional transaction memo'),
});

export const transferHbarTool = (ctx: AgentContext): Tool => ({
  method: TRANSFER_HBAR,
  name: 'Transfer HBAR',
  description:
    `Transfer HBAR from an account to another.\n\n` +
    `Parameters:\n` +
    `- to (string, required) — recipient AccountId\n` +
    `- amount (number, required) — HBAR (not tinybars)\n` +
    `- from (string, optional) — defaults to context.accountId\n` +
    `- memo (string, optional) — up to 100 chars\n\n` +
    `Mode-aware via handleTransaction: AUTONOMOUS submits; RETURN_BYTES returns unsigned bytes.`,
  parameters: paramsSchema,

  execute: async (client: Client, context: AgentContext, params: z.infer<typeof paramsSchema>) => {
    const from = params.from ?? context.accountId;
    if (!from) {
      const msg = 'Missing sender: provide params.from or context.accountId';
      return { raw: { error: msg }, humanMessage: msg };
    }

    const tx = new TransferTransaction()
      .addHbarTransfer(AccountId.fromString(from), new Hbar(-params.amount))
      .addHbarTransfer(AccountId.fromString(params.to), new Hbar(params.amount))
      .setTransactionMemo(params.memo ?? '');

    // handleTransaction freezes + returns bytes in RETURN_BYTES mode, or executes + waits for a receipt in AUTONOMOUS mode.
    return handleTransaction(
      tx,
      client,
      context,
      ({ transactionId, status }) =>
        `Transfer ${params.amount} HBAR from ${from} to ${params.to} processed. Status: ${status}. (txId: ${transactionId}).`,
    );
  },
});
```

`handleTransaction` performs the mode-specific branching, freezes when necessary, and returns either the raw bytes or the execution result. The optional `postProcess` callback lets you craft a human-readable message once Hedera responds. See [`core-evm-plugin/tools/erc20/create-erc20.ts`](https://github.com/hashgraph/hedera-agent-kit/blob/main/typescript/src/plugins/core-evm-plugin/tools/erc20/create-erc20.ts) for a production example that follows this pattern.

## Read-only tool skeleton (queries; no modes needed)

```ts
// tools/get-account-balance.ts
import { z } from 'zod';
import { Client, AccountId, AccountBalanceQuery } from '@hashgraph/sdk';
import type { Tool, AgentContext } from '../types';

export const GET_HBAR_BALANCE = 'yourplugin.get_hbar_balance';

const paramsSchema = z.object({
  accountId: z.string().describe('AccountId to query, e.g. 0.0.1234'),
});

export const getHbarBalanceTool = (ctx: AgentContext): Tool => ({
  method: GET_HBAR_BALANCE,
  name: 'Get HBAR Balance',
  description: 'Return the HBAR balance of an account.',
  parameters: paramsSchema,

  execute: async (client: Client, _context: AgentContext, params: z.infer<typeof paramsSchema>) => {
    const { accountId } = params;
    try {
      const balance = await new AccountBalanceQuery()
        .setAccountId(AccountId.fromString(accountId))
        .execute(client);
      const hbars = balance.hbars.toString();
      return {
        raw: { hbars },
        humanMessage: `Account ${accountId} has ${hbars}.`,
      };
    } catch (err: any) {
      const humanMessage = `Failed to fetch balance: ${err?.message ?? 'unknown error'}`;
      return { raw: { error: humanMessage }, humanMessage };
    }
  },
});
```

## Tool registration

After creating a tool file:

1. Export it from tools/index.ts.
2. Add it to the plugin in src/index.ts inside the tools: (ctx) => [...] array.
3. Expose a \*ToolNames enum or constants so integrators can reference stable method strings.

## Quality bar

- Every parameter in Zod must have .describe() for self-documentation.
- Error messages should be single-sentence and actionable.
- Prefer return values over throwing in execute; agents consume humanMessage.
