#!/usr/bin/env bash
set -euo pipefail

REST_URL="${HEDERA_MIRROR_NODE_REST_URL:-http://127.0.0.1:38081/api/v1}"
JSON_RPC_URL="${HEDERA_JSON_RPC_RELAY_URL:-http://127.0.0.1:37546}"

for attempt in {1..60}; do
  if curl --fail --silent --max-time 2 "${REST_URL}/network/nodes" >/dev/null \
    && curl --fail --silent --max-time 2 -X POST -H 'Content-Type: application/json' \
      --data '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' \
      "${JSON_RPC_URL}" >/dev/null; then
    echo "Solo endpoints ready:"
    echo "  Mirror REST : ${REST_URL}"
    echo "  JSON-RPC    : ${JSON_RPC_URL}"
    exit 0
  fi
  sleep 5
done

echo "Solo endpoints were not ready in time" >&2
echo "  Checked REST     : ${REST_URL}/network/nodes" >&2
echo "  Checked JSON-RPC : ${JSON_RPC_URL}" >&2
exit 1
