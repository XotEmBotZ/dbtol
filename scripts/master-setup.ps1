<#
.SYNOPSIS
    master-setup.ps1 - Universal Docker Swarm Master Initialization Script for Windows / PowerShell.
.PARAMETER AdvertiseAddr
    The IP address to advertise for Docker Swarm manager (default: 192.168.1.10).
.PARAMETER SourceImage
    The local source image tag (default: oracle-xe:latest).
#>
[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [string]$AdvertiseAddr = "192.168.1.10",

    [Parameter(Position = 1)]
    [string]$SourceImage = "oracle-xe:latest"
)

$ErrorActionPreference = "Stop"

$TargetRegistry = "${AdvertiseAddr}:5000"
$TargetImage = "${TargetRegistry}/oracle-xe:latest"
$NetworkName = "admin_internal_net"
$RegistryContainerName = "registry"

Write-Host "[INFO] Starting Swarm Master Node Initialization..." -ForegroundColor Cyan
Write-Host "[INFO] Advertise Address: $AdvertiseAddr" -ForegroundColor Gray
Write-Host "[INFO] Source Image: $SourceImage" -ForegroundColor Gray
Write-Host "[INFO] Target Image: $TargetImage" -ForegroundColor Gray

# 1. Initialize Docker Swarm Manager
$swarmState = (docker info --format '{{.Swarm.LocalNodeState}}' 2>$null)
if ($swarmState -eq "active") {
    Write-Host "[INFO] Docker Swarm is already active on this node." -ForegroundColor Yellow
} else {
    Write-Host "[INFO] Initializing Docker Swarm Manager with --advertise-addr $AdvertiseAddr..." -ForegroundColor Cyan
    docker swarm init --advertise-addr "$AdvertiseAddr"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to initialize Docker Swarm."
    }
}

# Output join tokens
Write-Host "[INFO] Worker Join Token:" -ForegroundColor Green
docker swarm join-token worker -q

# 2. Create internal attachable overlay network admin_internal_net
$netCheck = docker network ls --filter "name=$NetworkName" -q
if ($netCheck) {
    Write-Host "[INFO] Network '$NetworkName' already exists." -ForegroundColor Yellow
} else {
    Write-Host "[INFO] Creating attachable internal overlay network '$NetworkName'..." -ForegroundColor Cyan
    docker network create --driver overlay --attachable --internal "$NetworkName"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to create overlay network '$NetworkName'."
    }
}

# 3. Run local Docker Registry on port 5000
$regCheck = docker container inspect "$RegistryContainerName" 2>$null
if ($regCheck) {
    Write-Host "[INFO] Container '$RegistryContainerName' exists." -ForegroundColor Yellow
    $isRunning = (docker container inspect -f '{{.State.Running}}' "$RegistryContainerName")
    if ($isRunning -ne "true") {
        Write-Host "[INFO] Starting existing registry container..." -ForegroundColor Cyan
        docker container start "$RegistryContainerName"
    }
} else {
    Write-Host "[INFO] Deploying local Docker registry on port 5000..." -ForegroundColor Cyan
    docker run -d -p 5000:5000 --restart=always --name "$RegistryContainerName" registry:2
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to run registry container."
    }
}

# 4. Tag and Push oracle-xe:latest to local registry
Write-Host "[INFO] Tagging $SourceImage as $TargetImage..." -ForegroundColor Cyan
docker tag "$SourceImage" "$TargetImage"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to tag image $SourceImage."
}

Write-Host "[INFO] Pushing image $TargetImage to local registry..." -ForegroundColor Cyan
docker push "$TargetImage"
if ($LASTEXITCODE -ne 0) {
    throw "Failed to push image $TargetImage to local registry."
}

Write-Host "[SUCCESS] Master Swarm setup completed successfully!" -ForegroundColor Green
