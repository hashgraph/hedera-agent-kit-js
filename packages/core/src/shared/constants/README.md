# Constants

This directory contains shared constants used throughout the Hedera Agent Kit.

## Contracts

The `contracts.ts` file contains contract-related constants and utilities:

### ERC20 Factory

- `ERC20_FACTORY_ADDRESSES`: Map of network-specific ERC20 factory contract addresses
- `ERC20_FACTORY_ABI`: ABI for the ERC20 factory contract
- `getERC20FactoryAddress(ledgerId)`: Utility function to get the factory address for a specific network

### Usage Example

```typescript
import { LedgerId } from '@hashgraph/sdk';
import { getERC20FactoryAddress, ERC20_FACTORY_ABI } from '@/shared/constants/contracts';

// Get factory address for testnet
const testnetAddress = getERC20FactoryAddress(LedgerId.TESTNET);

// Get factory address for mainnet
const mainnetAddress = getERC20FactoryAddress(LedgerId.MAINNET);
```

### Adding New Networks

To add support for a new network:

1. Add the network's factory address to `ERC20_FACTORY_ADDRESSES`
2. The `getERC20FactoryAddress` function will automatically support the new network

### Adding New Contract Types

To add constants for new contract types:

1. Create a new Map for contract addresses
2. Create a utility function to get the address based on LedgerId
3. Export the constants and utility function
4. Update this README with documentation
