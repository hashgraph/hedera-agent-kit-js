// Build a Hashscan explorer URL from either an explicit per-tool path
// (token, account, topic) or a transaction id. Returns null when neither
// signal is available so callers can suppress the link entirely.
export function buildHashscanUrl({
  network,
  transactionId,
  hashscanPath,
}) {
  const base = `https://hashscan.io/${network}`;
  if (hashscanPath) {
    return `${base}/${hashscanPath.replace(/^\/+/, "")}`;
  }
  if (transactionId) {
    return `${base}/transaction/${encodeURIComponent(transactionId)}`;
  }
  return null;
}
