<#
=============================================================================
 TaskFlow local GitOps bootstrap for Windows PowerShell
 (k3d + Helm + ArgoCD + Prometheus/Grafana)  -  same steps as local-up.sh

 Idempotent - safe to re-run. Steps:
   1. create k3d cluster "taskflow" (NodePorts mapped to localhost)
   2. build the 7 service images and import them into k3d
   3. install ArgoCD with Helm
   4. start the in-cluster git server and push the `microservice` branch to it
      (stands in for GitHub - nothing is pushed to GitHub)
   5. apply the ArgoCD AppProject + Applications (taskflow, monitoring)

 Usage:   powershell -ExecutionPolicy Bypass -File .\scripts\local-up.ps1 [-SkipBuild]
 Requires: Docker Desktop (running), k3d, kubectl, helm, git
=============================================================================
#>
param([switch]$SkipBuild)

$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$Cluster            = 'taskflow'
$ArgoCdChartVersion = '10.18.2'
$LocalRepoUrl       = 'http://git-server.gitops.svc.cluster.local:8765/taskflow-devops.git'
$GithubRepoUrl      = 'https://github.com/sidharthhhh/taskflow-devops.git'

function Step([string]$msg) { Write-Host "`n==> $msg" -ForegroundColor Cyan }
function Invoke-Native {
    # Run a native command and stop on a non-zero exit code.
    param([string]$Exe, [string[]]$Arguments)
    & $Exe @Arguments
    if ($LASTEXITCODE -ne 0) { throw "'$Exe $($Arguments -join ' ')' failed with exit code $LASTEXITCODE" }
}

# --- 0. prerequisites ---------------------------------------------------------
Step 'Checking prerequisites'
# Tools dropped into ~/.local/bin (e.g. helm.exe / argocd.exe downloaded manually) count too.
$localBin = Join-Path $env:USERPROFILE '.local\bin'
if ((Test-Path $localBin) -and ($env:PATH -notlike "*$localBin*")) { $env:PATH = "$env:PATH;$localBin" }
foreach ($tool in 'docker', 'k3d', 'kubectl', 'helm', 'git') {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) { throw "$tool is not installed / not on PATH" }
}
docker info --format '{{.ServerVersion}}' | Out-Null
if ($LASTEXITCODE -ne 0) { throw 'Docker is not running - start Docker Desktop first' }

# --- 1. cluster ---------------------------------------------------------------
Step "k3d cluster '$Cluster'"
k3d cluster list $Cluster 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) {
    Invoke-Native k3d @('cluster', 'create', $Cluster, '--servers', '1', '--agents', '0',
        '--k3s-arg', '--disable=traefik@server:0',
        '-p', '30080:30080@server:0', '-p', '30088:30088@server:0',
        '-p', '30300:30300@server:0', '-p', '30880:30880@server:0', '-p', '30090:30090@server:0',
        '--wait')
}
Invoke-Native kubectl @('config', 'use-context', "k3d-$Cluster")
# Docker Desktop: host.docker.internal may resolve to a firewalled LAN IP -> use 127.0.0.1
$server  = kubectl config view -o jsonpath="{.clusters[?(@.name=='k3d-$Cluster')].cluster.server}"
$apiPort = ($server -split ':')[-1]
Invoke-Native kubectl @('config', 'set-cluster', "k3d-$Cluster", "--server=https://127.0.0.1:$apiPort")
Invoke-Native kubectl @('get', 'nodes')

# --- 2. images ----------------------------------------------------------------
$images = [ordered]@{
    'taskflow-app'                  = 'services/task-service'
    'taskflow-auth-service'         = 'services/auth-service'
    'taskflow-analytics-service'    = 'services/analytics-service'
    'taskflow-scheduler-service'    = 'services/scheduler-service'
    'taskflow-notification-service' = 'services/notification-service'
    'taskflow-audit-service'        = 'services/audit-service'
    'taskflow-frontend'             = 'frontend'
}
if (-not $SkipBuild) {
    Step 'Building images'
    foreach ($name in $images.Keys) { Invoke-Native docker @('build', '-t', "${name}:latest", $images[$name]) }
    Step 'Importing images into k3d'
    $tags = $images.Keys | ForEach-Object { "${_}:latest" }
    Invoke-Native k3d (@('image', 'import', '-c', $Cluster) + $tags)
}

# --- 3. ArgoCD ----------------------------------------------------------------
Step "Installing ArgoCD (Helm chart $ArgoCdChartVersion)"
helm repo add argo https://argoproj.github.io/argo-helm 2>$null | Out-Null
Invoke-Native helm @('repo', 'update', 'argo')
Invoke-Native helm @('upgrade', '--install', 'argocd', 'argo/argo-cd', '--version', $ArgoCdChartVersion,
    '-n', 'argocd', '--create-namespace', '-f', 'argocd/install/argocd-values.yaml', '--wait', '--timeout', '10m')

# --- 4. in-cluster git server + push -------------------------------------------
Step 'In-cluster git server'
Invoke-Native kubectl @('apply', '-f', 'argocd/local-git-server/git-server.yaml')
kubectl create configmap git-server-script -n gitops --from-file=scripts/local-git-server.py --dry-run=client -o yaml | kubectl apply -f -
Invoke-Native kubectl @('-n', 'gitops', 'rollout', 'status', 'deploy/git-server', '--timeout=180s')

Step "Pushing branch 'microservice' to the in-cluster git server"
git remote get-url local-gitops 2>$null | Out-Null
if ($LASTEXITCODE -ne 0) { Invoke-Native git @('remote', 'add', 'local-gitops', 'http://localhost:8765/taskflow-devops.git') }
$pf = Start-Process kubectl -ArgumentList '-n', 'gitops', 'port-forward', 'svc/git-server', '8765:8765' -WindowStyle Hidden -PassThru
try {
    Start-Sleep -Seconds 3
    Invoke-Native git @('push', '--force', 'local-gitops', 'microservice')
} finally {
    Stop-Process -Id $pf.Id -ErrorAction SilentlyContinue
}

# --- 5. ArgoCD project + applications ------------------------------------------
Step 'Applying ArgoCD AppProject + Applications'
Invoke-Native kubectl @('apply', '-f', 'argocd/project.yaml')
Get-ChildItem argocd/applications/*.yaml | ForEach-Object {
    (Get-Content $_.FullName -Raw).Replace($GithubRepoUrl, $LocalRepoUrl) | kubectl apply -f -
    if ($LASTEXITCODE -ne 0) { throw "kubectl apply failed for $($_.Name)" }
}

Step 'Done'
Write-Host @"
  ArgoCD UI   : http://localhost:30880   (user: admin)
                password: .\scripts\local-creds.ps1
  Grafana     : http://localhost:30300   (admin / taskflow-admin) -> Dashboards > TaskFlow > TaskFlow Microservices
  Prometheus  : http://localhost:30090
  Frontend    : http://localhost:30088
  Task API    : http://localhost:30080/swagger-ui.html

  Watch sync  : kubectl get applications -n argocd -w
  Deploy a change locally: commit on 'microservice', then .\scripts\local-push.ps1
"@
