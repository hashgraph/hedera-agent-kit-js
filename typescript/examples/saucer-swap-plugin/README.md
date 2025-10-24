# SaucerSwap Plugin for Hedera Agent Kit

A plugin for the Hedera Agent Kit that enables SaucerSwap functionality including token swaps, liquidity operations, and protocol queries on Hedera.

## Features

- **Token Swaps**: Exact-in and exact-out token swaps with slippage protection
- **Liquidity Operations**: Add and remove liquidity from pools
- **Protocol Queries**: Get quotes, pool information, and token metadata
- **Utility Functions**: Token approvals, balance checks, and routing

## Installation

```bash
npm install saucer-swap-plugin
```

## Usage

```typescript
import { HederaAIToolkit, AgentMode } from "hedera-agent-kit";
import { saucerSwapPlugin } from "saucer-swap-plugin";

const hederaAgentToolkit = new HederaAIToolkit({
  client,
  configuration: {
    plugins: [saucerSwapPlugin],
    context: {
      mode: AgentMode.RETURN_BYTES,
    },
  },
});
```

The plugin provides the following tools that AI agents can use:

- **Swap Operations**: Execute token swaps with slippage protection
- **Liquidity Management**: Add and remove liquidity from pools  
- **Protocol Queries**: Get quotes, pool information, and token metadata
- **Utility Functions**: Handle approvals, balance checks, and token information

## Available Tools

### Currently Implemented
- `swap_exact_tokens_for_tokens_tool` - Swap exact amount of input tokens
- `swap_tokens_for_exact_tokens_tool` - Swap for exact amount of output tokens
- `get_quote_tool` - Get swap quote

### Planned Tools
- `add_liquidity_tool` - Add liquidity to a pool
- `remove_liquidity_tool` - Remove liquidity from a pool
- `get_pool_info_tool` - Get pool information
- `get_pools_tool` - List available pools
- `approve_if_needed_tool` - Approve token spending if needed
- `get_token_info_tool` - Get token metadata
- `get_balance_tool` - Get token balance

## Configuration

The plugin can be configured with network-specific addresses and defaults:

```typescript
import saucerSwapPlugin from "saucer-swap-plugin";

const plugin = saucerSwapPlugin({
  networks: {
    mainnet: {
      router: "0x...",
      factory: "0x...",
      wrappedHBAR: "0x...",
    },
    testnet: {
      router: "0x...",
      factory: "0x...",
      wrappedHBAR: "0x...",
    },
  },
  defaultSlippageBps: 50,
  defaultQuoteDeadlineSeconds: 600,
});
```

## Development

```bash
# Install dependencies
npm install

# Build the plugin
npm run build

# Run tests
npm test

# Lint code
npm run lint
```

## License

MIT
