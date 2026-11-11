# 🚀 TaskFlow CI/CD Pipelines (GitHub Actions)

This directory contains **7 modular, path-filtered CI/CD workflows** tailored for the **`microservice`**, **`sidharth/feature`**, **`main`**, and **`master`** branches, supporting polyglot microservices (Java, Node.js, Golang, Rust, Next.js), Docker Hub / Amazon ECR, and Amazon EKS (`ap-southeast-2`).

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
| [`ci-infra-k8s.yml`](workflows/ci-infra-k8s.yml) | `terraform/**`, `k8s/**`, `docker-compose.yml` | `terraform fmt -check`, `terraform validate`, `docker compose config -q`, `kubectl kustomize` (`local` & `eks`) |
| [`cd-deploy.yml`](workflows/cd-deploy.yml) | `microservice` / `main` (when `DEPLOY_ENABLED=true`) or `workflow_dispatch` | Matrix build & push all 7 images to Docker Hub (`linux/amd64`), install `kustomize`, inject tags into `k8s/overlays/eks`, deploy to EKS & verify `postgres` + microservice rollouts |

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

1. **Branch & Path Isolation**: Pushes and pull requests targeting `microservice` or `sidharth/feature` run fast, isolated CI validation and Trivy security scans without touching live AWS infrastructure unless `DEPLOY_ENABLED == 'true'`.
2. **Gated CD Deployment**: Cloud deployment in `cd-deploy.yml` runs only on explicit `workflow_dispatch` or on `microservice`/`main` when `DEPLOY_ENABLED == 'true'`.
3. **Automated Rollback**: If any deployment rollout times out (`kubectl rollout status --timeout=180s`), the pipeline automatically executes `kubectl rollout undo` for `taskflow-app` and `taskflow-frontend`.
