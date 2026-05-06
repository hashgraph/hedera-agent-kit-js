# Hedera Agent Kit - Contracts

Internal Hardhat project for developing, testing, and deploying ERC20/ERC721 factory smart contracts used by the SDK.

> **This is a private package (`@hashgraph/hedera-agent-kit-core-contracts`).** It is not published to npm. It is a development tool for contract maintainers only.

## What's here

| Contract                | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `BaseERC20Factory.sol`  | Deploys customizable ERC20 tokens (name, symbol, decimals, initial supply) |
| `BaseERC721Factory.sol` | Deploys customizable ERC721 NFT tokens (name, symbol, base URI)            |
| `BaseERC20.sol`         | ERC20 token implementation (deployed by the factory)                       |
| `BaseERC721.sol`        | ERC721 token implementation (deployed by the factory)                      |

## How the SDK uses these contracts

These contracts are **deployed once per Hedera network**. The SDK then calls them by address:

1. Compiled ABIs are hardcoded in `../core/src/shared/constants/contracts.ts`
2. Deployed addresses are kept in `ERC20_FACTORY_ADDRESSES` / `ERC721_FACTORY_ADDRESSES` maps in the same file, keyed by `LedgerId` (the SDK derives the network from `client.ledgerId`)
3. SDK tools (`create_erc20_tool`, `create_erc721_tool`) call the factories on-chain

**End users never interact with this directory.** They use the SDK tools which call the pre-deployed contracts.

## Current deployments

| Network    | ERC20 Factory | ERC721 Factory |
| ---------- | ------------- | -------------- |
| Testnet    | `0.0.6471814` | `0.0.6510666`  |
| Local-node | `0.0.1012`    | `0.0.1013`     |
| Mainnet    | Not deployed  | Not deployed   |
| Previewnet | Not deployed  | Not deployed   |

The local-node addresses are the deterministic IDs assigned by Solo when the factories are deployed as the first contracts on a fresh network (`pnpm test:solo:up`).

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

After deploying, update the address row in the table above.

For Solo/localnet testing, deploy factories against the local JSON-RPC relay and export the printed addresses:

```bash
HEDERA_PRIVATE_KEY=0x105d050185ccb907fba04dd92d8de9e32c18305e097ab41dadda21489a211524 npm run deploy:solo
```

The command prints the resulting `0.0.X` ERC20 and ERC721 factory contract IDs. Update the `ERC20_FACTORY_ADDRESSES` / `ERC721_FACTORY_ADDRESSES` maps in `packages/core/src/shared/constants/contracts.ts` if the addresses change.
