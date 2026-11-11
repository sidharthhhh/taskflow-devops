# 🌍 TaskFlow Infrastructure as Code (Terraform)

This directory contains modular **Terraform** configurations to provision the AWS cloud infrastructure for the **TaskFlow Polyglot Microservices Platform** in **`ap-southeast-2` (Sydney)**.

---

## 🏛️ Architecture Overview

- **Networking (`modules/vpc`)**: Dedicated VPC (`10.0.0.0/16`) across `ap-southeast-2a` and `ap-southeast-2b` with public & private subnets, Internet Gateway, NAT Gateway, route tables, and Kubernetes ELB discovery tags (`kubernetes.io/role/elb = 1`, `kubernetes.io/role/internal-elb = 1`).
- **Multi-Service Container Registry (`modules/ecr`)**: Provisions **7 Amazon ECR repositories** via `for_each` (`taskflow-app`, `taskflow-auth-service`, `taskflow-analytics-service`, `taskflow-scheduler-service`, `taskflow-notification-service`, `taskflow-audit-service`, `taskflow-frontend`), each with push vulnerability scanning, AES-256 encryption, and 30-image lifecycle policies.
- **Kubernetes Cluster (`modules/eks`)**:
  - Amazon EKS control plane (`v1.31`, lifecycle `ignore_changes = [version]`) with API/audit/authenticator logs.
  - Managed Node Group in private subnets running **Amazon Linux 2023 (`AL2023_x86_64_STANDARD`)** on Free-Tier eligible **`t3.micro`** instances (`min: 2`, `desired: 4`, `max: 6` = 16 pod slots).
  - Node IAM role directly includes `AmazonEBSCSIDriverPolicy` so storage works even in AWS Organizations whose SCP restricts `iam:CreateOpenIDConnectProvider`.
- **Secrets Management (`secrets.tf`)**: AWS Secrets Manager storing generated PostgreSQL credentials (`username`, `password`, `dbname`, `host`) and a 48-char `jwt_secret` for `auth-service` + `redis_url`.
- **Disaster Recovery (`backup.tf`)**: Versioned, encrypted S3 bucket with 30-day lifecycle rules for database dumps.
- **Cost Guardrails (`budget.tf`)**: AWS Budget ($25/mo default) with automated alerts at 80% actual and 100% forecasted spend.
- **Optional Remote State (`bootstrap/` & `versions.tf`)**: S3 bucket + DynamoDB lock table; local state is enabled by default in `versions.tf` for fast solo setup.

---

## 📁 Directory Structure

```text
terraform/
├── README.md                            # This infrastructure guide
├── readme/README.md                     # Deep architectural & troubleshooting reference
├── bootstrap/                           # Optional remote S3 state & DynamoDB lock table
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
├── modules/
│   ├── vpc/                             # VPC, subnets, IGW, NAT Gateway, route tables
│   ├── ecr/                             # Reusable ECR repository + lifecycle policy module
│   └── eks/                             # EKS control plane, AL2023 node group, core add-ons
├── versions.tf                          # Terraform & provider version constraints (local state default)
├── providers.tf                         # AWS provider with default project tags
├── variables.tf                         # Root input variables (ap-southeast-2, t3.micro, 7 ECR repos)
├── main.tf                              # Orchestrates VPC, for_each ECR, and EKS modules
├── github-oidc.tf                       # Optional GitHub OIDC role (commented when SCP restricts OIDC)
├── secrets.tf                           # Secrets Manager DB + JWT credentials
├── backup.tf                            # Encrypted S3 backup bucket
├── budget.tf                            # AWS monthly cost alerts
├── outputs.tf                           # Cluster name, kubeconfig command, ECR URL map, ARNs
└── terraform.tfvars.example             # Input variables template
```

---

## 🚀 Step-by-Step Deployment Guide

### Prerequisites
- [Terraform](https://www.terraform.io/downloads.html) `>= 1.5.0`
- [AWS CLI v2](https://aws.amazon.com/cli/) configured for `ap-southeast-2` (`aws configure`)
- [kubectl](https://kubernetes.io/docs/tasks/tools/) installed

---

### Step 1: Configure Variables
```powershell
cd terraform
Copy-Item terraform.tfvars.example terraform.tfvars
```
Review `terraform.tfvars` (pre-configured for Sydney `ap-southeast-2`, `t3.micro`, EKS `1.31`, and all 7 ECR repositories) and set `budget_alert_email` to your email address.

*(Optional)* If you prefer remote S3 state instead of local state, first apply `terraform/bootstrap`, then uncomment the `backend "s3"` block in `versions.tf` with your account-specific bucket name (`taskflow-prod-tfstate-<ACCOUNT_ID>`).

---

### Step 2: Initialize, Format & Plan
```powershell
terraform fmt -check -recursive
terraform init
terraform validate
terraform plan -out=tfplan
```

---

### Step 3: Provision Infrastructure
```powershell
terraform apply tfplan
```
*(Tip for Windows PowerShell: if targeting a module individually, always quote the target flag: `terraform apply -target="module.vpc" -auto-approve`.)*

Provisioning takes ~10–15 minutes for the EKS control plane and AL2023 worker nodes.

---

### Step 4: Connect `kubectl` & Deploy Microservices
```powershell
# Update kubeconfig from Terraform output
aws eks update-kubeconfig --region ap-southeast-2 --name taskflow-prod-cluster
kubectl get nodes -o wide

# Deploy all 9 workloads via Kustomize
cd ..\k8s\overlays\eks
kubectl apply -k .
kubectl get pods,svc -n taskflow
```

---

## 🧹 Safe Infrastructure Teardown (Order Matters!)

Always delete Kubernetes `LoadBalancer` services **before** running `terraform destroy`, otherwise orphaned AWS ELBs/ENIs will block VPC and subnet deletion with `DependencyViolation`:

```powershell
# 1. Delete Kubernetes services & workloads first (wait ~60s for AWS ELB cleanup)
kubectl delete -k ..\k8s\overlays\eks

# 2. Destroy all Terraform-managed AWS infrastructure
cd ..\terraform
terraform destroy -auto-approve
```
