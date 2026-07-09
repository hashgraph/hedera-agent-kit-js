// Single source of truth for the network the app talks to. Server-side clients
// pick the Hedera network here; client-side components read the same value when
// building HashScan URLs. Switching to mainnet is a one-line edit.
export const HEDERA_NETWORK = "testnet";
