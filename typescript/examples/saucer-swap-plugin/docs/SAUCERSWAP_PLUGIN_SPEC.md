## SaucerSwap Plugin for Hedera Agent Kit (TypeScript)

This document specifies everything needed for an AI (or developer) to implement a SaucerSwap plugin for the Hedera Agent Kit JS (TypeScript) that enables swaps, liquidity operations, and protocol queries on Hedera.

### References

- Hedera Agent Kit (TS) repo: [`hedera-agent-kit-js/typescript`](https://github.com/hashgraph/hedera-agent-kit-js/tree/main/typescript)
- Hedera plugins guide: [`HEDERAPLUGINS.md`](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/HEDERAPLUGINS.md)
- Example plugin implementation: [`example-plugin.ts`](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/typescript/examples/plugin/example-plugin.ts)
- SaucerSwap documentation: [`docs.saucerswap.finance`](https://docs.saucerswap.finance/home)

### Objectives

- Provide a Hedera Agent Kit plugin exposing SaucerSwap capabilities:
  - Token swaps
  - Liquidity add/remove
  - Quotes and pool discovery
  - Utility actions: approvals, balances, metadata
- Conform to the Hedera Agent Kit plugin interface and conventions described in `HEDERAPLUGINS.md`.

### Deliverables

- Source under `src/plugins/saucerswap/` with:
  - `index.ts`: plugin entry and registration
  - `actions/`: action implementations by domain
  - `config.ts`: network addresses and defaults
  - `abi/`: ABIs for SaucerSwap Router/Factory/Pool, and any helper contracts
  - `utils/`: token math, slippage, formatting, allowances, routing helpers
- Example usage script(s) under `examples/` (swap and liquidity on testnet)
- README for the plugin with quickstart
- Tests: unit for utils and read functions; lightweight integration for testnet

### Plugin Shape and Registration

Follow the structure illustrated in the example plugin. The plugin must export a default factory that returns an object with metadata and an array/map of actions.

```ts
// src/plugins/saucerswap/index.ts
import { type Agent, type AgentAction, type AgentPlugin } from "@hashgraph/agent-kit"; // align with actual import paths in the kit
import { makeSaucerSwapActions } from "./actions";
import { saucerSwapConfig } from "./config";

export default function saucerSwapPlugin(userConfig?: Partial<typeof saucerSwapConfig>): AgentPlugin {
  const config = { ...saucerSwapConfig, ...userConfig };

  const actions: Record<string, AgentAction> = makeSaucerSwapActions(config);

  return {
    name: "saucerswap",
    version: "0.1.0",
    description: "SaucerSwap swaps, liquidity, and queries on Hedera",
    actions,
  };
}
```

See the example plugin for precise types and expected shapes: [`example-plugin.ts`](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/typescript/examples/plugin/example-plugin.ts). Align naming and typing with the Agent Kit version you use.

### Configuration

Provide network-specific constants and sane defaults. Fill in addresses from SaucerSwap docs (mainnet and testnet). Use placeholders initially and document where to source them.

```ts
// src/plugins/saucerswap/config.ts
export const saucerSwapConfig = {
  networks: {
    mainnet: {
      router: "<SAUCERSWAP_ROUTER_MAINNET>",
      factory: "<SAUCERSWAP_FACTORY_MAINNET>",
      wrappedHBAR: "<WHBAR_MAINNET>",
      defaultFeeTiersBps: [25, 30, 100], // example; verify with docs
    },
    testnet: {
      router: "<SAUCERSWAP_ROUTER_TESTNET>",
      factory: "<SAUCERSWAP_FACTORY_TESTNET>",
      wrappedHBAR: "<WHBAR_TESTNET>",
      defaultFeeTiersBps: [25, 30, 100],
    },
  },
  defaultSlippageBps: 50, // 0.50%
  defaultQuoteDeadlineSeconds: 600,
};
```

Populate addresses from SaucerSwap deployments and docs: [`docs.saucerswap.finance`](https://docs.saucerswap.finance/home).

### ABIs

Add ABIs under `src/plugins/saucerswap/abi/`:

- `Router.json`
- `Factory.json`
- `PairOrPool.json` (depending on AMM version)

Source them from SaucerSwap repositories or verified deployments referenced in the docs: [`docs.saucerswap.finance`](https://docs.saucerswap.finance/home). Ensure the ABI methods you need include:

- Swaps: exact-in and exact-out functions; native HBAR wrapping variants as needed
- Liquidity: add/remove functions
- Read: getAmountsOut, getAmountsIn (or equivalent), pool/pair queries, fee tiers

### Action Set

Implement actions with explicit input/output schema. Schemas can be simple Zod-like objects or JSON-schema compatible objects, depending on Agent Kit expectations in `HEDERAPLUGINS.md`.

Minimum viable set:

1) swapExactTokensForTokens

Inputs:

```ts
{
  network: "mainnet" | "testnet";
  tokenIn: string; // EVM address
  tokenOut: string; // EVM address
  amountIn: string; // bigint string
  slippageBps?: number;
  recipient?: string; // defaults to caller
  deadlineSeconds?: number; // from now
  preferFeeTiersBps?: number[]; // optional preference
}
```

Outputs:

```ts
{
  txId: string;
  route: string[]; // array of hop addresses
  amountOutMin: string;
  estimatedAmountOut: string;
  feeTiersBps?: number[];
}
```

2) swapTokensForExactTokens

Inputs:

```ts
{
  network: "mainnet" | "testnet";
  tokenIn: string;
  tokenOut: string;
  amountOut: string; // desired out
  maxSlippageBps?: number;
  recipient?: string;
  deadlineSeconds?: number;
  preferFeeTiersBps?: number[];
}
```

Outputs:

```ts
{
  txId: string;
  route: string[];
  amountInMax: string;
  estimatedAmountIn: string;
  feeTiersBps?: number[];
}
```

3) addLiquidity

Inputs:

```ts
{
  network: "mainnet" | "testnet";
  tokenA: string;
  tokenB: string;
  amountADesired: string;
  amountBDesired: string;
  amountAMin?: string;
  amountBMin?: string;
  recipient?: string;
  deadlineSeconds?: number;
  feeTierBps?: number; // if V2-style
}
```

Outputs:

```ts
{
  txId: string;
  liquidityMinted: string;
  amountA: string;
  amountB: string;
  poolAddress: string;
}
```

4) removeLiquidity

Inputs:

```ts
{
  network: "mainnet" | "testnet";
  tokenA: string;
  tokenB: string;
  liquidity: string; // LP amount
  amountAMin?: string;
  amountBMin?: string;
  recipient?: string;
  deadlineSeconds?: number;
  feeTierBps?: number;
}
```

Outputs:

```ts
{
  txId: string;
  amountA: string;
  amountB: string;
  poolAddress: string;
}
```

5) getQuote

Inputs:

```ts
{
  network: "mainnet" | "testnet";
  tokenIn: string;
  tokenOut: string;
  amountIn?: string; // for exact-in
  amountOut?: string; // for exact-out
  preferFeeTiersBps?: number[];
}
```

Outputs:

```ts
{
  estimatedAmountOut?: string;
  estimatedAmountIn?: string;
  route: string[];
  feeTiersBps?: number[];
}
```

6) getPoolInfo

Inputs:

```ts
{
  network: "mainnet" | "testnet";
  tokenA: string;
  tokenB: string;
  feeTierBps?: number;
}
```

Outputs:

```ts
{
  poolAddress?: string;
  exists: boolean;
  reserves?: { reserveA: string; reserveB: string };
  decimals: { tokenADecimals: number; tokenBDecimals: number };
}
```

7) approveIfNeeded (utility)

Inputs:

```ts
{
  network: "mainnet" | "testnet";
  token: string;
  spender: string; // typically router
  amount: string; // target allowance
}
```

Outputs:

```ts
{
  txId?: string; // only present if an approval was sent
  allowance: string;
  alreadySufficient: boolean;
}
```

### Implementation Notes

- Provider/signing: Use the Agent Kit’s provider and signer abstractions exposed to actions (see the example plugin). Do not reinstantiate providers; accept them from the Agent context.
- Addressing HTS/HSCS: Tokens on Hedera EVM may be native HTS tokens bridged via precompiles; validate decimals and allowances via ERC-20 interface where applicable. For HBAR, require wrapped HBAR when the Router expects ERC-20.
- Slippage and deadlines: Compute minOut/maxIn using slippage bps; set deadline as now + `deadlineSeconds`.
- Routing: Start with single-hop routing (direct pair), then extend to multi-hop discovery using Factory and common base tokens. Optionally probe multiple fee tiers.
- Idempotent approvals: Check current allowance; only submit approval when insufficient. Consider MaxUint for convenience if safe.
- Error messages: Return typed errors with actionable messages (e.g., "pool not found", "insufficient allowance for tokenIn").

### Utilities

Implement helpers under `utils/`:

- `amounts.ts`: parse/format amount strings, fetch decimals, compute slippage bounds
- `addresses.ts`: normalize and validate addresses
- `routing.ts`: find best direct or multi-hop routes, evaluate quotes
- `allowances.ts`: get allowance, approve if needed
- `tokens.ts`: read token metadata (symbol, name, decimals)

### Example Usage

```ts
import Agent from "@hashgraph/agent-kit"; // adjust to actual default export
import saucerSwapPlugin from "./src/plugins/saucerswap";

const agent = new Agent({ /* network/signing config */ });
agent.registerPlugin(saucerSwapPlugin({ /* optional overrides */ }));

// Quote
const quote = await agent.act("saucerswap.getQuote", {
  network: "testnet",
  tokenIn: "0x...",
  tokenOut: "0x...",
  amountIn: "1000000000000000000",
});

// Swap exact-in
const result = await agent.act("saucerswap.swapExactTokensForTokens", {
  network: "testnet",
  tokenIn: "0x...",
  tokenOut: "0x...",
  amountIn: "1000000000000000000",
  slippageBps: 50,
});
```

See the Agent Kit example plugin for how actions receive context and how to expose them to `agent.act`: [`example-plugin.ts`](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/typescript/examples/plugin/example-plugin.ts). For plugin authoring details, refer to: [`HEDERAPLUGINS.md`](https://github.com/hashgraph/hedera-agent-kit-js/blob/main/docs/HEDERAPLUGINS.md).

### Testing Strategy

- Unit tests for utilities (`amounts`, `routing`, `allowances`)
- Mocked read-only action tests for `getQuote` and `getPoolInfo`
- One end-to-end script on testnet to swap between two test tokens (document faucet/airdrop steps if applicable)

### Acceptance Criteria

- Plugin registers with Agent and exposes documented actions
- Read actions return expected data for known pools on testnet
- Swap action executes on testnet with proper approvals and slippage controls
- Liquidity add/remove actions succeed against an existing pool
- Clear, typed outputs and actionable error messages

### Security and Safety

- Validate all inputs (addresses, positive amounts, supported networks)
- Use slippage and deadlines by default; never execute unsafe swaps
- Limit approvals to required amounts unless configured otherwise

### Address and ABI Sourcing

- Obtain Router/Factory/Pool addresses and ABIs from SaucerSwap official docs and repositories: [`docs.saucerswap.finance`](https://docs.saucerswap.finance/home)
- Record them in `config.ts` for both mainnet and testnet and keep them centralized for easy maintenance

### Notes

- Keep TypeScript types explicit on exported surfaces
- Prefer readable code, early returns, and minimal nesting
- Avoid catching errors without meaningful handling; surface informative messages upward



