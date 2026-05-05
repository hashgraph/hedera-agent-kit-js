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

/**
 * Get the ERC20 factory contract address from the HEDERA_ERC20_FACTORY_ADDRESS env var.
 * @throws Error if the env var is not set
 */
export function getERC20FactoryAddress(): string {
  const address = process.env.HEDERA_ERC20_FACTORY_ADDRESS;
  if (!address) {
    throw new Error(
      'HEDERA_ERC20_FACTORY_ADDRESS is not set. See packages/core-contracts/README.md for the deployed testnet address, or run `pnpm test:solo:deploy:contracts` for Solo.',
    );
  }
  return address;
}

/**
 * Get the ERC721 factory contract address from the HEDERA_ERC721_FACTORY_ADDRESS env var.
 * @throws Error if the env var is not set
 */
export function getERC721FactoryAddress(): string {
  const address = process.env.HEDERA_ERC721_FACTORY_ADDRESS;
  if (!address) {
    throw new Error(
      'HEDERA_ERC721_FACTORY_ADDRESS is not set. See packages/core-contracts/README.md for the deployed testnet address, or run `pnpm test:solo:deploy:contracts` for Solo.',
    );
  }
  return address;
}
