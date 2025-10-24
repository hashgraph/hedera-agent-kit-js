// Configuration constants for SaucerSwap plugin
export const SAUCER_SWAP_CONFIG = {
  // Transaction timeouts
  DEFAULT_DEADLINE_SECONDS: 120, // 2 minutes
  MAX_DEADLINE_SECONDS: 1800,   // 30 minutes
  
  // Gas limits
  SWAP_GAS_LIMIT: 500_000,
  QUOTE_GAS_LIMIT: 150_000,
  
  // Slippage tolerance
  DEFAULT_SLIPPAGE_BPS: 300, // 3%
  MAX_SLIPPAGE_BPS: 1000,   // 10%
  
  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 1000,
} as const;

export const NETWORK_CONFIG = {
  MAINNET: {
    name: 'mainnet',
    timeout: 60000,
    maxAttempts: 10,
    maxBackoff: 5000,
  },
  TESTNET: {
    name: 'testnet', 
    timeout: 30000,
    maxAttempts: 5,
    maxBackoff: 3000,
  },
} as const;
