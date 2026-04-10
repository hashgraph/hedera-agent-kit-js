/**
 * API endpoint constants for the Hedera Agent Kit Next.js example
 */

export const API_ENDPOINTS = {
  AGENT: "/api/agent",
  WALLET_PREPARE: "/api/wallet/prepare",
} as const;

export type ApiEndpoint = typeof API_ENDPOINTS[keyof typeof API_ENDPOINTS];