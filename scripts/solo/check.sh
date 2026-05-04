#!/usr/bin/env bash
set -euo pipefail

CONSENSUS_NODE_ENDPOINT="127.0.0.1:35211"
CONSENSUS_NODE_ACCOUNT_ID="0.0.3"
MIRROR_NODE_ENDPOINT="127.0.0.1:5600"
MIRROR_NODE_REST_URL="${HEDERA_MIRROR_NODE_REST_URL:-http://127.0.0.1:38081/api/v1}"
JSON_RPC_RELAY_URL="${HEDERA_JSON_RPC_RELAY_URL:-http://127.0.0.1:37546}"
# Long-zero EVM address for Hedera system account 0.0.2 — exists on every Hedera
# network including a fresh Solo. Used as both `from` and `to` in the web3 probe;
# mirror's simulator runs the call (a no-op empty-calldata transfer) end-to-end
# and returns a 200 with a gas estimate. The same code path the relay forwards
# `eth_sendRawTransaction` simulation calls through.
SYSTEM_ACCOUNT_ADDRESS="0x0000000000000000000000000000000000000002"

ATTEMPTS=10
SLEEP_SECONDS=5

consensus_grpc_marker="·"
consensus_grpc_detail="not probed yet"
mirror_rest_marker="·"
mirror_rest_detail="not probed yet"
mirror_web3_marker="·"
mirror_web3_detail="not probed yet"
relay_marker="·"
relay_detail="not probed yet"

# Picks the available `timeout` binary, or empty string if none. macOS doesn't
# ship `timeout` by default; coreutils via Homebrew installs it as `gtimeout`.
TIMEOUT_BIN=""
if command -v timeout >/dev/null 2>&1; then
  TIMEOUT_BIN="timeout"
elif command -v gtimeout >/dev/null 2>&1; then
  TIMEOUT_BIN="gtimeout"
fi

# TCP-level liveness check using bash's built-in /dev/tcp redirection — no
# external deps. We don't speak gRPC here; just confirm the listener is up so
# SDK clients won't hang at connect time. When `timeout`/`gtimeout` is available
# we use it as a safety net for unroutable hosts; on localhost the kernel
# returns ECONNREFUSED instantly when nothing's listening, so the timeout is
# rarely needed in practice and skipping it is safe.
probe_tcp() {
  local endpoint="$1"
  local host="${endpoint%:*}"
  local port="${endpoint##*:}"
  if [[ -n "$TIMEOUT_BIN" ]]; then
    if "$TIMEOUT_BIN" 2 bash -c "</dev/tcp/${host}/${port}" 2>/dev/null; then
      return 0
    fi
  else
    if (bash -c "</dev/tcp/${host}/${port}") 2>/dev/null; then
      return 0
    fi
  fi
  return 1
}

probe_consensus_grpc() {
  if probe_tcp "${CONSENSUS_NODE_ENDPOINT}"; then
    consensus_grpc_marker="✓"
    consensus_grpc_detail="listening"
    return 0
  fi
  consensus_grpc_marker="✗"
  consensus_grpc_detail="not listening"
  return 1
}

probe_mirror_rest() {
  local err
  if err=$(curl --fail --silent --show-error --max-time 2 "${MIRROR_NODE_REST_URL}/network/nodes" 2>&1 >/dev/null); then
    mirror_rest_marker="✓"
    mirror_rest_detail="ready"
    return 0
  fi
  mirror_rest_marker="✗"
  mirror_rest_detail="${err:-no response}"
  return 1
}

# Probes mirror's web3 simulator — the endpoint the relay forwards
# `eth_sendRawTransaction` simulation calls to. The deploy step's 503s come from
# this exact endpoint (`/contracts/call`) being not-yet-warm even after mirror's
# REST listener and the relay are both up. Sends a no-op call (empty calldata,
# no value) between two well-known system addresses; mirror runs the simulation
# end-to-end and returns 200 with a gas estimate. Anything but 200 means the
# simulator isn't fully ready.
probe_mirror_web3() {
  local status
  status=$(curl --silent --output /dev/null --write-out '%{http_code}' --max-time 5 \
    -X POST -H 'Content-Type: application/json' \
    --data "{\"from\":\"${SYSTEM_ACCOUNT_ADDRESS}\",\"to\":\"${SYSTEM_ACCOUNT_ADDRESS}\",\"data\":\"0x\",\"estimate\":true}" \
    "${MIRROR_NODE_REST_URL}/contracts/call" 2>/dev/null) || status="000"
  if [[ "$status" == "200" ]]; then
    mirror_web3_marker="✓"
    mirror_web3_detail="ready"
    return 0
  fi
  mirror_web3_marker="✗"
  mirror_web3_detail="HTTP ${status} (simulator warming)"
  return 1
}

probe_relay() {
  local body block
  body=$(curl --silent --max-time 2 -X POST -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_blockNumber","params":[]}' \
    "${JSON_RPC_RELAY_URL}" 2>/dev/null) || {
    relay_marker="✗"
    relay_detail="no response"
    return 1
  }
  block=$(printf '%s' "$body" | jq -r '.result // empty' 2>/dev/null)
  if [[ -z "$block" ]]; then
    relay_marker="✗"
    relay_detail="json-rpc error: $(printf '%s' "$body" | jq -c '.error // .' 2>/dev/null || printf '%s' "$body")"
    return 1
  fi
  if [[ "$block" == "0x0" ]]; then
    relay_marker="✗"
    relay_detail="relay up but no blocks yet (pipeline warming)"
    return 1
  fi
  relay_marker="✓"
  relay_detail="ready (block=${block})"
  return 0
}

print_endpoints() {
  echo "  ${consensus_grpc_marker} Consensus node (gRPC) : ${CONSENSUS_NODE_ENDPOINT} (${CONSENSUS_NODE_ACCOUNT_ID})  (${consensus_grpc_detail})"
  # Mirror gRPC :5600 is a ClusterIP-only service in Solo's one-shot deploy — not
  # exposed to the host without an explicit `kubectl port-forward`. HCS topic
  # subscriptions need it, but our default local setup doesn't forward it, so we
  # don't probe it here. If you run HCS-subscription tests locally, add a
  # port-forward for svc/mirror-1-grpc:5600 manually.
  echo "  · Mirror node    (gRPC) : ${MIRROR_NODE_ENDPOINT}  (cluster-internal — not probed)"
  echo "  ${mirror_rest_marker} Mirror node    (REST) : ${MIRROR_NODE_REST_URL}/network/nodes  (${mirror_rest_detail})"
  echo "  ${mirror_web3_marker} Mirror node    (Web3) : ${MIRROR_NODE_REST_URL}/contracts/call  (${mirror_web3_detail})"
  echo "  ${relay_marker} JSON-RPC Relay        : ${JSON_RPC_RELAY_URL}  (eth_blockNumber: ${relay_detail})"
}

for ((attempt=1; attempt<=ATTEMPTS; attempt++)); do
  consensus_grpc_ok=true
  mirror_ok=true
  mirror_web3_ok=true
  relay_ok=true
  probe_consensus_grpc || consensus_grpc_ok=false
  probe_mirror_rest || mirror_ok=false
  # Only probe the simulator path once the basic mirror listener is up.
  if $mirror_ok; then
    probe_mirror_web3 || mirror_web3_ok=false
  else
    mirror_web3_marker="·"
    mirror_web3_detail="skipped (mirror REST not ready)"
    mirror_web3_ok=false
  fi
  probe_relay || relay_ok=false

  echo "Attempt ${attempt}/${ATTEMPTS}:"
  print_endpoints

  if $consensus_grpc_ok && $mirror_ok && $mirror_web3_ok && $relay_ok; then
    echo "Solo endpoints ready."
    exit 0
  fi
  if (( attempt < ATTEMPTS )); then
    sleep "${SLEEP_SECONDS}"
  fi
done

echo "Solo endpoints were not ready in time" >&2
print_endpoints >&2
exit 1
