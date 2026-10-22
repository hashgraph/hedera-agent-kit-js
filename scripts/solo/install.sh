#!/usr/bin/env bash
set -euo pipefail

# Installs the Solo CLI globally. Pinned to the same version CI uses so local and
# CI deploys stay reproducible.
SOLO_VERSION="${SOLO_VERSION:-0.92.0}"

echo "Installing @hiero-ledger/solo@${SOLO_VERSION} globally via npm..."
npm install -g "@hiero-ledger/solo@${SOLO_VERSION}"

echo "Solo installed: $(solo --version 2>/dev/null | head -1 || echo 'unknown')"
