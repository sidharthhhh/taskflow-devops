# TaskFlow GitOps Notes — Helm + ArgoCD + Grafana

These notes explain **what** was added, **why**, and **how the pieces fit**, so you can
reason about it (and explain it in an interview) without reading every file.

---

## 1. The big picture

```
 developer ──git push──▶ GitHub (branch: microservice)
                              │
              ┌───────────────┴────────────────┐
              ▼                                ▼
     GitHub Actions CI                 GitHub Actions CD (cd-deploy.yml)
     (test, lint, scan,                1. build + push 7 images  :<git-sha>
      helm lint/template)              2. sed: helm/taskflow/values.yaml image.tag = <git-sha>
                                       3. commit "deploy: bump image tag [skip ci]"
                                                       │
                                                       ▼
                              ArgoCD (inside the cluster) polls the branch every 60s
                              ── helm template helm/taskflow -f values.yaml -f values-local.yaml
                              ── kubectl apply (diff only)  →  rolling update
                                                       │
                                                       ▼
                    namespace taskflow: 7 microservices + Postgres + Redis
                                                       │  metrics
                                                       ▼
          namespace monitoring: Prometheus ──▶ Grafana "TaskFlow Microservices" dashboard
```

**Key idea — push vs pull deployment**

| Old (kustomize CD)                           | New (GitOps)                                     |
|----------------------------------------------|--------------------------------------------------|
| CI runs `kubectl apply` against EKS          | CI only writes to **git**                        |
| CI needs cluster credentials (AWS keys)      | CI needs **no** cluster credentials              |
| Manual `kubectl edit` drifts silently        | ArgoCD **self-heals** drift back to git          |
| Rollback = `kubectl rollout undo`            | Rollback = `git revert` (audited in history)     |

Git is the single source of truth: *what is in the `microservice` branch is what runs*.

---

## 2. Helm — `helm/taskflow/`

Helm is a **templating + packaging** tool for Kubernetes YAML. Instead of 13 near-identical
YAML files (the old `k8s/base`), there is one template and a values file.

```
helm/taskflow/
├── Chart.yaml                    chart name + version
├── values.yaml                   defaults (cloud). CI bumps image.tag here
├── values-local.yaml             overrides for the local k3d cluster
├── dashboards/
│   └── taskflow-microservices.json   the ONE Grafana dashboard
└── templates/
    ├── _helpers.tpl              shared labels + image-name helper
    ├── config.yaml               ConfigMaps (taskflow-config, taskflow-mesh-config) + Secret
    ├── datastores.yaml           Postgres StatefulSet + Redis
    ├── microservices.yaml        ONE loop → Deployment/Service/HPA/PDB/PVC for every service
    ├── monitoring.yaml           ServiceMonitor + Grafana dashboard ConfigMap
    └── NOTES.txt                 printed after install
```

> ⚠️ **Never put `image.registry` / `image.tag` / `image.pullPolicy` in `values-local.yaml`.** It wins over
> `values.yaml`, so the cluster would ignore the images CI builds and the tag CI commits (this is exactly what
> made a UI change not show up once). `values-local.yaml` holds environment settings only (NodePorts, PVCs).

### How values layering works
`helm template -f values.yaml -f values-local.yaml` → **later files win**.

| Setting           | values.yaml (cloud)        | values-local.yaml (k3d)              |
|-------------------|----------------------------|--------------------------------------|
| image.*           | Docker Hub, tag set by CI  | **not overridden** (same images as prod) |
| task API service  | ClusterIP                  | NodePort 30080                       |
| frontend service  | LoadBalancer               | NodePort 30088                       |
| audit /data       | emptyDir                   | PVC (local-path)                     |

### The loop in `microservices.yaml`
Each entry under `services:` in values.yaml becomes a full service. To **add a new microservice**
you only add a block like:

```yaml
services:
  billing:
    enabled: true
    name: billing-service
    image: { repository: taskflow-billing-service }
    port: 3004
    health: { liveness: /health, readiness: /health }
    resources: { requests: { memory: 64Mi, cpu: 50m }, limits: { memory: 128Mi, cpu: 200m } }
```

### Useful details
- **`checksum/config` annotation** — a hash of the ConfigMaps/Secret is put on every pod.
  Change a config value → hash changes → pods roll automatically (plain K8s doesn't restart
  pods on ConfigMap change).
- **HPA + `replicas`** — when autoscaling is on, the template omits `spec.replicas` and
  ArgoCD has `ignoreDifferences` on it, so ArgoCD and the HPA don't fight.
- **Postgres** now uses `volumeClaimTemplates` (the StatefulSet owns its PVC).

### Handy Helm commands
```bash
helm lint helm/taskflow -f helm/taskflow/values.yaml -f helm/taskflow/values-local.yaml
helm template taskflow helm/taskflow -n taskflow -f helm/taskflow/values.yaml -f helm/taskflow/values-local.yaml | less
helm template ... --set services.auth.enabled=false     # try an override quickly
```
> ArgoCD runs `helm template` itself and applies the output, so you will **not** see the
> release in `helm list` — ArgoCD, not Helm, owns these resources.

---

## 3. ArgoCD — `argocd/`

ArgoCD is a controller that runs **inside the cluster** and continuously compares
**desired state (git)** with **live state (cluster)**.

```
argocd/
├── install/argocd-values.yaml     how ArgoCD itself is installed (Helm chart argo/argo-cd 10.18.2 = v3.6.2)
├── project.yaml                   AppProject: allowed git repos + allowed namespaces
├── applications/
│   ├── taskflow.yaml              Application → helm/taskflow on branch microservice → ns taskflow
│   └── monitoring.yaml            Application → kube-prometheus-stack chart + our values → ns monitoring
```

### Vocabulary
| Term          | Meaning                                                                 |
|---------------|-------------------------------------------------------------------------|
| Application   | "deploy *this path* of *this repo/branch* into *this namespace*"        |
| AppProject    | guard-rails for Applications (which repos / destinations are allowed)   |
| Synced / OutOfSync | does the cluster match git?                                        |
| Healthy / Progressing / Degraded | are the deployed resources actually working?      |
| `automated.prune`    | delete resources that were removed from git                      |
| `automated.selfHeal` | undo manual changes (`kubectl edit/scale`) – try it!             |
| `targetRevision: microservice` | the branch ArgoCD tracks                               |

### Multi-source Application (monitoring)
`monitoring.yaml` pulls the **chart** from the prometheus-community Helm repo, but the
**values file** from *our* git repo (`ref: values` → `$values/monitoring/...`).
Upgrading Prometheus/Grafana = changing `targetRevision: 93.4.1` in git.
It uses `ServerSideApply=true` because the Prometheus Operator CRDs are too large for
client-side apply.

### Try self-healing
```bash
kubectl -n taskflow scale deploy/auth-service --replicas=0
kubectl -n taskflow get deploy auth-service -w     # ArgoCD puts it back to 1 within seconds
```

### ArgoCD CLI / UI
```bash
# UI: http://localhost:30880   user: admin
kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}' | base64 -d
argocd login localhost:30880 --username admin --password <pw> --plaintext
argocd app list
argocd app get taskflow
argocd app diff taskflow
argocd app history taskflow
argocd app rollback taskflow <ID>     # (disables auto-sync until re-enabled)
```

---

## 4. Monitoring — one Grafana dashboard

`monitoring/kube-prometheus-stack-values.yaml` installs (via ArgoCD):

| Component            | Role                                                                    |
|----------------------|-------------------------------------------------------------------------|
| Prometheus Operator  | turns `ServiceMonitor` objects into Prometheus scrape config             |
| Prometheus           | stores metrics (http://localhost:30090)                                 |
| kube-state-metrics   | K8s object state: replicas available, pod phase, restarts, limits       |
| kubelet / cAdvisor   | per-container CPU, memory, network                                      |
| Grafana              | dashboards (http://localhost:30300, `admin` / `taskflow-admin`)          |

Deliberately **disabled**: Alertmanager, node-exporter, the ~25 stock dashboards and
default alert rules (`defaultDashboardsEnabled: false`) → Grafana shows **exactly one**
dashboard: **TaskFlow ▸ TaskFlow Microservices**.

### How the dashboard gets into Grafana (no clicking)
1. `helm/taskflow/dashboards/taskflow-microservices.json` is the dashboard.
2. `templates/monitoring.yaml` wraps it in a ConfigMap labelled `grafana_dashboard: "1"`.
3. Grafana's **sidecar** container watches all namespaces for that label and loads it.
4. → edit JSON in git, ArgoCD syncs, the dashboard updates. Dashboards are GitOps too.

### What's on the dashboard
| Row                | Panels                                                             | Source |
|--------------------|--------------------------------------------------------------------|--------|
| Overview           | healthy deployments, running pods, restarts (1h), total CPU, memory, Task API req/s | kube-state-metrics, cAdvisor, Micrometer |
| Service Status     | ready replicas per service – **red = down**                        | kube-state-metrics |
| Resources          | CPU / memory / network / restarts per service, memory vs limit (OOM risk) | cAdvisor, kube-state-metrics |
| Task API           | request rate, avg latency per endpoint, 4xx/5xx, JVM memory        | Spring Boot `/actuator/prometheus` (ServiceMonitor) |

"Is service X up?" works for **every** language (Java, Node, Go, Rust, Next.js) because
readiness = the service's `/health` probe, which kube-state-metrics exposes. Only the Java
service exposes app-level metrics today; to add HTTP metrics for another service, expose
`/metrics` (e.g. `prom-client` for Node, `promhttp` for Go) and set
`metrics: { enabled: true, path: /metrics }` for it in values.yaml — the ServiceMonitor is
generated automatically.

---

## 5. Running locally — same images as CI

The local k3d cluster is deployed exactly like production: **ArgoCD tracks the `microservice`
branch on GitHub**, and every pod runs a **Docker Hub image built by GitHub Actions**
(`docker.io/sidharthhhh/<service>:<git-sha>`). There is no local `docker build`, no
`k3d image import`, and no second git server.

```
git push ──▶ GitHub Actions ──push images──▶ Docker Hub (:<sha>)
                  │
                  └─commit "deploy: bump image tag"─▶ GitHub (helm/taskflow/values.yaml)
                                                          ▲
                                        ArgoCD polls ─────┘ (every 60s) ──▶ k3d pulls :<sha> from Docker Hub
```

### Commands
```bash
./scripts/local-up.sh              # cluster + ArgoCD + apps (images come from Docker Hub)
./scripts/local-creds.sh           # print ArgoCD + Grafana logins
# Windows PowerShell equivalents:
#   powershell -ExecutionPolicy Bypass -File .\scripts\local-up.ps1
#   powershell -ExecutionPolicy Bypass -File .\scripts\local-creds.ps1

# Ship a change (code, UI or config):
git commit -am "my change"
git push origin microservice                 # CI builds + pushes images and commits the new tag
kubectl get applications -n argocd -w        # ArgoCD syncs it within ~1 min
git pull origin microservice                 # get the bot's tag-bump commit before your next push

# Sync immediately instead of waiting for the poll:
kubectl -n argocd annotate application taskflow argocd.argoproj.io/refresh=hard --overwrite

# Which image is running vs what CI built?
kubectl get deploy -n taskflow -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image

# Tear down
k3d cluster delete taskflow
```

### Local URLs
| What        | URL                                   | Login |
|-------------|---------------------------------------|-------|
| Frontend    | http://localhost:30088                 | – |
| Task API    | http://localhost:30080/swagger-ui.html | – |
| ArgoCD      | http://localhost:30880                 | admin / (secret above) |
| Grafana     | http://localhost:30300                 | admin / taskflow-admin |
| Prometheus  | http://localhost:30090                 | – |

> Windows / Docker Desktop gotcha: k3d writes `host.docker.internal:<port>` into kubeconfig,
> which may resolve to a firewalled LAN IP. `local-up.sh` rewrites it to `127.0.0.1`.

---

## 6. CI/CD — `microservice` and `main` branches

All workflows in `.github/workflows/` trigger on `microservice` **and** `main`
(push + pull_request). `master` and `sidharth/feature` do not trigger anything.

> **Which branch does ArgoCD deploy?** The one in its Application's `targetRevision`
> (currently `microservice`, see `argocd/applications/*.yaml`). CD commits the image-tag bump
> to the branch that triggered the run, so a push to `main` only reaches the cluster if ArgoCD
> tracks `main`. Both branches bump the same `values.yaml` lines, so keep them in sync by
> merging (a tag-bump conflict is resolved by taking the newer tag).

| Workflow               | Trigger paths                                    | What it does |
|------------------------|--------------------------------------------------|--------------|
| ci-task-service.yml    | services/task-service/**                         | Maven tests, Docker build, Trivy, smoke test |
| ci-node-services.yml   | services/{auth,analytics,scheduler}-service/**   | npm test, Docker build, Trivy, smoke test |
| ci-go-notification.yml | services/notification-service/**                 | go vet/test, Docker build, Trivy |
| ci-rust-audit.yml      | services/audit-service/**                        | fmt, clippy, test, Docker build, Trivy |
| ci-frontend.yml        | frontend/**                                      | tsc, next build, Docker build, Trivy |
| ci-infra-k8s.yml       | terraform/**, k8s/**, **helm/**, **argocd/**, **monitoring/** | terraform validate, kustomize, **helm lint + template + kubeconform**, dashboard JSON check |
| cd-deploy.yml          | services/**, frontend/** on push to microservice | build+push images `:<sha>` → **commit new image.tag to values.yaml** → ArgoCD deploys |

### CD details worth knowing
- The bump commit message contains `[skip ci]`, and the job also checks for it, so the
  bot's commit doesn't start another build → no infinite loop.
- `concurrency: cd-microservice` serialises deploys so two tag bumps can't race.
- The bump uses targeted `sed` edits inside the `image:` block, so the commit diff is only the
  `registry`/`tag` lines. (`yq -i` was tried first: it reformats the whole file, which makes
  every deploy diff noisy.) `yq` is then used only to verify the new tag.
- The tag bump only happens if images were actually pushed (Docker Hub secrets present) —
  ArgoCD never gets pointed at a tag that doesn't exist.
- Needs `permissions: contents: write`. If the branch is protected, allow
  `github-actions[bot]` to push or switch to a PR-based bump.
- The **local** cluster uses the same `values.yaml` image tag as every other environment
  (`values-local.yaml` deliberately has no `image:` block), so a CI tag bump reaches it
  automatically. The Docker Hub repos must be public (or a pull secret configured).

### Required GitHub secrets (unchanged)
`DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`. AWS secrets are no longer needed by CD: ArgoCD
inside the cluster does the deploying.

---

## 7. Troubleshooting cheat-sheet

| Symptom | Check |
|---------|-------|
| App `OutOfSync` forever | `argocd app diff taskflow` / UI → "Diff" tab |
| App `Degraded` | `kubectl -n taskflow get pods`, `kubectl -n taskflow describe pod <p>` |
| `ImagePullBackOff` / `ErrImagePull` | tag not on Docker Hub (CD still running / failed), repo private, or no internet from the cluster |
| Change not visible after CI finished | ArgoCD still on an old commit: compare `kubectl get application taskflow -n argocd -o jsonpath='{.status.sync.revision}'` with `git ls-remote origin microservice`; then refresh |
| `ComparisonError ... repository not found` | GitHub unreachable or private repo: `kubectl logs -n argocd deploy/argocd-repo-server --tail=50` |
| Dashboard missing | `kubectl -n taskflow get cm taskflow-grafana-dashboard --show-labels`; `kubectl -n monitoring logs deploy/monitoring-grafana -c grafana-sc-dashboard` |
| Task API panels empty | Prometheus → Status → Targets → `serviceMonitor/taskflow/taskflow-app` should be UP |
| kubectl timeout on Windows | kubeconfig server must be `https://127.0.0.1:<port>` |
