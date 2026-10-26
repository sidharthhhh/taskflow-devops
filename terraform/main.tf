locals {
  cluster_name = "${var.project_name}-${var.environment}-cluster"
}

# -----------------------------------------------------------------------------
# 1. VPC Module (Networking, Multi-AZ Subnets, IGW, NAT Gateway)
# -----------------------------------------------------------------------------
module "vpc" {
  source = "./modules/vpc"

  project_name         = var.project_name
  environment          = var.environment
  cluster_name         = local.cluster_name
  vpc_cidr             = var.vpc_cidr
  availability_zones   = var.availability_zones
  public_subnet_cidrs  = var.public_subnet_cidrs
  private_subnet_cidrs = var.private_subnet_cidrs
}

# -----------------------------------------------------------------------------
# 2. ECR Module (Container Registry with Image Scanning & Lifecycle Policies)
# -----------------------------------------------------------------------------
module "ecr" {
  source = "./modules/ecr"

  repository_name      = var.ecr_repository_name
  image_tag_mutability = var.ecr_image_tag_mutability
  project_name         = var.project_name
  environment          = var.environment
}

# -----------------------------------------------------------------------------
# 3. EKS Module (Cluster, Managed Node Group, OIDC IRSA, EBS CSI Addon)
# -----------------------------------------------------------------------------
module "eks" {
  source = "./modules/eks"

  cluster_name        = local.cluster_name
  cluster_version     = var.cluster_version
  vpc_id              = module.vpc.vpc_id
  public_subnet_ids   = module.vpc.public_subnet_ids
  private_subnet_ids  = module.vpc.private_subnet_ids
  public_access_cidrs = var.cluster_endpoint_public_access_cidrs
  node_instance_types = var.node_instance_types
  desired_size        = var.node_desired_size
  min_size            = var.node_min_size
  max_size            = var.node_max_size
  project_name        = var.project_name
  environment         = var.environment

  depends_on = [module.vpc]
}
