<#
.SYNOPSIS
    deploy-stack.ps1 - Docker Swarm Stack Deployment & Health Check Script for Windows / PowerShell.
.PARAMETER StackName
    Name of the Docker Swarm stack to deploy (default: lab).
.PARAMETER StackFile
    Path to the stack compose file (default: docker-stack.yml).
#>
[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [string]$StackName = "lab",

    [Parameter(Position = 1)]
    [string]$StackFile = "docker-stack.yml"
)

$ErrorActionPreference = "Stop"

$ServiceName = "${StackName}_oracle-db"
$NetworkName = "admin_internal_net"

Write-Host "[INFO] Starting Stack Deployment..." -ForegroundColor Cyan
Write-Host "[INFO] Stack Name: $StackName" -ForegroundColor Gray
Write-Host "[INFO] Stack File: $StackFile" -ForegroundColor Gray

# 1. Check prerequisites
if (-not (Test-Path $StackFile)) {
    throw "Stack file '$StackFile' not found!"
}

$swarmState = (docker info --format '{{.Swarm.LocalNodeState}}' 2>$null)
if ($swarmState -ne "active") {
    throw "Docker Swarm is not active on this node. Please run master-setup.ps1 first."
}

$netCheck = docker network ls --filter "name=$NetworkName" -q
if (-not $netCheck) {
    Write-Host "[WARNING] Overlay network '$NetworkName' not found. Creating..." -ForegroundColor Yellow
    docker network create --driver overlay --attachable --internal "$NetworkName"
}

# 2. Deploy stack
Write-Host "[INFO] Deploying Docker Swarm stack '$StackName'..." -ForegroundColor Cyan
docker stack deploy -c "$StackFile" "$StackName"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to deploy stack '$StackName'."
}

# 3. Check task health
Write-Host "[INFO] Waiting 5 seconds before checking service status..." -ForegroundColor Gray
Start-Sleep -Seconds 5

Write-Host "[INFO] Querying service tasks for '$ServiceName' (desired-state=running)..." -ForegroundColor Cyan
docker service ps "$ServiceName" --filter "desired-state=running"

Write-Host "[SUCCESS] Stack deployment command executed successfully!" -ForegroundColor Green
