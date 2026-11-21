# 🚀 TaskFlow - Polyglot Microservices DevOps Platform

TaskFlow is a production-ready DevOps platform combining a **Java 17 / Spring Boot 3** core task service with **Golang**, **Rust**, **Node.js** microservices, **Redis 7**, **PostgreSQL 16**, and a **Next.js** dashboard UI — engineered with multi-stage non-root Alpine Docker images, a Helm chart deployed by ArgoCD (GitOps), Prometheus + Grafana monitoring, Kustomize Kubernetes manifests, Terraform AWS IaC, and GitHub Actions CI/CD.

---

> 📌 **Quick Navigation**: [⚡ Helm + ArgoCD + Grafana (start here)](#️-option-c-helm--argocd-gitops--grafana-local-k3d--recommended) • [🐞 Debugging Commands](#5-debugging-command-reference) • [📘 GitOps Notes](GITOPS-NOTES.md) • [🧩 Microservices Stack](#-polyglot-microservices-architecture) • [🌐 AWS Cloud Architecture](#-whole-aws-cloud-environment-architecture) • [🤝 10 Manual Handshakes](#-manual-handshakes--required-human-efforts) • [☸️ Local K3s](#option-a-local-k3s-deployment-using-k3d) • [☁️ AWS EKS](#option-b-aws-eks-deployment) • [🚀 CI/CD](.github/README.md) • [🌍 Terraform IaC](terraform/README.md) • [🔧 Troubleshooting](#-comprehensive-troubleshooting-guide)

---

## 🧩 Polyglot Microservices Architecture

| Service | Tech Stack | Port | Docker Base Image | Responsibility |
|---|---|---|---|---|
| **Frontend UI & BFF** (`frontend/`) | Next.js 14 + Tailwind CSS | `3000` | `node:22-alpine` | Modern SaaS Kanban board, service mesh health monitor, runtime BFF proxy |
| **Task Service** (`services/task-service/`) | Java 17 + Spring Boot 3 | `8080` | `eclipse-temurin:17-jre-alpine` | Task CRUD API, OpenAPI/Swagger, Actuator & Prometheus metrics |
| **Auth Service** (`services/auth-service/`) | Node.js 22 + Express | `3001` | `node:22-alpine` | JWT authentication (`crypto.scrypt` + PostgreSQL `authdb`) |
| **Analytics Service** (`services/analytics-service/`) | Node.js 22 + Express | `3002` | `node:22-alpine` | Real-time completion metrics with Redis TTL caching (`REDIS_HIT` / `LIVE_COMPUTE`) |
| **Scheduler Service** (`services/scheduler-service/`) | Node.js 22 + Express | `3003` | `node:22-alpine` | Periodic task sweep & manual trigger publishing events to Redis Pub/Sub |
| **Notification Service** (`services/notification-service/`) | Golang 1.22 + `go-redis` | `8081` | `alpine:3.20` | Subscribes to Redis `taskflow:events` Pub/Sub & serves alert feed |
| **Audit Logs Service** (`services/audit-service/`) | Rust + Axum + Tokio | `8082` | `alpine:3.20` | Immutable append-only audit trail (`/data/audit.jsonl` volume) |
| **Redis** (`redis:7-alpine`) | Redis 7 | `6379` | `redis:7-alpine` | Pub/Sub event bus, analytics cache & notification persistence |
| **PostgreSQL** (`postgres:16-alpine`) | PostgreSQL 16 | `5432` | `postgres:16-alpine` | Relational DB hosting `taskflowdb` (tasks) & `authdb` (auth users) with PV/PVC |

---

## 📋 Features

- **Core API (`services/task-service/`)**: Spring Boot 3.3.x, Spring Data JPA, Bean Validation, PostgreSQL 16 / H2, Actuator & Prometheus (`/actuator/prometheus`), Swagger UI (`/swagger-ui.html`)
- **Docker Best Practices**: Multi-stage builds, dependency layer caching, `.dockerignore` files, non-root users (`10001` / `node`), lightweight Alpine images, and container `HEALTHCHECK` probes
- **Kubernetes Architecture**:
  - Declarative Kustomize setup (`base/` + `overlays/{local,eks}`) covering Redis, Postgres, all 6 backend microservices, and Next.js Frontend
  - Zero-downtime rolling updates with `readinessProbe` and `livenessProbe`
  - Horizontal Pod Autoscaler (HPA) & Pod Disruption Budget (PDB)
- **Helm + ArgoCD GitOps**: one Helm chart (`helm/taskflow`) renders all services from `values.yaml`; ArgoCD auto-syncs the `main` branch with prune + self-heal
- **Monitoring**: kube-prometheus-stack (Prometheus Operator, kube-state-metrics, Grafana) with a single **TaskFlow Microservices** dashboard shipped as code
- **CI/CD on `main` only**: per-service CI with Trivy scans, Helm lint/kubeconform, and GitOps CD that bumps the image tag in git for ArgoCD to deploy

---

## 📁 Project Structure

```text
taskflow-devops/
├── .github/
│   ├── README.md                                # GitHub Actions CI/CD pipelines documentation
│   └── workflows/
│       ├── ci-task-service.yml                  # Java Spring Boot CI + Trivy + Smoke test
│       ├── ci-node-services.yml                 # Matrix CI for Auth, Analytics & Scheduler
│       ├── ci-go-notification.yml               # Go Notification Service CI
│       ├── ci-rust-audit.yml                    # Rust Audit Logs Service CI
│       ├── ci-frontend.yml                      # Next.js TypeScript & Standalone Docker CI
│       ├── ci-infra-k8s.yml                     # Terraform, Kustomize, Compose + Helm/ArgoCD validation CI
│       └── cd-deploy.yml                        # Docker Hub push + GitOps image-tag bump (ArgoCD deploys)
├── helm/taskflow/                               # Helm chart for the whole stack
│   ├── values.yaml                              # Defaults (cloud); CI bumps image.tag here
│   ├── values-local.yaml                        # k3d overrides (NodePorts only; images come from Docker Hub)
│   ├── dashboards/taskflow-microservices.json   # The single Grafana dashboard
│   └── templates/                               # config, datastores, microservices loop, monitoring
├── argocd/
│   ├── install/argocd-values.yaml               # ArgoCD Helm install values (NodePort 30880)
│   ├── project.yaml                             # AppProject (allowed repos / namespaces)
│   └── applications/                            # taskflow + monitoring Applications (GitHub, branch: microservice)
├── monitoring/
│   └── kube-prometheus-stack-values.yaml        # Prometheus + Grafana values (one dashboard only)
├── scripts/
│   ├── local-up.ps1 / local-up.sh               # Create the whole local infra (Windows / Linux)
│   └── local-creds.ps1 / local-creds.sh         # Print ArgoCD + Grafana logins
├── GITOPS-NOTES.md                              # Helm / ArgoCD / Grafana / CI-CD explained
├── services/
│   ├── task-service/                            # Java 17 Spring Boot Task API (:8080)
│   │   ├── pom.xml
│   │   ├── Dockerfile
│   │   ├── .env.example
│   │   └── src/
│   ├── auth-service/                            # Node.js JWT auth service (:3001)
│   ├── analytics-service/                       # Node.js analytics + Redis cache (:3002)
│   ├── scheduler-service/                       # Node.js cron reminder scheduler (:3003)
│   ├── notification-service/                    # Golang Redis Pub/Sub notifications (:8081)
│   └── audit-service/                           # Rust Axum append-only audit logs (:8082)
├── frontend/                                    # Next.js 14 Dashboard UI & BFF (:3000)
├── k8s/
│   ├── README.md                                # Comprehensive Kubernetes architecture & guide
│   ├── aws.md                                   # AWS EKS & ECS Sydney deployment guide
│   ├── base/                                    # Cloud-agnostic base Kubernetes manifests
│   │   ├── namespace.yaml                       # taskflow namespace
│   │   ├── configmap.yaml                       # App config (ports, DB URL, actuator)
│   │   ├── secret.yaml                          # DB credentials
│   │   ├── postgres-service.yaml                # ClusterIP service for PostgreSQL (port 5432)
│   │   ├── postgres-pvc.yaml                    # PersistentVolumeClaim (1Gi RWO) for PostgreSQL
│   │   ├── postgres-statefulset.yaml            # PostgreSQL 16 StatefulSet (mounts postgres-pvc)
│   │   ├── redis.yaml                           # Redis 7 Deployment + Service (port 6379)
│   │   ├── app-deployment.yaml                  # Spring Boot Task API deployment
│   │   ├── app-service.yaml                     # Internal service (port 8080)
│   │   ├── microservices.yaml                   # Deployments & Services for Go, Rust & Node.js services
│   │   ├── frontend.yaml                        # Next.js UI & BFF Deployment + Service (port 3000)
│   │   ├── hpa.yaml                             # Autoscaler
│   │   ├── pdb.yaml                             # PodDisruptionBudget
│   │   └── kustomization.yaml                   # Base Kustomize definition
│   └── overlays/
│       ├── local/                               # Local K3s / K3d overlay (PV/PVCs, Ingress, NodePorts)
│       └── eks/                                 # AWS EKS production overlay (GP3 PVC + LoadBalancer -> Frontend)
├── terraform/
│   ├── README.md                                # Complete Terraform infrastructure guide
│   ├── bootstrap/                               # Remote state S3 bucket & DynamoDB lock table
│   ├── modules/                                 # Reusable VPC, ECR, and EKS modules
│   │   ├── vpc/                                 # Multi-AZ VPC, subnets, NAT Gateway, IGW
│   │   ├── ecr/                                 # Container registry with lifecycle scanning
│   │   └── eks/                                 # EKS Cluster, node group, EBS CSI driver
│   ├── {main,variables,outputs,versions}.tf     # Core infrastructure orchestration
│   ├── github-oidc.tf                           # Optional GitHub Actions OIDC IAM role
│   ├── secrets.tf                               # AWS Secrets Manager DB credentials
│   ├── backup.tf                                # S3 automated backup bucket & lifecycle
│   ├── budget.tf                                # AWS budget & cost guardrail alerts
│   └── terraform.tfvars.example                 # Variables configuration template
├── plan/
│   └── TaskFlow-DevOps-LLM-Implementation-Plan.md
├── docker-compose.yml                           # Complete 9-container stack (Frontend, 6 Services, Redis, Postgres)
├── Dockerfile                                   # Root Dockerfile shortcut
└── README.md
```

---

## ⚙️ Environment Configuration

Configuration is loaded from environment variables with sensible defaults defined in [application.yml](file:///c:/Users/Sidharth/Desktop/taskflow-devops/services/task-service/src/main/resources/application.yml):

| Variable | Local Default (H2) | Docker Compose / Kubernetes (PostgreSQL) | Description |
|---|---|---|---|
| `SERVER_PORT` | `8080` | `8080` | Tomcat HTTP listen port |
| `SPRING_DATASOURCE_URL` | `jdbc:h2:mem:taskflowdb;...` | `jdbc:postgresql://postgres-service:5432/taskflowdb` | JDBC connection string |
| `SPRING_DATASOURCE_USERNAME` | `sa` | `taskflow` | Database user |
| `SPRING_DATASOURCE_PASSWORD` | `""` | `taskflow_secure_pwd_2026` | Database password |
| `SPRING_DATASOURCE_DRIVER_CLASS_NAME`| `org.h2.Driver` | `org.postgresql.Driver` | JDBC driver class |
| `SPRING_JPA_HIBERNATE_DDL_AUTO` | `update` | `update` | Schema migration mode |
| `MANAGEMENT_ENDPOINTS_WEB_EXPOSURE_INCLUDE` | `health,info,metrics,prometheus` | `health,info,metrics,prometheus` | Actuator endpoints |

---

## 💻 Local Development

### 1. Run with Maven (In-Memory H2)
```bash
cd services/task-service
mvn spring-boot:run
```
- API & Swagger UI: [http://localhost:8080/swagger-ui.html](http://localhost:8080/swagger-ui.html)
- H2 Console: [http://localhost:8080/h2-console](http://localhost:8080/h2-console) (JDBC URL: `jdbc:h2:mem:taskflowdb`, User: `sa`, Password: empty)

### 2. Run Automated Tests
```bash
cd services/task-service
mvn test
```

---

## 🐳 Running with Docker & Docker Compose

Docker Compose provisions the complete **9-container polyglot microservices stack** (`postgres:16-alpine`, `redis:7-alpine`, Java `task-service`, Node.js `auth`/`analytics`/`scheduler`, Golang `notification`, Rust `audit`, and Next.js `frontend`):

```bash
# Build and start all 9 containers in detached mode
docker compose up --build -d

# Check status and health checks across all services
docker compose ps

# Open the Next.js Control Plane UI in your browser:
# http://localhost:3000
# Demo login: admin@taskflow.dev / admin123

# Follow logs across services
docker compose logs -f frontend task-service auth-service notification-service audit-service

# Tear down the stack and remove persistent volumes
docker compose down -v
```

---

## ☸️ Kubernetes Deployment

### Option A: Local K3s Deployment (using `k3d`)

[k3d](https://k3d.io) runs lightweight K3s clusters inside Docker containers. It is fast, lightweight, and ideal for local Kubernetes testing on Windows, macOS, or Linux.

#### 1. Prerequisites
- Docker Desktop or Docker Engine running
- `kubectl` installed
- `k3d` installed (`choco install k3d` or `winget install k3d` on Windows, or `brew install k3d` on macOS)

#### 2. Create the K3s Cluster
Create a cluster named `taskflow` mapping NodePort `30080` to your host:
```bash
k3d cluster create taskflow \
  --api-port 6550 \
  -p "30080:30080@server:0" \
  -p "8081:80@loadbalancer"
```

> **Windows Tip**: If `kubectl` commands fail with a host timeout, see [Troubleshooting #1](#1-k3d-api-server-timeout-on-windows-hostdockerinternal).

#### 3. Build & Import Image into K3d
Build the Docker image locally and import it directly into the `k3d` cluster without needing a remote registry:
```bash
# Build all 7 container images
docker build -t taskflow-app:latest ./services/task-service
docker build -t taskflow-auth-service:latest ./services/auth-service
docker build -t taskflow-analytics-service:latest ./services/analytics-service
docker build -t taskflow-scheduler-service:latest ./services/scheduler-service
docker build -t taskflow-notification-service:latest ./services/notification-service
docker build -t taskflow-audit-service:latest ./services/audit-service
docker build -t taskflow-frontend:latest ./frontend

# Import the images into the k3d cluster
k3d image import \
  taskflow-app:latest \
  taskflow-auth-service:latest \
  taskflow-analytics-service:latest \
  taskflow-scheduler-service:latest \
  taskflow-notification-service:latest \
  taskflow-audit-service:latest \
  taskflow-frontend:latest \
  -c taskflow
```

#### 4. Deploy using Kustomize
Deploy the complete stack via the local overlay:
```bash
kubectl apply -k k8s/overlays/local
```

#### 5. Verify the Deployment
```bash
# Check all resources (including PersistentVolumes & PersistentVolumeClaims)
kubectl get all,pv,pvc,hpa,pdb -n taskflow

# Wait for application pods to be fully ready
kubectl wait --namespace taskflow --for=condition=ready pod -l app=taskflow-app --timeout=90s
```

#### 6. Access Application Endpoints
- **Next.js Control Plane UI**: [http://localhost:30088](http://localhost:30088)
- **Swagger UI**: [http://localhost:30080/swagger-ui.html](http://localhost:30080/swagger-ui.html)
- **Application Info**: [http://localhost:30080/api/info](http://localhost:30080/api/info)
- **Actuator Health**: [http://localhost:30080/actuator/health](http://localhost:30080/actuator/health)
- **Prometheus Metrics**: [http://localhost:30080/actuator/prometheus](http://localhost:30080/actuator/prometheus)

#### 7. Teardown
```bash
kubectl delete -k k8s/overlays/local
k3d cluster delete taskflow
```

---

### Option B: AWS EKS Deployment (`ap-southeast-2` Sydney)

> 📘 **Full AWS Step-by-Step Guide**: See [**`k8s/aws.md`**](file:///c:/Users/Sidharth/Desktop/taskflow-devops/k8s/aws.md) for complete instructions covering IAM CLI setup, custom VPC provisioning, Free-Tier `t3.micro` EKS & ECS Fargate paths, Docker Hub deployment, and safe teardown.

#### 1. Prerequisites
- AWS CLI configured (`aws configure` targeting `ap-southeast-2`)
- `terraform` (`>= 1.5.0`) and `kubectl` installed

#### 2. Provision VPC, 7 ECR Repositories & EKS via Terraform
```bash
cd terraform
terraform init
terraform apply -auto-approve
aws eks update-kubeconfig --region ap-southeast-2 --name taskflow-prod-cluster
```

#### 3. Build & Push All 7 Images (Docker Hub or Amazon ECR)
```bash
# Example using Docker Hub (matches k8s/overlays/eks/kustomization.yaml)
export DOCKER_USER="sidharthhhh"
docker build --platform linux/amd64 -t ${DOCKER_USER}/taskflow-app:latest ./services/task-service
docker build --platform linux/amd64 -t ${DOCKER_USER}/taskflow-auth-service:latest ./services/auth-service
docker build --platform linux/amd64 -t ${DOCKER_USER}/taskflow-analytics-service:latest ./services/analytics-service
docker build --platform linux/amd64 -t ${DOCKER_USER}/taskflow-scheduler-service:latest ./services/scheduler-service
docker build --platform linux/amd64 -t ${DOCKER_USER}/taskflow-notification-service:latest ./services/notification-service
docker build --platform linux/amd64 -t ${DOCKER_USER}/taskflow-audit-service:latest ./services/audit-service
docker build --platform linux/amd64 -t ${DOCKER_USER}/taskflow-frontend:latest ./frontend
```

#### 4. Deploy & Retrieve Public Frontend LoadBalancer URL
```bash
kubectl apply -k k8s/overlays/eks
kubectl get svc frontend-service -n taskflow -w
```
Once `EXTERNAL-IP` resolves (e.g., `xxx.ap-southeast-2.elb.amazonaws.com`), open **`http://<EXTERNAL-IP>`** in your browser to access the Next.js Control Plane UI!

#### 5. Teardown (Always delete K8s LoadBalancers before `terraform destroy`)
```bash
kubectl delete -k k8s/overlays/eks
cd terraform && terraform destroy -auto-approve
```

---

## 🌐 Whole AWS Cloud Environment Architecture

```mermaid
flowchart TD
    subgraph Internet ["Public Internet"]
        Client[Browser / User / API Client]
        GHRunner[GitHub Actions CI/CD Workflows]
    end

    subgraph AWS ["AWS Cloud (Region: ap-southeast-2 / Sydney)"]
        subgraph VPC ["Custom VPC: 10.0.0.0/16"]
            IGW["Internet Gateway"]

            subgraph PublicSubnets ["Public Subnets (ap-southeast-2a & 2b)"]
                ELB["AWS Load Balancer<br/>Internet-facing :80 -> :3000"]
                NATGW["NAT Gateway (in 2a)<br/>Elastic IP"]
            end

            subgraph PrivateSubnets ["Private Subnets (ap-southeast-2a & 2b)"]
                subgraph NodeGroup ["EKS Managed Node Group (AL2023, 2..6 x t3.micro)"]
                    subgraph K8sNamespace ["Kubernetes Namespace: taskflow"]
                        FrontSvc["frontend-service:3000 (Next.js UI & BFF)"]
                        TaskSvc["taskflow-service:8080 (Java Spring Boot)"]
                        AuthSvc["auth-service:3001 (Node.js JWT)"]
                        MeshSvcs["Analytics (:3002) · Scheduler (:3003)<br/>Notification (:8081 Go) · Audit (:8082 Rust)"]
                        RedisPod["redis-service:6379 (Redis 7 Pub/Sub & Cache)"]
                        DBPod["postgres-service:5432 (PostgreSQL 16)<br/>taskflowdb + authdb (PV/PVC)"]
                    end
                end
            end

            IGW --> ELB
            IGW --> NATGW
            NATGW --> FrontSvc
            ELB --> FrontSvc
            FrontSvc --> TaskSvc
            FrontSvc --> AuthSvc
            FrontSvc --> MeshSvcs
            TaskSvc --> DBPod
            AuthSvc --> DBPod
            MeshSvcs --> RedisPod
        end

        subgraph ManagedServices ["AWS Managed Cloud Services"]
            EKSControlPlane["Amazon EKS Control Plane (v1.31)<br/>Private & Public API Server"]
            ECR["7 Amazon ECR Repos (for_each)<br/>Scan on Push | 14d/30-img Lifecycle"]
            SecretsMgr["AWS Secrets Manager<br/>DB + JWT + Redis Credentials"]
            S3Backup["Amazon S3 Backup Bucket<br/>AES-256 Encrypted | Versioned | 30d Lifecycle"]
            Budgets["AWS Budgets Guardrail<br/>$25/mo Spend Limit | 80% & 100% Alerts"]
        end
    end

    Client --> IGW
    GHRunner -->|Push Images| ECR
    GHRunner -->|Deploy Overlay| EKSControlPlane
    EKSControlPlane -.->|Orchestrates| NodeGroup
    NodeGroup -->|Pulls Images| ECR
    NodeGroup -.->|Reads Secrets| SecretsMgr
    DBPod -.->|Backups| S3Backup
```

---

## 🤝 Manual Handshakes & Required Human Efforts

While Terraform, Docker, and GitHub Actions automate over 95% of provisioning, real-world cloud security and account boundaries require **10 critical manual handshakes**. Here is the complete operational checklist:

| # | Handshake Touchpoint | Why Human Effort is Mandatory | Exact Action Required | Location / Command |
|---|---|---|---|---|
| **1** | **AWS CLI & Credentials** | IaC cannot invent cloud permissions; it requires human authentication. | Run `aws configure` with an IAM user with EKS, VPC, EC2, IAM, ECR, S3, Secrets Manager, and Budgets permissions. | Local Terminal (`aws configure`) |
| **2** | **Remote State Bootstrap *(Optional)*** | Local Terraform state is default; S3 remote state requires the bucket to exist first. | *(Optional)* Run `cd terraform/bootstrap && terraform apply` and enable `backend "s3"` in `versions.tf`. | `terraform/bootstrap/` |
| **3** | **Variable Customization** | Real emails, private repositories, and AWS regions must never be hardcoded in Git. | Copy `terraform.tfvars.example` to `terraform.tfvars` and verify `budget_alert_email`, `github_repo`, and `aws_region` (`ap-southeast-2`). | `terraform/terraform.tfvars` |
| **4** | **AWS Budget Email Confirmation** | AWS SNS anti-spam compliance requires human verification before sending cost breach alerts. | Open your email inbox (`budget_alert_email`) and **click "Confirm Subscription"** in the automated AWS Budgets email. | Personal Email Inbox |
| **5** | **GitHub Actions & Docker Hub Secrets** | GitHub Actions runs externally and needs credentials to push images and deploy. | Configure `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, and `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` (or `AWS_ROLE_ARN`). | **GitHub Repo Settings > Secrets & variables > Actions** |
| **6** | **Local Kubeconfig Context** | Your local machine's `kubectl` CLI must be pointed to the new cloud cluster endpoint. | Run `aws eks update-kubeconfig --region ap-southeast-2 --name taskflow-prod-cluster` to establish cluster access. | Local Terminal (`aws eks update-kubeconfig`) |
| **7** | **AWS Load Balancer Exposure** | `frontend-service` uses EKS's in-tree LoadBalancer controller (`aws-load-balancer-scheme: internet-facing`). | No extra Helm controller needed; verify public subnets carry `kubernetes.io/role/elb = 1` (created by `modules/vpc`). | `k8s/overlays/eks/frontend-service-patch.yaml` |
| **8** | **External Secrets Operator** | Production database passwords must never be stored in plain text inside Git or Kubernetes manifests. | Install External Secrets Operator (or sync `taskflow/prod/db-credentials` into `secret.yaml`) before starting app pods. | EKS Cluster / Secrets Manager |
| **9** | **GitHub Deployment Approval Gate** | Production releases should be gated behind human authorization in enterprise environments. | In GitHub Settings, create environment `production` with required reviewers so deployments pause for your approval. | **GitHub Repo Settings > Environments > production** |
| **10**| **Teardown Sequence Order** | Dynamic NLBs and EBS ENIs created by Kubernetes will deadlock VPC deletion if destroyed out of order. | **Always delete Kubernetes services first** (`kubectl delete -k k8s/overlays/eks`), wait 2–3 minutes, and *then* run `terraform destroy`. | Terminal (`kubectl delete` -> `terraform destroy`) |

---

### Step-by-Step Instructions for Each Handshake

### 1. AWS CLI Credentials & Account Identity Handshake
- **Why Manual**: Terraform and AWS CLI cannot invent cloud permissions; they require authenticated human credentials.
- **Action Required**:
  ```bash
  aws configure
  # Enter AWS Access Key ID, Secret Access Key, default region (ap-southeast-2)
  
  # Verify active account identity
  aws sts get-caller-identity
  ```
- **Permission Check**: Ensure your IAM identity possesses permissions for VPC, EC2, EKS, IAM, ECR, S3, Secrets Manager, and Budgets.

---

### 2. Remote State Bootstrap Handshake *(Optional)*
- **Why Manual**: Local Terraform state is enabled by default in `terraform/versions.tf` for fast solo setup. If you want shared remote S3 state instead, provision the S3 bucket and DynamoDB lock table first:
  ```bash
  cd terraform/bootstrap
  terraform init
  terraform apply
  ```
- **Output Handshake**: Note `state_bucket_name` (e.g. `taskflow-prod-tfstate-666952271651`) and uncomment `backend "s3"` in `terraform/versions.tf`.

---

### 3. Variable Configuration Handshake (`terraform.tfvars`)
- **Why Manual**: Real-world identifiers (your personal email, region, repository path) must never be hardcoded into public repositories.
- **Action Required**:
  ```bash
  cd terraform
  cp terraform.tfvars.example terraform.tfvars
  ```
- Edit `terraform.tfvars` with:
  - `budget_alert_email = "your-actual-email@example.com"`
  - `github_repo = "sidharthhhh/taskflow-devops"`
  - `aws_region = "ap-southeast-2"`

---

### 4. AWS Budget Email Confirmation Handshake
- **Why Manual**: AWS SNS / Budgets enforces anti-spam compliance by requiring explicit human email verification.
- **Action Required**:
  1. After running `terraform apply`, open your email inbox (`budget_alert_email`).
  2. Find the automated email from **AWS Notifications / AWS Budgets**.
  3. **Click "Confirm Subscription"**. Until clicked, AWS will suppress threshold breach emails!

---

### 5. GitHub Actions Authentication & Docker Hub Secrets Handshake
- **Why Manual**: GitHub Actions runs outside AWS and Docker Hub and needs credentials to push images and deploy.
- **Action Required**:
  In your GitHub repository, open **Settings > Secrets and variables > Actions**:
  - **Secrets**: `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, and either `AWS_ROLE_ARN` (if OIDC is allowed) or `AWS_ACCESS_KEY_ID` + `AWS_SECRET_ACCESS_KEY` (when an AWS Organization SCP blocks OIDC creation).
  - **Variables**: `AWS_REGION=ap-southeast-2`, `EKS_CLUSTER_NAME=taskflow-prod-cluster`, `DEPLOY_ENABLED=true` (when ready for CD).

---

### 6. Local Kubeconfig Connection Handshake
- **Why Manual**: Your local machine's `kubectl` CLI does not automatically know where your new cloud cluster lives.
- **Action Required**:
  ```bash
  aws eks update-kubeconfig --region ap-southeast-2 --name taskflow-prod-cluster
  kubectl get nodes -o wide
  ```

---

### 7. AWS Load Balancer Exposure *(Automatic via In-Tree Controller)*
- **Note**: `k8s/overlays/eks/frontend-service-patch.yaml` uses EKS's built-in in-tree AWS LoadBalancer integration (`service.beta.kubernetes.io/aws-load-balancer-scheme: "internet-facing"`), so **no extra Helm Load Balancer Controller installation is required**.
- Simply ensure your VPC public subnets carry the `"kubernetes.io/role/elb" = "1"` tag (already handled by `terraform/modules/vpc`).

---

### 8. External Secrets Operator / DB Credentials Sync Handshake
- **Why Manual**: Production database passwords should never be stored in plain text inside Git or Kubernetes manifests.
- **Action Required**:
  - Terraform generates a random 24-character password in AWS Secrets Manager (`taskflow/prod/db-credentials`).
  - Install **External Secrets Operator** (`helm install external-secrets external-secrets/external-secrets -n kube-system`) or inject the credentials into Kubernetes `secret.yaml` before deployment so Spring Boot can authenticate.

---

### 9. GitHub Protected Environment Deployment Gate (Optional but Recommended)
- **Why Manual**: In production enterprise environments, automatic pushes to production should be gated behind human authorization.
- **Action Required**:
  1. In GitHub, open **Settings > Environments > New environment > `production`**.
  2. Check **Required reviewers** and assign yourself or your team lead.
  3. When CI finishes testing, GitHub Actions will pause and wait for you to click **"Review deployments -> Approve and deploy"**.

---

### 10. Destruction Order Handshake (Preventing VPC Deadlocks)
- **Why Manual**: When an AWS Network Load Balancer or EBS volume is created dynamically by Kubernetes, AWS attaches Elastic Network Interfaces (ENIs) inside your VPC subnets. If you run `terraform destroy` first, the VPC deletion will fail with `DependencyViolation`!
- **Action Required (Strict Destruction Sequence)**:
  ```bash
  # Step 1: ALWAYS delete Kubernetes services and StatefulSets first:
  kubectl delete -k k8s/overlays/eks

  # Step 2: Wait 2-3 minutes for AWS to release Load Balancers and ENIs

  # Step 3: Now cleanly destroy AWS infrastructure:
  cd terraform
  terraform destroy -auto-approve

  # Step 4: (Optional) Destroy bootstrap state storage:
  cd bootstrap
  terraform destroy -auto-approve
  ```

---

## 🔧 Comprehensive Troubleshooting Guide

This section covers common operational hurdles, real root causes, and verified fixes.

### 1. K3d API Server Timeout on Windows (`host.docker.internal`)
- **Symptom**: `kubectl get pods` hangs and outputs:
  ```text
  Unable to connect to the server: dial tcp: lookup host.docker.internal: no such host
  ```
  or times out when connecting to `https://host.docker.internal:<port>`.
- **Root Cause**: On Windows Docker Desktop, `host.docker.internal` in the generated kubeconfig can resolve to a physical LAN/Wi-Fi adapter IP instead of loopback (`127.0.0.1`), causing network route packet drops.
- **Fix**: Update the cluster server address in your kubeconfig to loopback `127.0.0.1`:
  ```powershell
  # Find your k3d API server port
  docker ps --filter "name=k3d-taskflow-server-0" --format "{{.Ports}}"

  # Update the cluster endpoint to 127.0.0.1 (replace 6550 with your port if different)
  kubectl config set-cluster k3d-taskflow --server=https://127.0.0.1:6550 --insecure-skip-tls-verify=true
  ```

---

### 2. PostgreSQL Pod Fails on Volume Mount (`lost+found`)
- **Symptom**: The PostgreSQL pod crashes with logs:
  ```text
  initdb: directory "/var/lib/postgresql/data" exists but is not empty
  It contains a lost+found directory, perhaps due to it being a mount point.
  ```
- **Root Cause**: When Kubernetes attaches a PersistentVolume (EBS on EKS or local-path on K3s), Linux creates a `lost+found` directory at the mount root. PostgreSQL refuses to run `initdb` on a non-empty directory.
- **Fix**: Direct PostgreSQL to use a sub-directory by setting `PGDATA` in [postgres-statefulset.yaml](file:///c:/Users/Sidharth/Desktop/taskflow-devops/k8s/base/postgres-statefulset.yaml):
  ```yaml
  env:
    - name: PGDATA
      value: /var/lib/postgresql/data/pgdata
  ```

---

### 3. Application Pod CrashLoopBackOff during Cold Start
- **Symptom**: Application pods restart 3–5 times before stabilizing, logging:
  ```text
  org.postgresql.util.PSQLException: Connection to postgres-service:5432 refused
  ```
- **Root Cause**: Kubernetes schedules both the app deployment and PostgreSQL StatefulSet simultaneously. Spring Boot starts in under 5 seconds and fails immediately because PostgreSQL is still running its initial database initialization script.
- **Fix**: We included a `wait-for-postgres` initContainer in [app-deployment.yaml](file:///c:/Users/Sidharth/Desktop/taskflow-devops/k8s/base/app-deployment.yaml). It uses `busybox` and `nc` to pause the app pod until port 5432 is actively accepting connections:
  ```yaml
  initContainers:
    - name: wait-for-postgres
      image: busybox:1.36
      command: ['sh', '-c', 'until nc -z -w 2 postgres-service 5432; do echo "Waiting for PostgreSQL..."; sleep 2; done;']
  ```

---

### 4. Hibernate 6 Enum Type Error on PostgreSQL (`ERROR: type "enum" does not exist`)
- **Symptom**: Spring Boot startup fails on PostgreSQL with:
  ```text
  org.hibernate.tool.schema.spi.CommandAcceptanceException: Error executing DDL:
  create table tasks (..., status enum ('TODO','IN_PROGRESS','DONE'))
  Caused by: org.postgresql.util.PSQLException: ERROR: type "enum" does not exist
  ```
- **Root Cause**: If `spring.jpa.database-platform` is hardcoded to `org.hibernate.dialect.H2Dialect` in `application.yml`, Hibernate produces MySQL/H2 DDL syntax that PostgreSQL rejects.
- **Fix**: 
  1. Add `@JdbcTypeCode(SqlTypes.VARCHAR)` above enum fields in [Task.java](file:///c:/Users/Sidharth/Desktop/taskflow-devops/services/task-service/src/main/java/com/taskflow/model/Task.java):
     ```java
     @Enumerated(EnumType.STRING)
     @JdbcTypeCode(SqlTypes.VARCHAR)
     @Column(nullable = false, length = 50)
     private TaskStatus status;
     ```
  2. Remove explicit `database-platform` from `application.yml` so Hibernate 6 auto-detects `PostgreSQLDialect` from the JDBC connection.

---

### 5. `ImagePullBackOff` / `ErrImagePull` on Local K3s/K3d
- **Symptom**: Pod status remains `ImagePullBackOff` or `ErrImagePull`.
- **Root Cause**: The local cluster runtime cannot find `taskflow-app:latest` because it is in your host Docker cache, not inside the K3s container runtime.
- **Fix**:
  1. Import the image into k3d:
     ```bash
     k3d image import taskflow-app:latest -c taskflow
     ```
  2. Ensure `imagePullPolicy: IfNotPresent` is configured in `app-deployment.yaml`.

---

### 6. Inspecting PostgreSQL Databases (`taskflowdb` & `authdb`) inside K8s
To debug data persistence or inspect records directly:
```bash
# Open an interactive psql session in the postgres-0 pod
kubectl exec -it -n taskflow postgres-0 -- psql -U taskflow -d taskflowdb

# Useful psql commands:
\l                   # List databases (taskflowdb & authdb)
\dt                  # List tables in taskflowdb
SELECT * FROM tasks; # View all task rows
\c authdb            # Switch to authdb
SELECT email, name, role FROM auth_users;
\q                   # Exit
```

---

### 7. Debugging Failed Pods & Viewing Container Logs
```bash
# View logs of the running app pods
kubectl logs -n taskflow -l app=taskflow-app -f

# View logs of the init container if a pod is stuck in Init:0/1
kubectl logs -n taskflow <pod-name> -c wait-for-postgres

# Describe pod events (check probe failures, scheduling errors, or OOMKilled)
kubectl describe pod -n taskflow <pod-name>

# Check recent namespace events
kubectl get events -n taskflow --sort-by='.metadata.creationTimestamp'
```

---

## 📡 API Testing & Examples

Test the endpoints using PowerShell (`Invoke-RestMethod`) or `curl`.

*(Replace port `30080` with `8080` if running locally without K3s)*

### 1. GET /api/info
```powershell
Invoke-RestMethod -Uri "http://localhost:30080/api/info" | ConvertTo-Json
```

### 2. POST /api/tasks (Create Task)
```powershell
$task = @{
    title = "Complete Kubernetes Setup"
    description = "Deploy TaskFlow to K3s and AWS EKS"
    status = "IN_PROGRESS"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:30080/api/tasks" -Method Post -ContentType "application/json" -Body $task | ConvertTo-Json
```

### 3. GET /api/tasks (List All)
```powershell
Invoke-RestMethod -Uri "http://localhost:30080/api/tasks" | ConvertTo-Json
```

### 4. GET /api/tasks?status=IN_PROGRESS (Filter by Status)
```powershell
Invoke-RestMethod -Uri "http://localhost:30080/api/tasks?status=IN_PROGRESS" | ConvertTo-Json
```

### 5. PUT /api/tasks/{id} (Update Task)
```powershell
$update = @{
    title = "Complete Kubernetes Setup"
    description = "Deploy TaskFlow to K3s and AWS EKS - All pods green!"
    status = "DONE"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:30080/api/tasks/1" -Method Put -ContentType "application/json" -Body $update | ConvertTo-Json
```

### 6. DELETE /api/tasks/{id} (Delete Task)
```powershell
Invoke-RestMethod -Uri "http://localhost:30080/api/tasks/1" -Method Delete
```

---

## 📊 Health & Metrics Endpoints

| Endpoint | Purpose | Description |
|---|---|---|
| `GET /actuator/health` | Overall Health | Status of database connection, disk space, and application |
| `GET /actuator/health/liveness` | K8s Liveness Probe | Verifies if the JVM process is alive and responsive |
| `GET /actuator/health/readiness`| K8s Readiness Probe | Verifies database connectivity before routing traffic |
| `GET /actuator/prometheus` | Metrics Scraping | Full Prometheus exposition format metrics for Grafana / Prometheus |
| `GET /swagger-ui.html` | Interactive Docs | OpenAPI 3 visual playground to test all endpoints |

---

## ☸️ Option C: Helm + ArgoCD GitOps + Grafana (Local k3d — Recommended)

The whole stack is packaged as a **Helm chart** (`helm/taskflow`) and deployed by **ArgoCD**
from the **`main`** branch. **Prometheus + Grafana** (kube-prometheus-stack) monitor every
microservice through a single dashboard: **TaskFlow Microservices**.

> 📘 Concepts and architecture, explained step by step: **[GITOPS-NOTES.md](GITOPS-NOTES.md)**

```text
git push ──▶ GitHub Actions (build images → Docker Hub, commit new image tag) ──▶ ArgoCD ──helm template──▶ namespace taskflow (7 services + Postgres + Redis)
                                            │
                                            └──▶ namespace monitoring (Prometheus ──▶ Grafana dashboard)
```

### What you get

| Component | URL | Login |
|---|---|---|
| **Frontend** | http://localhost:30088 | `admin@taskflow.dev` / `admin123` |
| **Task API (Swagger)** | http://localhost:30080/swagger-ui.html | – |
| **ArgoCD** | http://localhost:30880 | `admin` / run `scripts/local-creds.(ps1\|sh)` (random per install) |
| **Grafana** | http://localhost:30300 | `admin` / `taskflow-admin` |
| **Prometheus** | http://localhost:30090 | – |

### 1. Prerequisites

| Tool | Tested version | Windows (PowerShell, admin) | Linux |
|---|---|---|---|
| Docker | 29.x | `winget install Docker.DockerDesktop` | `curl -fsSL https://get.docker.com \| sh` then `sudo usermod -aG docker $USER` (log out and back in) |
| k3d | 5.x | `winget install k3d` | `curl -s https://raw.githubusercontent.com/k3d-io/k3d/main/install.sh \| bash` |
| kubectl | 1.31+ | `winget install Kubernetes.kubectl` (also bundled with Docker Desktop) | `curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl" && sudo install kubectl /usr/local/bin/` |
| Helm | 3.16 | `winget install Helm.Helm` | `curl -fsSL https://raw.githubusercontent.com/helm/helm/main/scripts/get-helm-3 \| bash` |
| Git | any | `winget install Git.Git` | `sudo apt install -y git` |
| ArgoCD CLI *(optional)* | 3.6.2 | `winget install argoproj.argocd` | `curl -sSL -o argocd https://github.com/argoproj/argo-cd/releases/download/v3.6.2/argocd-linux-amd64 && sudo install argocd /usr/local/bin/` |

> 💾 Give Docker **at least 6 GB of RAM** (Docker Desktop → Settings → Resources, or the WSL2 `.wslconfig` limit).
> The full stack uses about 2.5 GB. Ports **30080, 30088, 30090, 30300, 30880** must be free.

Verify the tools:
```bash
docker info --format '{{.ServerVersion}}'; k3d version; kubectl version --client; helm version --short; git --version
```

### 2. Create the whole infrastructure — one command

> 🐳 **Every image comes from Docker Hub**, built by the GitHub Actions pipeline
> (`docker.io/sidharthhhh/<service>:<git-sha>`). There is **no local `docker build`** and no `k3d image import`.
> ArgoCD tracks the `main` branch **on GitHub**, where the CD pipeline commits each new image tag.
> Requirements: the Docker Hub repos are public (or the cluster has a pull secret) and the GitHub repo is readable by ArgoCD.

**Windows (PowerShell):**
```powershell
cd C:\path\to\taskflow-devops
powershell -ExecutionPolicy Bypass -File .\scripts\local-up.ps1
powershell -ExecutionPolicy Bypass -File .\scripts\local-creds.ps1          # print ArgoCD + Grafana logins
```

**Windows (Git Bash)** or **Linux / macOS:**
```bash
cd ~/taskflow-devops
chmod +x scripts/*.sh
./scripts/local-up.sh
./scripts/local-creds.sh            # print ArgoCD + Grafana logins
```

Both scripts are **idempotent** (safe to re-run) and do the following:
1. Create the k3d cluster `taskflow` (Traefik disabled, NodePorts mapped to localhost) and point kubeconfig at `127.0.0.1`.
2. Install ArgoCD with Helm (`argo/argo-cd` chart 10.18.2).
3. Apply the ArgoCD `AppProject` and the `taskflow` + `monitoring` Applications. ArgoCD then pulls the chart from GitHub and installs everything else, pulling the images from Docker Hub.

Wait until both apps show `Synced / Healthy` (about 3-5 min on the first run):
```bash
kubectl get applications -n argocd -w
```

### 3. Manual step-by-step (what the scripts do)

Run these if you want to learn each step or a script fails partway. They are bash commands.
On **PowerShell**, the only difference is the line continuation: use a backtick (`` ` ``) instead of `\`, or put the command on one line.

```bash
# 3.1 Cluster
k3d cluster create taskflow --servers 1 --agents 0 \
  --k3s-arg "--disable=traefik@server:0" \
  -p "30080:30080@server:0" -p "30088:30088@server:0" -p "30300:30300@server:0" \
  -p "30880:30880@server:0" -p "30090:30090@server:0" --wait
kubectl config use-context k3d-taskflow
kubectl config view -o jsonpath="{.clusters[?(@.name=='k3d-taskflow')].cluster.server}"   # note the port
kubectl config set-cluster k3d-taskflow --server=https://127.0.0.1:<PORT>                  # Windows fix

# 3.2 ArgoCD
helm repo add argo https://argoproj.github.io/argo-helm && helm repo update
helm upgrade --install argocd argo/argo-cd --version 10.18.2 -n argocd --create-namespace \
  -f argocd/install/argocd-values.yaml --wait

# 3.3 ArgoCD project + apps (they point at github.com/sidharthhhh/taskflow-devops, branch main)
kubectl apply -f argocd/project.yaml
kubectl apply -f argocd/applications/
```

> 🔒 **Private GitHub repo?** Register it first:
> `argocd repo add https://github.com/sidharthhhh/taskflow-devops.git --username <user> --password <PAT>`.
> **Private Docker Hub repos?** Create a pull secret and reference it with `imagePullSecrets`.

### 4. Day-to-day GitOps workflow

Everything goes through GitHub — the same path for you and for CI:

```text
edit code → git commit → git push origin main
   → GitHub Actions: tests, builds 7 images, pushes docker.io/sidharthhhh/<svc>:<sha>
   → CD commits "deploy: bump image tag to <sha> [skip ci]" into helm/taskflow/values.yaml
   → ArgoCD (polls GitHub every 60s) syncs → pods roll to the new image
```

| I want to… | Do this |
|---|---|
| Ship a code / UI change | edit → `git commit` → `git push origin main` → wait for the **CD** run to finish (GitHub → Actions) → ArgoCD syncs within ~1 min → hard-refresh the browser (Ctrl+F5) |
| Change config / replicas / resources | edit `helm/taskflow/values*.yaml` → commit → push |
| Sync now instead of waiting 60s | `kubectl -n argocd annotate application taskflow argocd.argoproj.io/refresh=hard --overwrite` (or *Refresh* in the ArgoCD UI) |
| Pull the CI bot's tag-bump commit | `git pull origin main` (**do this before your next push**, otherwise the push is rejected as non-fast-forward) |
| Edit the Grafana dashboard | edit in Grafana → *Export → JSON* → save to `helm/taskflow/dashboards/taskflow-microservices.json` → commit → push |
| Upgrade Prometheus/Grafana | change `targetRevision` in `argocd/applications/monitoring.yaml` → commit → push |
| Roll back | `git revert <commit>` → push (or `argocd app rollback taskflow <ID>`) |
| Pause / resume the cluster | `k3d cluster stop taskflow` / `k3d cluster start taskflow` |
| Delete everything | `k3d cluster delete taskflow` |

> ⚠️ After `k3d cluster start`, kubeconfig may point at `host.docker.internal` again. Re-run the
> `set-cluster ... 127.0.0.1` fix (see §3.1), or just re-run the up script.

### 5. Debugging command reference

Commands are the same on Windows and Linux unless marked. On PowerShell, replace `| grep x` with `| Select-String x`
and `| base64 -d` with the `local-creds.ps1` script.

#### 5.1 Cluster & kubeconfig
```bash
k3d cluster list                                   # is the cluster there / running?
docker ps --filter name=k3d-taskflow               # k3d node containers
kubectl config current-context                     # must be k3d-taskflow
kubectl config get-contexts
kubectl cluster-info
kubectl get nodes -o wide
kubectl top nodes                                  # CPU/RAM (metrics-server is built into k3s)
kubectl get --raw='/readyz?verbose'                # API server health checks
```

#### 5.2 Workloads — what is running and what's broken
```bash
kubectl get all -n taskflow
kubectl get pods -A -o wide                        # every pod in every namespace
kubectl get pods -n taskflow --field-selector=status.phase!=Running
kubectl describe pod <pod> -n taskflow             # Events: probe failures, OOMKilled, image errors
kubectl get events -n taskflow --sort-by=.lastTimestamp
kubectl get events -A --field-selector type=Warning
kubectl top pods -n taskflow --containers          # live CPU / memory per container
kubectl rollout status deploy/auth-service -n taskflow
kubectl rollout history deploy/auth-service -n taskflow
kubectl get pvc,pv -A                              # storage
kubectl get hpa -n taskflow                        # autoscaler targets
# Why did a container restart? (OOMKilled / Error / exit code)
kubectl get pod <pod> -n taskflow -o jsonpath='{.status.containerStatuses[*].lastState.terminated}'
```

#### 5.3 Logs
```bash
kubectl logs deploy/auth-service -n taskflow                 # current logs
kubectl logs deploy/auth-service -n taskflow -f --tail=100   # follow
kubectl logs <pod> -n taskflow --previous                    # logs from the crashed container
kubectl logs <pod> -n taskflow -c wait-for-postgres          # init container (pod stuck in Init:0/1)
kubectl logs -n taskflow -l app.kubernetes.io/part-of=taskflow --tail=20 --prefix   # all services at once
```

#### 5.4 Shell, networking & service-to-service calls
```bash
kubectl exec -it deploy/auth-service -n taskflow -- sh       # shell into a running container
# Throw-away debug pod with curl + DNS tools, inside the cluster network:
kubectl run debug -n taskflow --rm -it --image=nicolaka/netshoot -- bash
#   curl http://auth-service:3001/health
#   curl http://taskflow-service:8080/actuator/health
#   nslookup postgres-service
kubectl get endpoints -n taskflow                            # empty = no ready pod behind the Service
kubectl port-forward svc/analytics-service 3002:3002 -n taskflow   # reach a ClusterIP service from your laptop
```
Port checks on the host:
```powershell
# Windows
Test-NetConnection localhost -Port 30880
netstat -ano | findstr :30880
```
```bash
# Linux
curl -I http://localhost:30880
ss -ltnp | grep 30880
```

#### 5.5 ArgoCD
```bash
kubectl get applications -n argocd                           # SYNC / HEALTH for every app
kubectl describe application taskflow -n argocd              # conditions + last sync result
kubectl get application taskflow -n argocd -o jsonpath='{.status.operationState.message}'
kubectl -n argocd annotate application taskflow argocd.argoproj.io/refresh=hard --overwrite   # re-read git now
kubectl logs -n argocd deploy/argocd-repo-server --tail=50              # git clone / helm template errors
kubectl logs -n argocd statefulset/argocd-application-controller --tail=50   # sync / apply errors
kubectl logs -n argocd deploy/argocd-server --tail=50                   # UI / login problems
```
With the ArgoCD CLI (log in once):
```bash
argocd login localhost:30880 --username admin --password <password> --plaintext --grpc-web
argocd app list
argocd app get taskflow                  # resource tree with per-object status
argocd app diff taskflow                 # git vs cluster
argocd app sync taskflow                 # sync now
argocd app sync monitoring --server-side
argocd app terminate-op monitoring       # kill a stuck "Running" sync
argocd app history taskflow
argocd app rollback taskflow <ID>        # note: turns off auto-sync
argocd app manifests taskflow            # exactly what ArgoCD renders
argocd repo list                         # repo connection status
```

#### 5.6 Helm chart
```bash
helm lint helm/taskflow -f helm/taskflow/values.yaml -f helm/taskflow/values-local.yaml
helm template taskflow helm/taskflow -n taskflow -f helm/taskflow/values.yaml -f helm/taskflow/values-local.yaml > rendered.yaml
helm template ... --show-only templates/microservices.yaml         # render one template
helm template ... --set services.auth.replicas=2                   # try an override
kubectl diff -f rendered.yaml -n taskflow                          # what would change in the cluster
helm list -A                                                       # Helm releases (only argocd; apps are owned by ArgoCD)
helm get values argocd -n argocd                                   # values used for the ArgoCD install
```

#### 5.7 Which image is running? (CI tag → GitHub → ArgoCD → pods)
```bash
kubectl get deploy -n taskflow -o custom-columns=NAME:.metadata.name,IMAGE:.spec.template.spec.containers[0].image
kubectl get application taskflow -n argocd -o jsonpath='{.status.sync.revision}{"\n"}'   # commit ArgoCD deployed
git ls-remote origin main                                                         # latest commit on GitHub - should match
sed -n '/^image:/,/pullPolicy/p' helm/taskflow/values.yaml                                # tag CI wrote (Linux / Git Bash)
# 200 = that image tag exists on Docker Hub (replace <sha> with the tag):
curl -s -o /dev/null -w '%{http_code}\n' https://hub.docker.com/v2/repositories/sidharthhhh/taskflow-frontend/tags/<sha>
```
```powershell
# Windows: show the tag CI wrote
Select-String -Path helm\taskflow\values.yaml -Pattern '^  tag:'
```
If the pods run an **old image**, either ArgoCD hasn't synced the tag-bump commit yet (revision ≠ GitHub), or the CD
workflow didn't finish / didn't push images (check GitHub → Actions → *CD - Build Images & GitOps Deploy*).

#### 5.8 Prometheus
```bash
kubectl get pods -n monitoring
kubectl get servicemonitors -A
# Targets: open http://localhost:30090/targets  (serviceMonitor/taskflow/taskflow-app should be UP)
curl -s http://localhost:30090/api/v1/targets?state=active | python -m json.tool | grep -E '"job"|"health"'
# Run any PromQL from the terminal
curl -s --get http://localhost:30090/api/v1/query --data-urlencode 'query=kube_deployment_status_replicas_available{namespace="taskflow"}'
kubectl logs -n monitoring prometheus-monitoring-kube-prometheus-prometheus-0 -c prometheus --tail=50
kubectl logs -n monitoring deploy/monitoring-kube-prometheus-operator --tail=50
```

#### 5.9 Grafana
```bash
kubectl logs -n monitoring deploy/monitoring-grafana -c grafana --tail=50
kubectl logs -n monitoring deploy/monitoring-grafana -c grafana-sc-dashboard --tail=50   # dashboard loader sidecar
kubectl get cm -A -l grafana_dashboard=1                                     # dashboards the sidecar will load
curl -s -u admin:taskflow-admin "http://localhost:30300/api/search?type=dash-db"   # dashboards Grafana has
curl -s -u admin:taskflow-admin http://localhost:30300/api/datasources       # Prometheus datasource
# Reset the admin password
kubectl exec -n monitoring deploy/monitoring-grafana -c grafana -- grafana cli admin reset-admin-password taskflow-admin
```

#### 5.10 PostgreSQL & Redis
```bash
kubectl exec -it postgres-0 -n taskflow -- psql -U taskflow -d taskflowdb      # \dt, SELECT * FROM tasks;
kubectl exec -it postgres-0 -n taskflow -- psql -U taskflow -d authdb
kubectl exec -it deploy/redis -n taskflow -- redis-cli ping
kubectl exec -it deploy/redis -n taskflow -- redis-cli keys '*'
kubectl exec -it deploy/redis -n taskflow -- redis-cli subscribe taskflow:events   # watch live events
```

#### 5.11 Images inside k3d
```bash
docker exec k3d-taskflow-server-0 crictl images | grep sidharthhhh      # images the node has pulled from Docker Hub
kubectl get events -n taskflow --sort-by=.lastTimestamp | grep -i -E "pull|image"
kubectl describe pod <pod> -n taskflow | grep -A3 -i "image"            # Image / Image ID / pull events
kubectl get pods -n taskflow -o jsonpath='{range .items[*]}{.metadata.name}{"\t"}{.spec.containers[0].image}{"\n"}{end}'
```

### 6. Common problems & fixes

| Symptom | Cause | Fix |
|---|---|---|
| `kubectl` hangs / `dial tcp 192.168.x.x ... timeout` (Windows) | kubeconfig uses `host.docker.internal` → firewalled LAN IP | `kubectl config set-cluster k3d-taskflow --server=https://127.0.0.1:<port>` (§3.1) |
| `failed to connect to the docker API ... dockerDesktopLinuxEngine` | Docker Desktop isn't running | Start Docker Desktop, wait for "Engine running" |
| `helm is not installed / not on PATH` (PowerShell) | Helm installed only for Git Bash | `winget install Helm.Helm`, then open a new terminal |
| Pod `ImagePullBackOff` / `ErrImagePull` | the tag isn't on Docker Hub yet (CD still running or failed), the repo is private, or the cluster has no internet | check GitHub → Actions; run the `curl` check in §5.7; make the Docker Hub repo public or add a pull secret |
| UI/code change doesn't show up | ArgoCD still on the old commit, CD didn't bump the tag, or browser cache | compare `.status.sync.revision` with `git ls-remote origin main` (§5.7); refresh the app; Ctrl+F5 |
| `git push` rejected: *non-fast-forward* | the CD bot committed the image-tag bump after your last pull | `git pull --rebase origin main`, then push again |
| App `Unknown` / `ComparisonError ... repository not found` | GitHub unreachable, branch missing, or private repo | `kubectl logs -n argocd deploy/argocd-repo-server --tail=50`; for a private repo run `argocd repo add ...` (§3) |
| `namespace kube-system is not permitted in project` | AppProject missing a destination | already allowed in `argocd/project.yaml`; re-apply it |
| `no matches for kind "ServiceMonitor"` on first install | taskflow synced before monitoring installed the CRDs | it retries automatically (retry limit 20); or `argocd app sync taskflow` |
| Sync stuck in `Running` on an old commit | an earlier sync is still retrying | `argocd app terminate-op <app>` then `argocd app sync <app>` |
| Grafana `CrashLoopBackOff`, `OOMKilled` | memory limit too low (Grafana 13 needs >256Mi) | limit is 512Mi in `monitoring/kube-prometheus-stack-values.yaml` |
| Dashboard panels say "No data" | Prometheus target down or wrong time range | check http://localhost:30090/targets; send some traffic to the Task API |
| Port 30xxx already in use | another cluster/app uses it | `k3d cluster list`; delete old clusters or change the `-p` mappings |
| `local-up.ps1 cannot be loaded ... running scripts is disabled` | PowerShell execution policy | run with `powershell -ExecutionPolicy Bypass -File ...` |
