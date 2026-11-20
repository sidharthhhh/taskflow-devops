#!/usr/bin/env bash
# =============================================================================
#  "git push" for the local GitOps loop.
#  Pushes the `microservice` branch to the in-cluster git server that ArgoCD
#  watches (NOT to GitHub), then asks ArgoCD to refresh immediately.
#
#  Usage: ./scripts/local-push.sh
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

git remote get-url local-gitops >/dev/null 2>&1 || \
  git remote add local-gitops http://localhost:8765/taskflow-devops.git

kubectl -n gitops port-forward svc/git-server 8765:8765 >/dev/null 2>&1 &
PF_PID=$!
trap 'kill $PF_PID 2>/dev/null || true' EXIT
sleep 3

git push --force local-gitops microservice

# Ask ArgoCD to re-check git now instead of waiting for the 60s poll.
for app in taskflow monitoring; do
  kubectl -n argocd annotate application "$app" argocd.argoproj.io/refresh=normal --overwrite >/dev/null
done
echo "Pushed. ArgoCD is refreshing - watch: kubectl get applications -n argocd -w"
