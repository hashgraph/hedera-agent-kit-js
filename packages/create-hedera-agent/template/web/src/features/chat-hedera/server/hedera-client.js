import { AccountId, Client, PublicKey } from "@hiero-ledger/sdk";

import { HEDERA_NETWORK } from "@/features/chat-hedera/utils/network";
import { parseOperatorKey } from "@/features/chat-hedera/utils/operator-key";

export function readEnv() {
  const operatorId = requireEnv("HEDERA_ACCOUNT_ID", process.env.HEDERA_ACCOUNT_ID);
  const operatorKey = requireEnv("HEDERA_PRIVATE_KEY", process.env.HEDERA_PRIVATE_KEY);
  const operatorPublicKey = parseOperatorKey(operatorKey).publicKey.toStringDer();
  return { operatorId, operatorKey, operatorPublicKey };
}

// Client bound to the operator's private key. Used in auto mode.
export function createHederaClient(env = readEnv()) {
  const client = clientForNetwork(HEDERA_NETWORK);
  client.setOperator(
    AccountId.fromString(env.operatorId),
    parseOperatorKey(env.operatorKey),
  );
  return client;
}

// Client used in human mode at the toolkit level: the kit needs a Client to
// freeze transactions and pick mirror nodes, but it never invokes a signer —
// `RETURN_BYTES` returns bytes instead of submitting. We attach a no-op signer
// via `setOperatorWith` so the SDK's "operator required" code paths are
// satisfied without a private key on the server.
export function createReturnBytesHederaClient(env = readEnv()) {
  const client = clientForNetwork(HEDERA_NETWORK);
  client.setOperatorWith(
    AccountId.fromString(env.operatorId),
    PublicKey.fromString(env.operatorPublicKey),
    async () => {
      throw new Error(
        "Human mode does not sign on the server. The transaction bytes are returned to the user for browser signing.",
      );
    },
  );
  return client;
}

// Client for the submit-signed endpoint: it only needs to broadcast a
// pre-signed transaction, so no operator at all.
export function createSubmitClient() {
  return clientForNetwork(HEDERA_NETWORK);
}

function clientForNetwork(network) {
  return network === "mainnet" ? Client.forMainnet() : Client.forTestnet();
}

function requireEnv(name, value) {
  if (!value) {
    throw new Error(
      `${name} is required. Set it in .env.local before starting the dev server.`,
    );
  }
  return value;
}
