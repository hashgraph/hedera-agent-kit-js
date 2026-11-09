/**
 * HashScan link formatting utilities for Hedera mainnet and testnet.
 */

export type HederaNetwork = 'testnet' | 'mainnet';

/**
 * Normalizes Hedera transaction ID to the HashScan URL format.
 * Converts "0.0.1234@1700000000.000000000" into "0.0.1234-1700000000-000000000".
 */
export function formatTxIdForHashScan(txId: string): string {
  if (!txId) return '';
  return txId.replace('@', '-').replace(/\.(\d{9})$/, '-$1');
}

export function getHashScanTxLink(txId: string, network: HederaNetwork = 'testnet'): string {
  const formatted = formatTxIdForHashScan(txId);
  const base =
    network === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';
  return `${base}/transaction/${formatted}`;
}

export function getHashScanTopicLink(topicId: string, network: HederaNetwork = 'testnet'): string {
  const base =
    network === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';
  return `${base}/topic/${topicId}`;
}

export function getHashScanTokenLink(tokenId: string, network: HederaNetwork = 'testnet'): string {
  const base =
    network === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';
  return `${base}/token/${tokenId}`;
}

export function getHashScanAccountLink(
  accountId: string,
  network: HederaNetwork = 'testnet',
): string {
  const base =
    network === 'mainnet' ? 'https://hashscan.io/mainnet' : 'https://hashscan.io/testnet';
  return `${base}/account/${accountId}`;
}
