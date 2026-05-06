import { ContractId } from '@hiero-ledger/sdk';

// ERC20 Factory contract ABI
export const ERC20_FACTORY_ABI = [
  'function deployToken(string memory name_, string memory symbol_, uint8 decimals_, uint256 initialSupply_) external returns (address)',
];

// ERC721 Factory contract ABI
export const ERC721_FACTORY_ABI = [
  'function deployToken(string memory name_, string memory symbol_, string memory baseURI_) external returns (address)',
];

export const ERC20_TRANSFER_FUNCTION_NAME = 'transfer';
export const ERC20_TRANSFER_FUNCTION_ABI = [
  'function transfer(address to, uint256 amount) external returns (bool)',
];

export const ERC721_TRANSFER_FUNCTION_NAME = 'transferFrom';
export const ERC721_TRANSFER_FUNCTION_ABI = [
  'function transferFrom(address from, address to, uint256 tokenId) external returns (bool)',
];

export const ERC721_MINT_FUNCTION_NAME = 'safeMint';
export const ERC721_MINT_FUNCTION_ABI = ['function safeMint(address to) external returns (bool)'];

// Deprecated testnet defaults retained for backwards compatibility; remove once
// HEDERA_ERC20_FACTORY_ADDRESS / HEDERA_ERC721_FACTORY_ADDRESS adoption is complete.
const TESTNET_ERC20_FACTORY_ADDRESS = '0.0.6471814';
const TESTNET_ERC721_FACTORY_ADDRESS = '0.0.6510666';

/**
 * Get the ERC20 factory contract address from the HEDERA_ERC20_FACTORY_ADDRESS env var.
 * Falls back to a deprecated hardcoded testnet address when the env var is unset
 * and HEDERA_NETWORK=testnet.
 * @throws Error if the env var is malformed, or unset on non-testnet networks
 */
export function getERC20FactoryAddress(): string {
  const address = process.env.HEDERA_ERC20_FACTORY_ADDRESS;

  if (address) {
    if (!isValidHederaContractId(address)) {
      throw new Error(
        `HEDERA_ERC20_FACTORY_ADDRESS is set to "${address}" which is not a valid Hedera contract ID. Expected format: 0.0.N (e.g., 0.0.6471814).`,
      );
    }

    return address;
  }

  if (process.env.HEDERA_NETWORK === 'testnet') {
    console.warn(
      '[deprecated] Falling back to hardcoded testnet ERC20 factory address. Set HEDERA_ERC20_FACTORY_ADDRESS to silence this warning. See packages/core-contracts/README.md.',
    );

    return TESTNET_ERC20_FACTORY_ADDRESS;
  }

  throw new Error(
    'HEDERA_ERC20_FACTORY_ADDRESS is not set. See packages/core-contracts/README.md for the deployed testnet address, or run `pnpm test:solo:deploy:contracts` for Solo.',
  );
}

/**
 * Get the ERC721 factory contract address from the HEDERA_ERC721_FACTORY_ADDRESS env var.
 * Falls back to a deprecated hardcoded testnet address when the env var is unset
 * and HEDERA_NETWORK=testnet.
 * @throws Error if the env var is malformed, or unset on non-testnet networks
 */
export function getERC721FactoryAddress(): string {
  const address = process.env.HEDERA_ERC721_FACTORY_ADDRESS;

  if (address) {
    if (!isValidHederaContractId(address)) {
      throw new Error(
        `HEDERA_ERC721_FACTORY_ADDRESS is set to "${address}" which is not a valid Hedera contract ID. Expected format: 0.0.N (e.g., 0.0.6510666).`,
      );
    }

    return address;
  }

  if (process.env.HEDERA_NETWORK === 'testnet') {
    console.warn(
      '[deprecated] Falling back to hardcoded testnet ERC721 factory address. Set HEDERA_ERC721_FACTORY_ADDRESS to silence this warning.',
    );

    return TESTNET_ERC721_FACTORY_ADDRESS;
  }

  throw new Error(
    'HEDERA_ERC721_FACTORY_ADDRESS is not set. See packages/core-contracts/README.md for the deployed testnet address, or run `pnpm test:solo:deploy:contracts` for Solo.',
  );
}

function isValidHederaContractId(value: string): boolean {
  try {
    ContractId.fromString(value);
    return true;
  } catch {
    return false;
  }
}