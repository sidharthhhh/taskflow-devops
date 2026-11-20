<#
=============================================================================
 TaskFlow local GitOps bootstrap for Windows PowerShell
 (k3d + Helm + ArgoCD + Prometheus/Grafana)  -  same steps as local-up.sh

 Idempotent - safe to re-run. Steps:
   1. create k3d cluster "taskflow" (NodePorts mapped to localhost)
   2. install ArgoCD with Helm
   3. apply the ArgoCD AppProject + Applications (taskflow, monitoring)

 There is NO local image build: the cluster runs the same Docker Hub images that
 GitHub Actions builds (docker.io/sidharthhhh/<service>:<git-sha>). ArgoCD tracks
 the `microservice` branch on GitHub, where the CD pipeline commits each new tag.

 Usage:   powershell -ExecutionPolicy Bypass -File .\scripts\local-up.ps1
 Requires: Docker Desktop (running), k3d, kubectl, helm
=============================================================================
#>
$ErrorActionPreference = 'Stop'
Set-Location (Join-Path $PSScriptRoot '..')

$Cluster            = 'taskflow'
$ArgoCdChartVersion = '10.18.2'

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
foreach ($tool in 'docker', 'k3d', 'kubectl', 'helm') {
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

# --- 2. ArgoCD ----------------------------------------------------------------
Step "Installing ArgoCD (Helm chart $ArgoCdChartVersion)"
helm repo add argo https://argoproj.github.io/argo-helm 2>$null | Out-Null
Invoke-Native helm @('repo', 'update', 'argo')
Invoke-Native helm @('upgrade', '--install', 'argocd', 'argo/argo-cd', '--version', $ArgoCdChartVersion,
    '-n', 'argocd', '--create-namespace', '-f', 'argocd/install/argocd-values.yaml', '--wait', '--timeout', '10m')

# --- 3. ArgoCD project + applications (tracking GitHub, branch microservice) ---
Step 'Applying ArgoCD AppProject + Applications'
Invoke-Native kubectl @('apply', '-f', 'argocd/project.yaml')
Invoke-Native kubectl @('apply', '-f', 'argocd/applications/')

Step 'Done'
Write-Host @"
  ArgoCD UI   : http://localhost:30880   (user: admin)
                password: .\scripts\local-creds.ps1
  Grafana     : http://localhost:30300   (admin / taskflow-admin) -> Dashboards > TaskFlow > TaskFlow Microservices
  Prometheus  : http://localhost:30090
  Frontend    : http://localhost:30088
  Task API    : http://localhost:30080/swagger-ui.html

  Watch sync  : kubectl get applications -n argocd -w
  Deploy flow : git push (microservice) -> GitHub Actions builds + pushes images and commits
                the new image tag -> ArgoCD syncs it (poll every 60s; or refresh in the UI).
"@
