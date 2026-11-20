# 🚀 TaskFlow CI/CD Pipelines (GitHub Actions)

This directory contains **7 modular, path-filtered CI/CD workflows** that run **only on the `microservice` branch** (push + pull_request), supporting polyglot microservices (Java, Node.js, Golang, Rust, Next.js), Docker Hub, Helm and ArgoCD GitOps deployment.

---

## 🏗️ Modular Pipeline Architecture

Each microservice and infrastructure layer has its own isolated CI workflow using GitHub `paths:` filtering so only modified components run their build, scan, and container smoke tests:

| Workflow File | Trigger Paths | Jobs & Verification |
|---|---|---|
| [`ci-task-service.yml`](workflows/ci-task-service.yml) | `services/task-service/**` | Maven `verify`, JUnit/MockMvc tests, multi-stage Docker build, Trivy CVE scan, H2 `/actuator/health` smoke test |
| [`ci-node-services.yml`](workflows/ci-node-services.yml) | `services/{auth,analytics,scheduler}-service/**` | Matrix build across all 3 Node.js 22 services, `npm test`, Docker build, Trivy scan, `/health` smoke tests |
| [`ci-go-notification.yml`](workflows/ci-go-notification.yml) | `services/notification-service/**` | `go vet`, `go test -v ./...`, static Alpine Docker build, Trivy scan, `/health` smoke test |
| [`ci-rust-audit.yml`](workflows/ci-rust-audit.yml) | `services/audit-service/**` | `cargo fmt --check`, `cargo clippy`, `cargo test`, musl Alpine Docker build, Trivy scan, `/health` smoke test |
| [`ci-frontend.yml`](workflows/ci-frontend.yml) | `frontend/**` | `tsc --noEmit`, `npm run build`, Next.js standalone Docker build, Trivy scan, `/api/health` smoke test |
| [`ci-infra-k8s.yml`](workflows/ci-infra-k8s.yml) | `terraform/**`, `k8s/**`, `helm/**`, `argocd/**`, `monitoring/**`, `docker-compose.yml` | `terraform fmt -check`, `terraform validate`, `docker compose config -q`, `kubectl kustomize` (`local` & `eks`), `helm lint`, `helm template`, `kubeconform` schema check, Grafana dashboard JSON check |
| [`cd-deploy.yml`](workflows/cd-deploy.yml) | push to `microservice` touching `services/**` / `frontend/**`, or `workflow_dispatch` | Matrix build & push all 7 images to Docker Hub as `:<git-sha>`, then **commit the new `image.tag` to `helm/taskflow/values.yaml`** (`[skip ci]`). ArgoCD sees the commit and rolls the cluster forward. No cluster credentials in CI. |

---

## 🔐 Configuring Secrets & Variables

Navigate to **GitHub Repository > Settings > Secrets and variables > Actions**:

### Repository Secrets (`Secrets` tab)
| Secret Name | Purpose |
|---|---|
| `DOCKERHUB_USERNAME` | Docker Hub username (e.g., `sidharthhhh`) for pushing container images |
| `DOCKERHUB_TOKEN` | Docker Hub Personal Access Token (PAT) |
| `AWS_ACCESS_KEY_ID` | IAM user access key (used when AWS Organization SCP restricts OIDC provider creation) |
| `AWS_SECRET_ACCESS_KEY` | IAM user secret key |
| `AWS_ROLE_ARN` | *(Optional)* IAM Role ARN if using keyless GitHub OIDC auth |

### Repository Variables (`Variables` tab)
| Variable Name | Default Value | Purpose |
|---|---|---|
| `AWS_REGION` | `ap-southeast-2` | AWS region where EKS cluster resides |
| `EKS_CLUSTER_NAME` | `taskflow-prod-cluster` | Target Amazon EKS cluster name |
| `DEPLOY_ENABLED` | `false` | Safety gate preventing automatic paid cloud deployments until set to `true` |

---

## 🛡️ Built-in Safety & Rollback

1. **Branch & Path Isolation**: Only pushes and pull requests targeting `microservice` run CI, and each workflow runs only when its own paths change.
2. **GitOps CD**: `cd-deploy.yml` never touches the cluster. It only writes the image tag to git, and ArgoCD (running in the cluster) applies it. The tag bump is skipped if Docker Hub secrets are missing, so ArgoCD is never pointed at an image that doesn't exist. `concurrency` serialises deploys.
3. **Rollback = `git revert`**: revert the `deploy: bump image tag ... [skip ci]` commit and ArgoCD syncs back to the previous images. Or use `argocd app rollback taskflow <ID>`. ArgoCD `selfHeal` also reverts manual drift.

> ℹ️ The AWS variables/secrets above (`AWS_*`, `EKS_CLUSTER_NAME`, `DEPLOY_ENABLED`) are no longer used by `cd-deploy.yml`. They are only needed if you re-introduce a direct EKS deploy job. See [GITOPS-NOTES.md](../GITOPS-NOTES.md).
