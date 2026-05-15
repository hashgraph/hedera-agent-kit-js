import { HEDERA_NETWORK } from "../utils/network";

// Read-only indicator of which Hedera network the app is connected to. The
// value is the module-level constant in `utils/network.ts`. Switching to
// mainnet is a one-line edit there.
export function ChatHederaNetworkBadge() {
  return (
    <span
      aria-label={`Hedera network: ${HEDERA_NETWORK}`}
      title={`Connected to Hedera ${HEDERA_NETWORK}`}
      className="bg-muted text-muted-foreground inline-flex h-8 items-center rounded-md px-3 text-xs font-medium"
    >
      {HEDERA_NETWORK}
    </span>
  );
}
