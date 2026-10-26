# 🌍 TaskFlow Infrastructure as Code (Terraform)

This directory contains modular, production-grade **Terraform** configurations to provision the AWS cloud infrastructure for **TaskFlow**.

---

## 🏛️ Architecture Overview

The Terraform manifests automate the complete deployment of:
- **Networking (`modules/vpc`)**: Multi-AZ VPC with public and private subnets, Internet Gateway, NAT Gateway, route tables, and required Kubernetes ELB discovery tags (`kubernetes.io/role/elb = 1`, `kubernetes.io/role/internal-elb = 1`).
- **Container Registry (`modules/ecr`)**: Amazon ECR repository with automated image vulnerability scanning on push, AES-256 encryption, and lifecycle retention policies (expires untagged images older than 14 days, keeps last 30 tagged images).
- **Kubernetes Cluster (`modules/eks`)**:
  - Amazon EKS cluster (v1.30) with control plane logging (API, audit, authenticator).
  - Managed Node Group in private subnets with auto-scaling (`min: 2`, `desired: 2`, `max: 4`) using `t3.medium` instances.
  - OIDC Identity Provider for **IAM Roles for Service Accounts (IRSA)**.
  - **AWS EBS CSI Driver Add-on** with dedicated IRSA role for dynamic PersistentVolume provisioning (required for PostgreSQL StatefulSet).
- **Keyless CI/CD Security (`github-oidc.tf`)**: OpenID Connect (OIDC) identity provider and scoped IAM role enabling GitHub Actions to authenticate without long-lived AWS access keys.
- **Secrets Management (`secrets.tf`)**: AWS Secrets Manager storing PostgreSQL credentials with KMS encryption, integrated for Kubernetes External Secrets Operator.
- **Disaster Recovery Foundation (`backup.tf`)**: Versioned and encrypted S3 bucket with 30-day lifecycle retention policy and IAM policy for scheduled database dump CronJobs.
- **Cost Guardrails (`budget.tf`)**: AWS Budget monitoring monthly spend with automated email notifications at 80% and 100% thresholds.
- **Remote State Foundation (`bootstrap/`)**: S3 bucket with versioning and AES-256 encryption + DynamoDB table for distributed state locking.

---

## 📁 Directory Structure

```text
terraform/
├── README.md                            # This comprehensive infrastructure guide
├── bootstrap/                           # State storage bootstrap (run first)
│   ├── main.tf                          # S3 state bucket & DynamoDB lock table
│   ├── variables.tf                     # Bootstrap configuration inputs
│   └── outputs.tf                       # State bucket name & backend code snippet
├── modules/
│   ├── vpc/                             # Modular VPC and networking
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── ecr/                             # Amazon ECR container registry
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── eks/                             # Amazon EKS cluster & managed node group
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── versions.tf                          # Provider requirements & remote backend block
├── providers.tf                         # AWS provider with default tags
├── variables.tf                         # Root input variables with defaults
├── main.tf                              # Module orchestration (VPC, ECR, EKS)
├── github-oidc.tf                       # GitHub Actions keyless OIDC IAM role
├── secrets.tf                           # AWS Secrets Manager DB credentials
├── backup.tf                            # S3 backup bucket & lifecycle rules
├── budget.tf                            # AWS cost budget alerts
├── outputs.tf                           # Safe deployment outputs (cluster, ECR, IAM)
└── terraform.tfvars.example             # Input variables template
```

---

## 🚀 Step-by-Step Deployment Guide

### Prerequisites
- [Terraform](https://www.terraform.io/downloads.html) >= 1.5.0 installed
- [AWS CLI](https://aws.amazon.com/cli/) installed and configured (`aws configure`)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed
- Permissions to create VPC, IAM, EKS, ECR, S3, and Secrets Manager resources

---

### Step 1: Provision S3 State Storage & DynamoDB Lock Table
Before deploying the main cloud infrastructure, provision the dedicated AWS S3 bucket and DynamoDB table that securely store and lock the Terraform state:

```bash
cd terraform/bootstrap
terraform init
terraform plan
terraform apply
```

The bootstrap outputs provide the exact S3 bucket name (e.g. `taskflow-prod-tfstate-123456789012`) and DynamoDB table name (`taskflow-prod-tflocks`).

### Step 2: Configure S3 Backend for Root Infrastructure
Return to the `terraform/` directory:

```bash
cd ..
```

Configure your S3 backend using either of these two methods:
- **Method A (Recommended via `backend.hcl`)**:
  ```bash
  cp backend.hcl.example backend.hcl
  # Edit backend.hcl with your S3 bucket name
  terraform init -backend-config=backend.hcl
  ```
- **Method B (Direct in `versions.tf`)**:
  Update `bucket = "taskflow-prod-tfstate-<YOUR_ACCOUNT_ID>"` in [versions.tf](file:///c:/Users/Sidharth/Desktop/taskflow-devops/terraform/versions.tf), then run `terraform init`.

---

### Step 2: Configure Infrastructure Variables
Navigate to the root `terraform/` directory and create your variable file:

```bash
cd ..
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars` with your custom settings:
- `aws_region`: Target region (e.g., `us-east-1`)
- `github_repo`: Your GitHub repository (`username/repository-name`)
- `budget_alert_email`: Email to receive cost alerts

---

### Step 3: Initialize and Validate
```bash
# Format check
terraform fmt -recursive

# Initialize providers and modules
terraform init

# Validate syntax and configuration
terraform validate
```

---

### Step 4: Review the Execution Plan
```bash
terraform plan -out=tfplan
```
Review the proposed resources. Ensure you are satisfied with the planned infrastructure before proceeding.

---

### Step 5: Provision Infrastructure
```bash
terraform apply tfplan
```
> ⏱️ *Provisioning takes approximately 12–15 minutes (primarily for EKS control plane and node group provisioning).*

---

### Step 6: Connect `kubectl` to the New EKS Cluster
Once provisioning completes, configure your local `kubectl` context using the output command:

```bash
# Configure kubeconfig
aws eks update-kubeconfig --region us-east-1 --name taskflow-prod-cluster

# Verify nodes are Ready
kubectl get nodes -o wide
```

---

### Step 7: Deploy TaskFlow to EKS
Now apply the Kubernetes manifests configured for EKS:

```bash
cd ../k8s/overlays/eks

# Set image to your provisioned ECR URL
# ECR URL can be retrieved via: terraform -chdir=../../terraform output -raw ecr_repository_url
kustomize edit set image taskflow-app=<YOUR_ECR_REPO_URL>:latest

# Apply manifests
kubectl apply -k .
```

---

## 🧹 Infrastructure Teardown (Destroy)

When you are finished testing or wish to tear down all cloud infrastructure to avoid ongoing charges:

```bash
# 1. Delete Kubernetes workloads first to release AWS Load Balancers
kubectl delete -k ../k8s/overlays/eks

# 2. Destroy all AWS infrastructure via Terraform
cd terraform
terraform destroy -auto-approve

# 3. (Optional) Tear down the bootstrap state storage
cd bootstrap
terraform destroy
```
