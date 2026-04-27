import { LedgerId } from '@hiero-ledger/sdk';

const TESTNET_ERC20_FACTORY_ADDRESS = '0.0.6471814';
const TESTNET_ERC721_FACTORY_ADDRESS = '0.0.6510666'; // TODO: Update with actual deployed address
const LOCAL_NODE_LEDGER_ID = 'local-node';
const LOCAL_ERC20_FACTORY_ADDRESS_ENV = 'HEDERA_ERC20_FACTORY_ADDRESS';
const LOCAL_ERC721_FACTORY_ADDRESS_ENV = 'HEDERA_ERC721_FACTORY_ADDRESS';

type Environment = {
  process?: {
    env?: Record<string, string | undefined>;
  };
};

const getEnvironmentVariable = (name: string): string | undefined => {
  return (globalThis as typeof globalThis & Environment).process?.env?.[name];
};

const getConfiguredFactoryAddress = (
  ledgerId: LedgerId,
  addresses: Map<string, string>,
  localEnvironmentVariable: string,
  factoryName: string,
): string => {
  if (ledgerId.toString() === LOCAL_NODE_LEDGER_ID) {
    const localAddress = getEnvironmentVariable(localEnvironmentVariable);
    if (localAddress) {
      return localAddress;
    }
  }

  const address = addresses.get(ledgerId.toString());
  if (!address) {
    const localMessage =
      ledgerId.toString() === LOCAL_NODE_LEDGER_ID
        ? `. Set ${localEnvironmentVariable} to a factory contract deployed on the Solo network.`
        : '';
    throw new Error(
      `Network type ${ledgerId} not supported for ${factoryName} factory${localMessage}`,
    );
  }
  return address;
};

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
  return getConfiguredFactoryAddress(
    ledgerId,
    ERC20_FACTORY_ADDRESSES,
    LOCAL_ERC20_FACTORY_ADDRESS_ENV,
    'ERC20',
  );
}

/**
 * Get the ERC721 factory contract address for the specified network
 * @param ledgerId - The Hedera network ledger ID
 * @returns The factory contract address for the network
 * @throws Error if the network is not supported
 */
export function getERC721FactoryAddress(ledgerId: LedgerId): string {
  return getConfiguredFactoryAddress(
    ledgerId,
    ERC721_FACTORY_ADDRESSES,
    LOCAL_ERC721_FACTORY_ADDRESS_ENV,
    'ERC721',
  );
}
