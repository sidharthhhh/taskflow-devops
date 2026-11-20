#!/usr/bin/env bash
# =============================================================================
#  TaskFlow local GitOps bootstrap  (k3d + Helm + ArgoCD + Prometheus/Grafana)
#
#  Idempotent - safe to re-run. Steps:
#    1. create k3d cluster "taskflow" (NodePorts mapped to localhost)
#    2. install ArgoCD with Helm
#    3. apply the ArgoCD AppProject + Applications (taskflow, monitoring)
#
#  There is NO local image build: the cluster runs the same Docker Hub images that
#  GitHub Actions builds (docker.io/sidharthhhh/<service>:<git-sha>). ArgoCD tracks
#  the `microservice` branch on GitHub, where the CD pipeline commits each new tag.
#
#  Usage (Git Bash / Linux / macOS):   ./scripts/local-up.sh
#  Requires: docker, k3d, kubectl, helm
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

CLUSTER=taskflow
ARGOCD_CHART_VERSION=10.18.2

step() { printf '\n\033[1;36m==> %s\033[0m\n' "$*"; }

# --- 1. cluster --------------------------------------------------------------
step "k3d cluster '$CLUSTER'"
if ! k3d cluster list "$CLUSTER" >/dev/null 2>&1; then
  k3d cluster create "$CLUSTER" --servers 1 --agents 0 \
    --k3s-arg "--disable=traefik@server:0" \
    -p "30080:30080@server:0" -p "30088:30088@server:0" \
    -p "30300:30300@server:0" -p "30880:30880@server:0" -p "30090:30090@server:0" \
    --wait
fi
kubectl config use-context "k3d-$CLUSTER" >/dev/null
# Docker Desktop on Windows: host.docker.internal may resolve to a LAN IP that is
# firewalled - point kubectl at 127.0.0.1 instead.
API_PORT=$(kubectl config view -o jsonpath="{.clusters[?(@.name=='k3d-$CLUSTER')].cluster.server}" | sed 's/.*://')
kubectl config set-cluster "k3d-$CLUSTER" --server="https://127.0.0.1:${API_PORT}" >/dev/null
kubectl get nodes

# --- 2. ArgoCD ---------------------------------------------------------------
step "Installing ArgoCD (Helm chart $ARGOCD_CHART_VERSION)"
helm repo add argo https://argoproj.github.io/argo-helm >/dev/null 2>&1 || true
helm repo update argo >/dev/null
helm upgrade --install argocd argo/argo-cd --version "$ARGOCD_CHART_VERSION" \
  -n argocd --create-namespace -f argocd/install/argocd-values.yaml --wait --timeout 10m

# --- 3. ArgoCD project + applications (tracking GitHub, branch microservice) --
step "Applying ArgoCD AppProject + Applications"
kubectl apply -f argocd/project.yaml
kubectl apply -f argocd/applications/

step "Done"
cat <<EOF
  ArgoCD UI   : http://localhost:30880   (user: admin)
                password: ./scripts/local-creds.sh
  Grafana     : http://localhost:30300   (admin / taskflow-admin) -> Dashboards > TaskFlow > TaskFlow Microservices
  Prometheus  : http://localhost:30090
  Frontend    : http://localhost:30088
  Task API    : http://localhost:30080/swagger-ui.html

  Watch sync  : kubectl get applications -n argocd -w
  Deploy flow : git push (microservice) -> GitHub Actions builds + pushes images and commits
                the new image tag -> ArgoCD syncs it (poll every 60s; or refresh in the UI).
EOF
