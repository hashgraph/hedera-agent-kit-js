import { LedgerId } from '@hashgraph/sdk';

const TESTNET_ERC20_FACTORY_ADDRESS = '0.0.6471814';
const TESTNET_ERC721_FACTORY_ADDRESS = '0.0.6510666'; // TODO: Update with actual deployed address

// ERC20 Factory contract addresses for different networks
export const ERC20_FACTORY_ADDRESSES: Map<string, string> = new Map([
  [LedgerId.TESTNET.toString(), TESTNET_ERC20_FACTORY_ADDRESS], // Current testnet address
]);

// ERC721 Factory contract addresses for different networks
export const ERC721_FACTORY_ADDRESSES: Map<string, string> = new Map([
  [LedgerId.TESTNET.toString(), TESTNET_ERC721_FACTORY_ADDRESS], // Current testnet address
]);

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
 * Get the ERC20 factory contract address for the specified network
 * @param ledgerId - The Hedera network ledger ID
 * @returns The factory contract address for the network
 * @throws Error if the network is not supported
 */
export function getERC20FactoryAddress(ledgerId: LedgerId): string {
  const address = ERC20_FACTORY_ADDRESSES.get(ledgerId.toString());
  if (!address) {
    throw new Error(`Network type ${ledgerId} not supported for ERC20 factory`);
  }
  return address;
}

/**
 * Get the ERC721 factory contract address for the specified network
 * @param ledgerId - The Hedera network ledger ID
 * @returns The factory contract address for the network
 * @throws Error if the network is not supported
 */
export function getERC721FactoryAddress(ledgerId: LedgerId): string {
  const address = ERC721_FACTORY_ADDRESSES.get(ledgerId.toString());
  if (!address) {
    throw new Error(`Network type ${ledgerId} not supported for ERC721 factory`);
  }
  return address;
}
