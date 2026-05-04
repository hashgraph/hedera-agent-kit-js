#!/usr/bin/env bash
set -euo pipefail

CONSENSUS_NODE_ENDPOINT="127.0.0.1:35211"
CONSENSUS_NODE_ACCOUNT_ID="0.0.3"
MIRROR_NODE_ENDPOINT="127.0.0.1:5600"
MIRROR_NODE_REST_URL="${HEDERA_MIRROR_NODE_REST_URL:-http://127.0.0.1:38081/api/v1}"
JSON_RPC_RELAY_URL="${HEDERA_JSON_RPC_RELAY_URL:-http://127.0.0.1:37546}"

ATTEMPTS=10
SLEEP_SECONDS=5

mirror_rest_marker="·"
mirror_rest_detail="not probed yet"
relay_marker="·"
relay_detail="not probed yet"
relay_exec_marker="·"
relay_exec_detail="not probed yet"

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

# Probes the relay's contract-creation simulation path — the same code path
# used by contract deploys (e.g. `BaseERC20Factory.deploy()` in
# deploy-factories.ts). Sends `eth_estimateGas` for a minimal CREATE (init code
# `0x60006000f3` = "PUSH1 0 PUSH1 0 RETURN", a valid contract that deploys to
# empty bytecode). The relay must execute the init code in its EVM simulator,
# which fans out to the mirror-node service for state.
#
# A 503-shaped error means the simulator's downstream isn't ready — fail.
# A gas estimate or any clean domain error means the path is alive — pass.
# (Probing a precompile address would short-circuit inside the relay and not
# exercise the simulator, so it's avoided.)
probe_relay_execution() {
  local body
  body=$(curl --silent --max-time 5 -X POST -H 'Content-Type: application/json' \
    --data '{"jsonrpc":"2.0","id":1,"method":"eth_estimateGas","params":[{"data":"0x60006000f3"}]}' \
    "${JSON_RPC_RELAY_URL}" 2>/dev/null) || {
    relay_exec_marker="✗"
    relay_exec_detail="no response"
    return 1
  }
  # Look for downstream-service failure markers in the response body.
  if printf '%s' "$body" | grep -qE 'status code 5[0-9]{2}|Service Unavailable|ECONNREFUSED'; then
    relay_exec_marker="✗"
    relay_exec_detail="downstream not ready: $(printf '%s' "$body" | jq -c '.error // .' 2>/dev/null || printf '%s' "$body")"
    return 1
  fi
  # Any other well-formed JSON-RPC response (success OR a clean domain error) means
  # the relay's execution path is alive.
  if printf '%s' "$body" | jq -e '.result // .error' >/dev/null 2>&1; then
    relay_exec_marker="✓"
    relay_exec_detail="ready"
    return 0
  fi
  relay_exec_marker="✗"
  relay_exec_detail="malformed response: ${body}"
  return 1
}

print_endpoints() {
  # Combine the relay's two probe results into one row with a comma-separated detail list.
  local relay_combined_marker="✓"
  if [[ "$relay_marker" == "✗" || "$relay_exec_marker" == "✗" ]]; then
    relay_combined_marker="✗"
  elif [[ "$relay_marker" == "·" || "$relay_exec_marker" == "·" ]]; then
    relay_combined_marker="·"
  fi
  echo "  · Consensus node (gRPC) : ${CONSENSUS_NODE_ENDPOINT} (${CONSENSUS_NODE_ACCOUNT_ID})  (not probed)"
  echo "  · Mirror node    (gRPC) : ${MIRROR_NODE_ENDPOINT}  (not probed)"
  echo "  ${mirror_rest_marker} Mirror node    (REST) : ${MIRROR_NODE_REST_URL}  (${mirror_rest_detail})"
  echo "  ${relay_combined_marker} JSON-RPC Relay        : ${JSON_RPC_RELAY_URL}  (eth_blockNumber: ${relay_detail}, eth_estimateGas CREATE: ${relay_exec_detail})"
}

for ((attempt=1; attempt<=ATTEMPTS; attempt++)); do
  mirror_ok=true
  relay_ok=true
  relay_exec_ok=true
  probe_mirror_rest || mirror_ok=false
  probe_relay || relay_ok=false
  # Only probe execution once the basic relay handshake is up — saves noise on cold start.
  if $relay_ok; then
    probe_relay_execution || relay_exec_ok=false
  else
    relay_exec_marker="·"
    relay_exec_detail="skipped (relay not ready)"
    relay_exec_ok=false
  fi
  if $mirror_ok && $relay_ok && $relay_exec_ok; then
    echo "Solo endpoints ready:"
    print_endpoints
    exit 0
  fi
  if (( attempt < ATTEMPTS )); then
    sleep "${SLEEP_SECONDS}"
  fi
done

echo "Solo endpoints were not ready in time" >&2
print_endpoints >&2
exit 1
