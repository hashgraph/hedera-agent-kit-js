# Hedera Agent Kit - Contracts

Internal Hardhat project for developing, testing, and deploying ERC20/ERC721 factory smart contracts used by the SDK.

> **This is a private package (`@hashgraph/hedera-agent-kit-core-contracts`).** It is not published to npm. It is a development tool for contract maintainers only.

## What's here

| Contract | Purpose |
|---|---|
| `BaseERC20Factory.sol` | Deploys customizable ERC20 tokens (name, symbol, decimals, initial supply) |
| `BaseERC721Factory.sol` | Deploys customizable ERC721 NFT tokens (name, symbol, base URI) |
| `BaseERC20.sol` | ERC20 token implementation (deployed by the factory) |
| `BaseERC721.sol` | ERC721 token implementation (deployed by the factory) |

## How the SDK uses these contracts

These contracts are **deployed once per Hedera network**. The SDK then calls them by address:

1. Compiled ABIs are hardcoded in `../core/src/shared/constants/contracts.ts`
2. Deployed addresses are stored in the same file
3. SDK tools (`create_erc20_tool`, `create_erc721_tool`) call the factories on-chain

**End users never interact with this directory.** They use the SDK tools which call the pre-deployed contracts.

## Current deployments

| Network | ERC20 Factory | ERC721 Factory |
|---|---|---|
| Testnet | `0.0.6471814` | `0.0.6510666` |
| Mainnet | Not deployed | Not deployed |
| Previewnet | Not deployed | Not deployed |

## Development

```bash
# Install dependencies (uses npm, not pnpm)
npm install

# Run tests
npm test

# Deploy to a network
cp .env.example .env  # configure operator credentials
npm run deploy:testnet
```

After deploying, update the addresses and ABIs in `../core/src/shared/constants/contracts.ts`.
