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
solo one-shot single deploy
