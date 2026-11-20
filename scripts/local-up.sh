#!/usr/bin/env bash
# =============================================================================
#  TaskFlow local GitOps bootstrap  (k3d + Helm + ArgoCD + Prometheus/Grafana)
#
#  Idempotent - safe to re-run. Steps:
#    1. create k3d cluster "taskflow" (NodePorts mapped to localhost)
#    2. build the 7 service images and import them into k3d
#    3. install ArgoCD with Helm
#    4. start the in-cluster git server and push the current `microservice`
#       branch to it  (stands in for GitHub - nothing is pushed to GitHub)
#    5. apply the ArgoCD AppProject + Applications (taskflow, monitoring)
#
#  Usage (Git Bash / Linux / macOS):   ./scripts/local-up.sh [--skip-build]
#  Requires: docker, k3d, kubectl, helm, git
# =============================================================================
set -euo pipefail
cd "$(dirname "$0")/.."

CLUSTER=taskflow
ARGOCD_CHART_VERSION=10.18.2
LOCAL_REPO_URL=http://git-server.gitops.svc.cluster.local:8765/taskflow-devops.git
GITHUB_REPO_URL=https://github.com/sidharthhhh/taskflow-devops.git
SKIP_BUILD=${1:-}

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

# --- 2. images ---------------------------------------------------------------
if [ "$SKIP_BUILD" != "--skip-build" ]; then
  step "Building images"
  docker build -t taskflow-app:latest                  services/task-service
  docker build -t taskflow-auth-service:latest         services/auth-service
  docker build -t taskflow-analytics-service:latest    services/analytics-service
  docker build -t taskflow-scheduler-service:latest    services/scheduler-service
  docker build -t taskflow-notification-service:latest services/notification-service
  docker build -t taskflow-audit-service:latest        services/audit-service
  docker build -t taskflow-frontend:latest             frontend
  step "Importing images into k3d"
  k3d image import -c "$CLUSTER" taskflow-app:latest taskflow-auth-service:latest \
    taskflow-analytics-service:latest taskflow-scheduler-service:latest \
    taskflow-notification-service:latest taskflow-audit-service:latest taskflow-frontend:latest
fi

# --- 3. ArgoCD ---------------------------------------------------------------
step "Installing ArgoCD (Helm chart $ARGOCD_CHART_VERSION)"
helm repo add argo https://argoproj.github.io/argo-helm >/dev/null 2>&1 || true
helm repo update argo >/dev/null
helm upgrade --install argocd argo/argo-cd --version "$ARGOCD_CHART_VERSION" \
  -n argocd --create-namespace -f argocd/install/argocd-values.yaml --wait --timeout 10m

# --- 4. in-cluster git server + push -----------------------------------------
step "In-cluster git server"
kubectl apply -f argocd/local-git-server/git-server.yaml
kubectl create configmap git-server-script -n gitops \
  --from-file=scripts/local-git-server.py --dry-run=client -o yaml | kubectl apply -f -
kubectl -n gitops rollout status deploy/git-server --timeout=180s

step "Pushing branch 'microservice' to the in-cluster git server"
git remote get-url local-gitops >/dev/null 2>&1 || \
  git remote add local-gitops http://localhost:8765/taskflow-devops.git
kubectl -n gitops port-forward svc/git-server 8765:8765 >/dev/null 2>&1 &
PF_PID=$!
trap 'kill $PF_PID 2>/dev/null || true' EXIT
sleep 3
git push --force local-gitops microservice
kill $PF_PID 2>/dev/null || true

# --- 5. ArgoCD project + applications ----------------------------------------
step "Applying ArgoCD AppProject + Applications"
kubectl apply -f argocd/project.yaml
for app in argocd/applications/*.yaml; do
  sed "s#${GITHUB_REPO_URL}#${LOCAL_REPO_URL}#g" "$app" | kubectl apply -f -
done

step "Done"
cat <<EOF
  ArgoCD UI   : http://localhost:30880   (user: admin)
                password: kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
  Grafana     : http://localhost:30300   (admin / taskflow-admin) -> Dashboards > TaskFlow > TaskFlow Microservices
  Prometheus  : http://localhost:30090
  Frontend    : http://localhost:30088
  Task API    : http://localhost:30080/swagger-ui.html

  Watch sync  : kubectl get applications -n argocd -w
  Deploy a change locally: commit on 'microservice', then ./scripts/local-push.sh
EOF
