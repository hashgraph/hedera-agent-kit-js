#!/usr/bin/env bash
set -uo pipefail
# Note: NOT `set -e`. Every step is best-effort; we want to continue tearing
# down even if an earlier step fails (e.g. a missing kind cluster).

# Tears down the Solo network and any kind clusters it created. Mirrors the
# teardown step in CI workflows so `pnpm test:solo:down` cleans up the same way.

echo "Destroying Solo deployment..."
solo one-shot single destroy 2>/dev/null || true

echo "Deleting any leftover Solo kind clusters..."
kind get clusters 2>/dev/null | grep '^solo' | while read -r cluster; do
  kind delete cluster -n "$cluster"
done || true

echo "Removing ~/.solo state..."
rm -rf ~/.solo 2>/dev/null || sudo rm -rf ~/.solo 2>/dev/null || true

echo "Solo teardown complete."
