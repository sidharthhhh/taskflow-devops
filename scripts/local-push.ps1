<#
 "git push" for the local GitOps loop (Windows PowerShell version of local-push.sh).
 Pushes the `microservice` branch to the in-cluster git server that ArgoCD watches
 (NOT to GitHub), then asks ArgoCD to refresh immediately.

 Usage:  powershell -ExecutionPolicy Bypass -File .\scripts\local-push.ps1
#>
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

git remote get-url local-gitops 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { git remote add local-gitops http://localhost:8765/taskflow-devops.git }

$pf = Start-Process kubectl -ArgumentList '-n', 'gitops', 'port-forward', 'svc/git-server', '8765:8765' -WindowStyle Hidden -PassThru
try {
    Start-Sleep -Seconds 3
    git push --force local-gitops microservice
    if ($LASTEXITCODE -ne 0) { throw 'git push to the in-cluster git server failed' }
} finally {
    Stop-Process -Id $pf.Id -ErrorAction SilentlyContinue
}

# Ask ArgoCD to re-check git now instead of waiting for the 60s poll.
foreach ($app in 'taskflow', 'monitoring') {
    kubectl -n argocd annotate application $app argocd.argoproj.io/refresh=normal --overwrite | Out-Null
}
Write-Host 'Pushed. ArgoCD is refreshing - watch: kubectl get applications -n argocd -w'
