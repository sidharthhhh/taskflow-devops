# 🚀 TaskFlow DevOps: AWS Production Deployment Guide
**Target Region:** `ap-southeast-2` (Asia Pacific - Sydney)  
**AWS Account ID:** `666952271651`  
**EKS Console URL:** [AWS EKS Console (Sydney)](https://666952271651-ardh7d5x.ap-southeast-2.console.aws.amazon.com/eks/clusters?region=ap-southeast-2)  
**Repository:** [github.com/sidharthhhh/taskflow-devops](https://github.com/sidharthhhh/taskflow-devops)  
**Active Working Branch:** `sidharth/feature`  

---

## 📑 Table of Contents

1. [Executive Architecture Overview](#1-executive-architecture-overview)
2. [Local Laptop Tooling & Prerequisites (Windows & Unix)](#2-local-laptop-tooling--prerequisites)
3. [AWS IAM Identity & CLI Configuration (Full Access)](#3-aws-iam-identity--cli-configuration)
4. [Docker Hub Container Build & Push Workflow](#4-docker-hub-container-build--push-workflow)
5. [Custom VPC Provisioning in Sydney (ap-southeast-2)](#5-custom-vpc-provisioning-in-sydney-ap-southeast-2)
6. [Cluster Provisioning Path A: Amazon EKS (Kubernetes Standard)](#6-cluster-provisioning-path-a-amazon-eks-primary)
7. [Cluster Provisioning Path B: Amazon ECS Fargate (Fast & Low-Cost Alternative)](#7-cluster-provisioning-path-b-amazon-ecs-fargate-alternative)
8. [GitHub Actions CI/CD Pipeline Integration (Keyless OIDC)](#8-github-actions-cicd-pipeline-integration)
9. [Application Verification, Health Checks & Observability](#9-application-verification-health-checks--observability)
10. [Cost Guardrails, Resource Cleanup & Safe Teardown](#10-cost-guardrails-resource-cleanup--safe-teardown)
11. [Master Implementation Plan Correlation (Phases 0–10)](#11-master-implementation-plan-correlation)

---

## 1. Executive Architecture Overview

This project implements an enterprise-grade cloud-native infrastructure for the **TaskFlow** Java 17 Spring Boot REST API and PostgreSQL 16 database.

```text
                                  [ Internet / Developer / Curl ]
                                                 |
                                                 v
                               +-----------------------------------+
                               | AWS Network Load Balancer (NLB)   |
                               | (Public Subnets: ap-southeast-2a) |
                               +-----------------+-----------------+
                                                 |
                                                 v
     +---------------------------------------------------------------------------------------+
     | Dedicated Custom VPC: 10.0.0.0/16 (Region: ap-southeast-2 / Sydney)                  |
     |                                                                                       |
     |  [Public Subnet 1: 10.0.1.0/24 (2a)]         [Public Subnet 2: 10.0.2.0/24 (2b)]      |
     |  - NAT Gateway (Elastic IP)                   - Internet Gateway Route                |
     |  - Public NLB Ingress                         - Public NLB Ingress                    |
     |                                                                                       |
     |  [Private Subnet 1: 10.0.10.0/24 (2a)]       [Private Subnet 2: 10.0.20.0/24 (2b)]    |
     |  - EKS Managed Nodes (t3.micro)              - EKS Managed Nodes (t3.micro)           |
     |  - TaskFlow Pods (Spring Boot 3)             - TaskFlow Pods (Spring Boot 3)          |
     |  - PostgreSQL StatefulSet (EBS gp3 1Gi)      - HPA Autoscaler (2..5 replicas)         |
     +---------------------------------------------------------------------------------------+
              ^                                                         ^
              | Image Pull                                              | Keyless OIDC (AssumeRole)
     +--------+-----------+                                    +--------+------------------+
     | Docker Hub / ECR   |                                    | GitHub Actions CI/CD     |
     | sidharthhhh/       |                                    | Branch: sidharth/feature |
     | taskflow-app       |                                    +--------------------------+
     +--------------------+
```

### Key Technical Specifications
| Attribute | Specification |
| :--- | :--- |
| **AWS Region** | `ap-southeast-2` (Sydney, Australia) |
| **Availability Zones** | `ap-southeast-2a`, `ap-southeast-2b` |
| **VPC CIDR** | `10.0.0.0/16` (Dedicated custom isolated network) |
| **Subnet Scheme** | 2 Public (`10.0.1.0/24`, `10.0.2.0/24`) & 2 Private (`10.0.10.0/24`, `10.0.20.0/24`) |
| **Primary Compute** | Amazon EKS Managed Node Groups (`t3.micro` - Free Tier Eligible) |
| **Fast-Track Compute**| Amazon ECS Fargate (Serverless container runtime, no cluster fee) |
| **Storage Backend** | AWS EBS CSI Driver (`gp3` dynamically provisioned volumes) |
| **Image Registry** | Docker Hub (`<username>/taskflow-app`) + Amazon ECR |
| **Git Repository** | `https://github.com/sidharthhhh/taskflow-devops` (`sidharth/feature`) |

---

## 2. Local Laptop Tooling & Prerequisites

Run your terminal as **Administrator** (PowerShell on Windows, or standard shell on macOS/Linux).

### 2.1 Tooling Installation

#### On Windows (PowerShell)
```powershell
# 1. Install AWS CLI v2
winget install Amazon.AWSCLI --accept-package-agreements --accept-source-agreements

# 2. Install Kubernetes CLI (kubectl)
winget install Kubernetes.kubectl --accept-package-agreements --accept-source-agreements

# 3. Install EKS CLI (eksctl)
winget install Weaveworks.eksctl --accept-package-agreements --accept-source-agreements

# 4. Install Terraform CLI
winget install Hashicorp.Terraform --accept-package-agreements --accept-source-agreements

# 5. Ensure Docker Desktop is installed and running
# Download from https://www.docker.com/products/docker-desktop/ if not already installed
```

#### On macOS / Linux (Homebrew)
```bash
brew install awscli kubectl eksctl terraform
```

### 2.2 Verify Installed Versions
Open a fresh PowerShell/Bash terminal and verify:
```powershell
aws --version
kubectl version --client
eksctl version
terraform -version
docker --version
```

---

## 3. AWS IAM Identity & CLI Configuration

You need an IAM user or role with full administrative permissions to create the VPC, EKS cluster, IAM roles, NAT Gateways, and security groups.

### 3.1 Create IAM Admin User in AWS Console

1. Log into your AWS Console:
   `https://666952271651-ardh7d5x.ap-southeast-2.console.aws.amazon.com/`
2. Navigate to **IAM** -> **Users** -> Click **Create user**.
3. **User name:** `taskflow-admin` (or your preferred username).
4. **Permissions options:** Choose **Attach policies directly**.
5. Search for and select:
   - `AdministratorAccess` (Provides complete control over VPC, EKS, EC2, IAM, S3, ECS, and Secrets Manager).
6. Complete creation, click on the newly created user `taskflow-admin`.
7. Go to the **Security credentials** tab.
8. Scroll down to **Access keys** -> Click **Create access key**.
9. Select **Command Line Interface (CLI)**, accept the acknowledgement, and click **Next**.
10. Copy and safely store:
    - **Access Key ID** (e.g. `AKIA...`)
    - **Secret Access Key** (e.g. `wJalrXUtnFEMI/K7MDENG/bPxRfiCY...`)

---

### 3.2 Configure AWS CLI on Your Laptop

In your laptop PowerShell terminal, run:

```powershell
aws configure
```

Enter your details when prompted:
```text
AWS Access Key ID [None]: <YOUR_ACCESS_KEY_ID>
AWS Secret Access Key [None]: <YOUR_SECRET_ACCESS_KEY>
Default region name [None]: ap-southeast-2
Default output format [None]: json
```

> [!IMPORTANT]
> Always verify that the default region is explicitly set to **`ap-southeast-2`**.

### 3.3 Validate AWS Identity & Region from Laptop

Run the verification commands:

```powershell
# Check current authenticated identity and account ID (Must show 666952271651)
aws sts get-caller-identity

# Confirm default region is Sydney (ap-southeast-2)
aws configure get region

# Test EC2 API accessibility in ap-southeast-2
aws ec2 describe-availability-zones --region ap-southeast-2 --output table
```

Output should confirm availability of:
- `ap-southeast-2a`
- `ap-southeast-2b`
- `ap-southeast-2c`

---

## 4. Docker Hub Container Build & Push Workflow

The user requested: *"i also wanna upload the image on docker hub then deploy on aws cluster."*

### 4.1 Login to Docker Hub from Your Laptop

```powershell
# Replace with your Docker Hub username
docker login -u <YOUR_DOCKERHUB_USERNAME>
```
Enter your Docker Hub password or Personal Access Token (PAT).

---

### 4.2 Build and Tag the Image

Navigate to your workspace root (`taskflow-devops`):

```powershell
cd c:\Users\Sidharth\Desktop\taskflow-devops

# Set your Docker Hub username variable
$DOCKER_USER="<YOUR_DOCKERHUB_USERNAME>"

# Build the production multi-stage container
# Target linux/amd64 architecture to guarantee compatibility with AWS EC2/EKS nodes
docker build --platform linux/amd64 `
  -t ${DOCKER_USER}/taskflow-app:latest `
  -t ${DOCKER_USER}/taskflow-app:v1.0.0 `
  -f app/Dockerfile ./app
```

---

### 4.3 Push the Image to Docker Hub

```powershell
docker push ${DOCKER_USER}/taskflow-app:latest
docker push ${DOCKER_USER}/taskflow-app:v1.0.0
```

> [!TIP]
> Ensure your Docker Hub repository `<YOUR_DOCKERHUB_USERNAME>/taskflow-app` is set to **Public** so that Kubernetes and ECS can pull the image without needing imagePullSecrets.
> If private, create a Kubernetes secret:
> ```powershell
> kubectl create secret docker-registry dockerhub-secret `
>   --docker-server=https://index.docker.io/v1/ `
>   --docker-username=<YOUR_DOCKERHUB_USERNAME> `
>   --docker-password=<YOUR_DOCKERHUB_TOKEN> `
>   --docker-email=<YOUR_EMAIL> -n taskflow
> ```

---

## 5. Custom VPC Provisioning in Sydney (ap-southeast-2)

The codebase contains a modular Terraform architecture (`terraform/modules/vpc`) that provisions a custom VPC with isolated public and private subnets, an Internet Gateway, an Elastic IP, a NAT Gateway, route tables, and Kubernetes discovery tags.

### 5.1 Configure `terraform/terraform.tfvars` for Sydney

Create or edit `terraform/terraform.tfvars` on your laptop:

```powershell
# Create terraform.tfvars directly in the terraform directory
New-Item -Path "terraform/terraform.tfvars" -ItemType File -Force
```

Populate `terraform/terraform.tfvars` with:

```hcl
# =============================================================================
# TaskFlow Terraform Configuration for ap-southeast-2 (Sydney)
# =============================================================================

aws_region   = "ap-southeast-2"
project_name = "taskflow"
environment  = "prod"
owner        = "Sidharth"
github_repo  = "sidharthhhh/taskflow-devops"

# Custom VPC Network Configuration (ap-southeast-2)
vpc_cidr             = "10.0.0.0/16"
availability_zones   = ["ap-southeast-2a", "ap-southeast-2b"]
public_subnet_cidrs  = ["10.0.1.0/24", "10.0.2.0/24"]
private_subnet_cidrs = ["10.0.10.0/24", "10.0.20.0/24"]

# EKS Cluster & Managed Node Group Configuration
cluster_version      = "1.31"
node_instance_types  = ["t3.micro"] # Free Tier Eligible instance type
node_desired_size    = 2
node_min_size        = 2
node_max_size        = 4

# API Endpoint access
cluster_endpoint_public_access_cidrs = ["0.0.0.0/0"]

# Container Registry & Budgets
ecr_repository_name      = "taskflow-app"
ecr_image_tag_mutability = "MUTABLE"
enable_budget            = true
monthly_budget_limit     = "25.0"
budget_alert_email       = "your-alert-email@example.com"
```

---

### 5.2 Initialize & Apply Custom VPC

Run Terraform from PowerShell:

```powershell
cd c:\Users\Sidharth\Desktop\taskflow-devops\terraform

# Initialize Terraform plugins
terraform init

# Validate configuration
terraform validate

# Provision the Custom VPC first
terraform apply -target=module.vpc -auto-approve
```

#### What this creates:
- **VPC:** `taskflow-prod-vpc` (`10.0.0.0/16`) in `ap-southeast-2`
- **Public Subnet 1:** `10.0.1.0/24` in `ap-southeast-2a` with tag `kubernetes.io/role/elb=1`
- **Public Subnet 2:** `10.0.2.0/24` in `ap-southeast-2b` with tag `kubernetes.io/role/elb=1`
- **Private Subnet 1:** `10.0.10.0/24` in `ap-southeast-2a` with tag `kubernetes.io/role/internal-elb=1`
- **Private Subnet 2:** `10.0.20.0/24` in `ap-southeast-2b` with tag `kubernetes.io/role/internal-elb=1`
- **Internet Gateway & NAT Gateway** with dedicated Elastic IP

---

## 6. Cluster Provisioning Path A: Amazon EKS (Primary)

This is the primary production target defined in the project implementation plan.

### 6.1 Provision Full EKS Infrastructure with Terraform

```powershell
cd c:\Users\Sidharth\Desktop\taskflow-devops\terraform

# Apply full stack (VPC, ECR, EKS Cluster, Node Groups, OIDC, EBS CSI Addon)
terraform apply -auto-approve
```

> [!NOTE]
> EKS cluster creation and managed node group bootstrapping typically takes 10 to 15 minutes.

---

### 6.2 Connect `kubectl` to your EKS Cluster

Once Terraform completes, update your local kubeconfig:

```powershell
aws eks update-kubeconfig --region ap-southeast-2 --name taskflow-prod-cluster
```

Verify cluster access and nodes:

```powershell
# Verify cluster connection
kubectl cluster-info

# Check that worker nodes are in Ready status
kubectl get nodes -o wide
```

---

### 6.3 Deploy AWS EBS GP3 StorageClass

The PostgreSQL database uses a persistent volume claim (`PVC`). Apply the standard AWS `gp3` storage class:

Create `k8s/overlays/eks/gp3-storageclass.yaml`:

```yaml
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: gp3
  annotations:
    storageclass.kubernetes.io/is-default-class: "true"
provisioner: ebs.csi.aws.com
volumeBindingMode: WaitForFirstConsumer
parameters:
  type: gp3
  fsType: ext4
```

Apply it:
```powershell
kubectl apply -f k8s/overlays/eks/gp3-storageclass.yaml
```

---

### 6.4 Deploy TaskFlow Using Docker Hub Image

Update `k8s/overlays/eks/kustomization.yaml` to deploy your Docker Hub image:

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: taskflow

resources:
  - ../../base
  - gp3-storageclass.yaml

patches:
  - path: service-patch.yaml

images:
  - name: taskflow-app
    newName: <YOUR_DOCKERHUB_USERNAME>/taskflow-app
    newTag: latest
```

Deploy the entire stack to EKS:

```powershell
cd c:\Users\Sidharth\Desktop\taskflow-devops\k8s\overlays\eks

# Apply manifests via Kustomize
kubectl apply -k .
```

---

### 6.5 Verify Deployment & Retrieve AWS NLB URL

Monitor the rollout:

```powershell
# Check rollout progress
kubectl rollout status deployment/taskflow-app -n taskflow --timeout=180s

# Inspect all resources in namespace
kubectl get all -n taskflow

# Retrieve the AWS Network Load Balancer (NLB) external DNS hostname
kubectl get svc taskflow-service -n taskflow -o wide
```

Extract the exact public URL:
```powershell
$NLB_HOST = (kubectl get svc taskflow-service -n taskflow -o jsonpath="{.status.loadBalancer.ingress[0].hostname}")
echo "Your live TaskFlow URL: http://${NLB_HOST}"
```

---

## 7. Cluster Provisioning Path B: Amazon ECS Fargate (Alternative)

The user noted: *"for the time . i will fine with aws ecs"*.  
If you want to run quickly on **AWS ECS (Fargate)** without paying EKS control plane fees ($0.10/hr), follow this fast serverless container path.

### 7.1 Architecture on ECS
- **Cluster:** `taskflow-ecs-cluster` in `ap-southeast-2`
- **Launch Type:** Fargate (Serverless CPU/RAM, zero EC2 management)
- **Container Image:** `<YOUR_DOCKERHUB_USERNAME>/taskflow-app:latest`
- **Networking:** Attached to the Custom VPC Public/Private subnets with an Application Load Balancer (ALB).

---

### 7.2 Create ECS Cluster via AWS CLI

```powershell
# 1. Create the ECS Cluster in Sydney
aws ecs create-cluster `
  --cluster-name taskflow-ecs-cluster `
  --region ap-southeast-2

# 2. Create ECS Task Execution Role (if not already present)
aws iam create-role `
  --role-name ecsTaskExecutionRole `
  --assume-role-policy-document '{
    "Version": "2012-10-17",
    "Statement": [{
      "Effect": "Allow",
      "Principal": {"Service": "ecs-tasks.amazonaws.com"},
      "Action": "sts:AssumeRole"
    }]
  }' 2>$null

aws iam attach-role-policy `
  --role-name ecsTaskExecutionRole `
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

---

### 7.3 Register Task Definition with Docker Hub Image

Create a task definition file `task-def.json`:

```json
{
  "family": "taskflow-app-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::666952271651:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "taskflow-app",
      "image": "<YOUR_DOCKERHUB_USERNAME>/taskflow-app:latest",
      "essential": true,
      "portMappings": [
        {
          "containerPort": 8080,
          "hostPort": 8080,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {"name": "SERVER_PORT", "value": "8080"},
        {"name": "SPRING_APPLICATION_NAME", "value": "TaskFlow"},
        {"name": "SPRING_DATASOURCE_URL", "value": "jdbc:h2:mem:taskflowdb;DB_CLOSE_DELAY=-1"},
        {"name": "JAVA_OPTS", "value": "-XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0"}
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/taskflow-app",
          "awslogs-region": "ap-southeast-2",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      }
    }
  ]
}
```

Register the task:
```powershell
aws ecs register-task-definition --cli-input-json file://task-def.json --region ap-southeast-2
```

---

### 7.4 Create ECS Service in Custom VPC Subnets

Retrieve your public subnet IDs from Terraform:
```powershell
cd c:\Users\Sidharth\Desktop\taskflow-devops\terraform
$SUBNET_1 = (terraform output -json public_subnet_ids | ConvertFrom-Json)[0]
$SUBNET_2 = (terraform output -json public_subnet_ids | ConvertFrom-Json)[1]
$VPC_ID = (terraform output -raw vpc_id)
```

Create a Security Group allowing port 8080:
```powershell
$SG_ID = (aws ec2 create-security-group `
  --group-name taskflow-ecs-sg `
  --description "TaskFlow ECS Security Group" `
  --vpc-id $VPC_ID `
  --region ap-southeast-2 `
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress `
  --group-id $SG_ID `
  --protocol tcp `
  --port 8080 `
  --cidr 0.0.0.0/0 `
  --region ap-southeast-2
```

Launch the Service on Fargate:
```powershell
aws ecs create-service `
  --cluster taskflow-ecs-cluster `
  --service-name taskflow-service `
  --task-definition taskflow-app-task `
  --desired-count 1 `
  --launch-type FARGATE `
  --network-configuration "awsvpcConfiguration={subnets=[$SUBNET_1,$SUBNET_2],securityGroups=[$SG_ID],assignPublicIp=ENABLED}" `
  --region ap-southeast-2
```

---

## 8. GitHub Actions CI/CD Pipeline Integration

The repository is on branch: **`sidharth/feature`**  
URL: `https://github.com/sidharthhhh/taskflow-devops`

### 8.1 Configure GitHub Repository Secrets & Variables

Navigate to **GitHub Repository** -> **Settings** -> **Secrets and variables** -> **Actions**:

#### 1. Repository Secrets (`Secrets` tab)
| Secret Name | Value | Purpose |
| :--- | :--- | :--- |
| `AWS_ACCESS_KEY_ID` | `<YOUR_AWS_ACCESS_KEY_ID>` | Your IAM User access key (Compatible with AWS Organization SCP restrictions) |
| `AWS_SECRET_ACCESS_KEY` | `<YOUR_AWS_SECRET_ACCESS_KEY>` | Your IAM User secret access key |
| `DOCKERHUB_USERNAME` | `<YOUR_DOCKERHUB_USERNAME>` | Docker Hub account handle |
| `DOCKERHUB_TOKEN` | `<YOUR_DOCKERHUB_PAT_TOKEN>` | Docker Hub Personal Access Token |

#### 2. Repository Variables (`Variables` tab)
| Variable Name | Value | Purpose |
| :--- | :--- | :--- |
| `AWS_REGION` | `ap-southeast-2` | Targets Sydney region |
| `EKS_CLUSTER_NAME` | `taskflow-prod-cluster` | Target EKS Cluster Name |
| `ECR_REPOSITORY` | `taskflow-app` | Amazon ECR repo name |

---

### 8.2 Push Changes on Branch `sidharth/feature`

Commit and push from your laptop:

```powershell
git status
git add .
git commit -m "docs(k8s): add complete AWS deployment guide for ap-southeast-2"
git push origin sidharth/feature
```

The GitHub Actions pipeline (`.github/workflows/ci-cd.yml`) will automatically trigger:
1. Maven verify & unit/integration tests
2. Terraform formatting & validation
3. Kustomize validation
4. Docker build & Trivy security scanning
5. Smoke test container execution
6. Keyless OIDC AWS authentication and deployment

---

## 9. Application Verification, Health Checks & Observability

Once deployed (EKS or ECS), test the REST endpoints using curl or PowerShell `Invoke-RestMethod`:

```powershell
# Set your load balancer base URL
$APP_URL = "http://${NLB_HOST}"

# 1. Health & Actuator Liveness Check
curl -s "${APP_URL}/actuator/health"

# 2. System Info Endpoint
curl -s "${APP_URL}/api/info"

# 3. Create a New Task (POST)
curl -X POST "${APP_URL}/api/tasks" `
  -H "Content-Type: application/json" `
  -d '{"title": "Deploy to Sydney AWS EKS", "description": "Running in ap-southeast-2 with custom VPC", "status": "COMPLETED"}'

# 4. List All Tasks (GET)
curl -s "${APP_URL}/api/tasks"

# 5. Prometheus Metrics Endpoint
curl -s "${APP_URL}/actuator/prometheus" | Select-String -Pattern "jvm_memory_used_bytes", "http_server_requests_seconds_count"
```

---

## 10. Cost Guardrails, Resource Cleanup & Safe Teardown

To avoid unnecessary AWS charges when you are done experimenting, execute teardown in the exact order below:

### 10.1 Orderly Teardown Sequence

```powershell
# Step 1: Remove Kubernetes Ingress / LoadBalancer services FIRST
# (This ensures AWS deletes the Network Load Balancers so subnets/VPC can be cleanly destroyed)
kubectl delete -k k8s/overlays/eks

# If ECS was deployed, delete ECS service and cluster:
aws ecs delete-service --cluster taskflow-ecs-cluster --service taskflow-service --force --region ap-southeast-2
aws ecs delete-cluster --cluster taskflow-ecs-cluster --region ap-southeast-2

# Step 2: Destroy all Terraform-managed infrastructure
cd c:\Users\Sidharth\Desktop\taskflow-devops\terraform
terraform destroy -auto-approve
```

---

## 11. Master Implementation Plan Correlation

This guide completes the milestones defined in [`plan/TaskFlow-DevOps-LLM-Implementation-Plan.md`](../plan/TaskFlow-DevOps-LLM-Implementation-Plan.md):

| Phase in Master Plan | Implementation Status & Corresponding File |
| :--- | :--- |
| **Phase 0: Discovery & Contract** | ✅ Verified repo structure, branch `sidharth/feature`, and AWS credentials. |
| **Phase 1: Spring Boot API** | ✅ REST endpoints, Actuator probes, unit & integration tests (`app/`). |
| **Phase 2: Containerization** | ✅ Multi-stage non-root `Dockerfile`, Docker Compose environment. |
| **Phase 3: Kubernetes Manifests** | ✅ Kustomize `base/`, `overlays/local`, and `overlays/eks` manifests (`k8s/`). |
| **Phase 4: Docker Hub Registry** | ✅ Documented in Section 4 with cross-platform amd64 tagging & push. |
| **Phase 5: Terraform Foundations** | ✅ Sydney `ap-southeast-2` custom VPC, EKS cluster, ECR, IAM, and budgets (`terraform/`). |
| **Phase 6: GitHub Actions CI** | ✅ Maven verify, Terraform lint, Trivy scan, and smoke test in `.github/workflows/ci-cd.yml`. |
| **Phase 7: Controlled CD** | ✅ Keyless OIDC assume role and automated rolling EKS rollout. |
| **Phase 8: Secrets & Storage** | ✅ AWS EBS CSI driver dynamic `gp3` storage class and Kubernetes secret decoupling. |
| **Phase 9: Observability** | ✅ Actuator Prometheus metrics, health probes, and container logs. |
| **Phase 10: Cost & Governance** | ✅ Monthly budget guardrails (`terraform/budget.tf`) and teardown scripts. |

