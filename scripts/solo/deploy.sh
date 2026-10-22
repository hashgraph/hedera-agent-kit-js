#!/usr/bin/env bash
set -euo pipefail

# Deploys a single-node Solo network into a kind cluster. Same command used by
# CI (.github/workflows/800-call-run-*-tests.yaml) so local and CI stay aligned.
# Requires: kind, kubectl, and solo (run `pnpm test:solo:install` first).

export SOLO_CLUSTER_NAME="${SOLO_CLUSTER_NAME:-solo}"
export SOLO_NAMESPACE="${SOLO_NAMESPACE:-solo}"
export SOLO_CLUSTER_SETUP_NAMESPACE="${SOLO_CLUSTER_SETUP_NAMESPACE:-solo-cluster}"
export SOLO_DEPLOYMENT="${SOLO_DEPLOYMENT:-solo-deployment}"

echo "Deploying Solo single-node network (cluster=${SOLO_CLUSTER_NAME}, namespace=${SOLO_NAMESPACE})..."
# Pass the namespace explicitly: inside a CI runner pod Solo otherwise defaults to
# the runner's namespace, and long names break in-cluster DNS (63-char label limit).
solo one-shot single deploy --namespace "${SOLO_NAMESPACE}"
