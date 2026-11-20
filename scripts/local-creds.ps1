<#
 Print the local ArgoCD and Grafana logins (read live from the cluster secrets).
 Usage:  powershell -ExecutionPolicy Bypass -File .\scripts\local-creds.ps1
#>
function Decode([string]$b64) { [Text.Encoding]::UTF8.GetString([Convert]::FromBase64String($b64)) }

$argoPw  = Decode (kubectl -n argocd get secret argocd-initial-admin-secret -o jsonpath='{.data.password}')
$grafU   = Decode (kubectl -n monitoring get secret monitoring-grafana -o jsonpath='{.data.admin-user}')
$grafPw  = Decode (kubectl -n monitoring get secret monitoring-grafana -o jsonpath='{.data.admin-password}')

Write-Host "ArgoCD  http://localhost:30880   user: admin    password: $argoPw"
Write-Host "Grafana http://localhost:30300   user: $grafU    password: $grafPw"
