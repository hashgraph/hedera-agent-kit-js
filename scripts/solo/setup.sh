#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v solo >/dev/null 2>&1; then
  echo "solo CLI not found on PATH. Install with: npm install -g @hashgraph/solo" >&2
  exit 1
fi

echo "Deploying Solo one-shot single network..."
solo one-shot single deploy

echo "Waiting for Solo endpoints..."
bash "${SCRIPT_DIR}/check.sh"

cat <<'EOF'

Solo is ready.

Next step: deploy ERC20/ERC721 factory contracts and export their addresses.
  pnpm --filter @hashgraph/hedera-agent-kit-core-contracts deploy:solo

Then export the printed HEDERA_ERC20_FACTORY_ADDRESS and HEDERA_ERC721_FACTORY_ADDRESS
(or add them to .env.test.local) before running pnpm test:integration.
EOF
