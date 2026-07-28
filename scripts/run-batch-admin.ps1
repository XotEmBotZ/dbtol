<#
.SYNOPSIS
    run-batch-admin.ps1 - Batch Admin Execution Across All Database Swarm Tasks for Windows / PowerShell.
.PARAMETER ServiceName
    Target Docker Swarm service name (default: lab_oracle-db).
.PARAMETER NetworkName
    Target Docker overlay network name (default: admin_internal_net).
.PARAMETER SqlCmd
    SQL command string to execute (default: SELECT instance_name, status, host_name FROM v$instance;).
.PARAMETER SysPassword
    Oracle SYS password (default: LabDbPassword2026).
.PARAMETER EphemeralImage
    Docker image for ephemeral SQL*Plus runner container (default: gvenzl/oracle-xe).
#>
[CmdletBinding()]
param (
    [Parameter(Position = 0)]
    [string]$ServiceName = "lab_oracle-db",

    [Parameter(Position = 1)]
    [string]$NetworkName = "admin_internal_net",

    [Parameter(Position = 2)]
    [string]$SqlCmd = "SELECT instance_name, status, host_name FROM v`$instance;",

    [Parameter(Position = 3)]
    [string]$SysPassword = "LabDbPassword2026",

    [Parameter(Position = 4)]
    [string]$EphemeralImage = "gvenzl/oracle-xe"
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Starting Batch Admin Execution..." -ForegroundColor Cyan
Write-Host "[INFO] Target Service: $ServiceName" -ForegroundColor Gray
Write-Host "[INFO] Target Network: $NetworkName" -ForegroundColor Gray

# 1. Query docker service ps lab_oracle-db
Write-Host "[INFO] Querying service tasks for '$ServiceName'..." -ForegroundColor Cyan
docker service ps "$ServiceName" --filter "desired-state=running"
if ($LASTEXITCODE -ne 0) {
    throw "Service '$ServiceName' not found or docker service query failed."
}

# 2. Extract container IPs on admin_internal_net
Write-Host "[INFO] Extracting container IP addresses on network '$NetworkName'..." -ForegroundColor Cyan
$containerIps = @()

try {
    $rawNetFormat = '{{range .Containers}}{{.IPv4Address}}{{"\n"}}{{end}}'
    $rawIps = (docker network inspect "$NetworkName" --format $rawNetFormat 2>$null)
    if ($rawIps) {
        foreach ($line in ($rawIps -split "`n")) {
            $trimmed = $line.Trim()
            if ($trimmed -and $trimmed.Contains("/")) {
                $ip = $trimmed.Split("/")[0]
                if ($ip) {
                    $containerIps += $ip
                }
            }
        }
    }
} catch {
    Write-Host "[WARNING] Failed to parse network inspect output: $_" -ForegroundColor Yellow
}

if ($containerIps.Count -eq 0) {
    throw "No active container IPs found attached to '$NetworkName'."
}

Write-Host "[INFO] Found $($containerIps.Count) database container IP(s): $($containerIps -join ', ')" -ForegroundColor Green

# 3. Run SQL commands against each database container using ephemeral container
$fullSql = "SET PAGESIZE 50`nSET LINESIZE 200`n$SqlCmd`nEXIT;"

foreach ($targetIp in $containerIps) {
    Write-Host "======================================================================" -ForegroundColor Gray
    Write-Host "[INFO] Executing SQL batch query against database container at IP: $targetIp" -ForegroundColor Cyan
    Write-Host "======================================================================" -ForegroundColor Gray

    $connectionString = "sys/$SysPassword@${targetIp}:1521/XE as sysdba"

    $fullSql | docker run --rm -i --net "$NetworkName" "$EphemeralImage" sqlplus -s "$connectionString"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[WARNING] SQL execution encountered an issue for IP $targetIp" -ForegroundColor Yellow
    }
    Write-Host ""
}

Write-Host "[SUCCESS] Batch admin execution completed across all nodes!" -ForegroundColor Green
