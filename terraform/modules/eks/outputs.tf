output "cluster_name" {
  description = "The name of the EKS cluster"
  value       = aws_eks_cluster.main.name
}

output "cluster_id" {
  description = "The EKS cluster ID"
  value       = aws_eks_cluster.main.id
}

output "cluster_endpoint" {
  description = "Endpoint for EKS control plane API server"
  value       = aws_eks_cluster.main.endpoint
}

output "cluster_certificate_authority_data" {
  description = "Base64 encoded certificate data required to communicate with the cluster"
  value       = aws_eks_cluster.main.certificate_authority[0].data
}

# output "oidc_provider_arn" {
#   description = "ARN of the EKS OIDC identity provider for IRSA"
#   value       = aws_iam_openid_connect_provider.oidc.arn
# }

# output "oidc_provider_url" {
#   description = "URL of the EKS OIDC identity provider"
#   value       = aws_iam_openid_connect_provider.oidc.url
# }

output "node_group_role_arn" {
  description = "IAM role ARN used by the EKS managed node group"
  value       = aws_iam_role.nodes.arn
}

# output "ebs_csi_role_arn" {
#   description = "IAM role ARN used by the AWS EBS CSI driver"
#   value       = aws_iam_role.ebs_csi.arn
# }
