#!/usr/bin/env bash
# Print the local ArgoCD and Grafana logins (read live from the cluster secrets).
# Usage: ./scripts/local-creds.sh
set -euo pipefail
d() { base64 -d 2>/dev/null || base64 -D; }   # GNU / macOS base64
ARGO_PW=$(kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | d)
GRAF_U=$(kubectl -n monitoring get secret monitoring-grafana -o jsonpath='{.data.admin-user}' | d)
GRAF_PW=$(kubectl -n monitoring get secret monitoring-grafana -o jsonpath='{.data.admin-password}' | d)
echo "ArgoCD  http://localhost:30880   user: admin    password: ${ARGO_PW}"
echo "Grafana http://localhost:30300   user: ${GRAF_U}    password: ${GRAF_PW}"
