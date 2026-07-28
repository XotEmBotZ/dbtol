<#
.SYNOPSIS
    student-setup.ps1 - Automated Student PC Setup Script for Windows / PowerShell.
.PARAMETER SwarmToken
    The Swarm worker join token obtained from the master node.
.PARAMETER ManagerAddr
    The manager node IP and port (default: 192.168.1.10:2377).
.PARAMETER StudentUser
    The username of the local student account to verify/remove from docker-users group (default: student).
.PARAMETER ConnectString
    The SQL*Plus target connection string (default: student_user/LabPassword2026@localhost:1521/XEPDB1).
#>
[CmdletBinding()]
param (
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$SwarmToken,

    [Parameter(Position = 1)]
    [string]$ManagerAddr = "192.168.1.10:2377",

    [Parameter(Position = 2)]
    [string]$StudentUser = "student",

    [Parameter(Position = 3)]
    [string]$ConnectString = "student_user/LabPassword2026@localhost:1521/XEPDB1"
)

$ErrorActionPreference = "Stop"

Write-Host "[INFO] Starting Student PC Setup..." -ForegroundColor Cyan
Write-Host "[INFO] Target Manager Address: $ManagerAddr" -ForegroundColor Gray

# 1. Check and ensure student accounts are NOT in local 'docker-users' group
Write-Host "[INFO] Audit: Verifying local group 'docker-users' membership..." -ForegroundColor Cyan
try {
    $dockerGroupMembers = Get-LocalGroupMember -Group "docker-users" -ErrorAction SilentlyContinue
    if ($dockerGroupMembers) {
        foreach ($member in $dockerGroupMembers) {
            if ($member.Name -like "*\$StudentUser" -or $member.Name -eq $StudentUser) {
                Write-Host "[WARNING] Removing user '$($member.Name)' from 'docker-users' group..." -ForegroundColor Yellow
                Remove-LocalGroupMember -Group "docker-users" -Member $member.Name
            }
        }
    }
    Write-Host "[INFO] Verified: Student account '$StudentUser' is not in 'docker-users' group." -ForegroundColor Green
} catch {
    Write-Host "[INFO] Local group 'docker-users' check skipped or not present on host." -ForegroundColor Gray
}

# 2. Join Docker Swarm cluster
$swarmState = (docker info --format '{{.Swarm.LocalNodeState}}' 2>$null)
if ($swarmState -eq "active") {
    Write-Host "[INFO] Node is already part of a Docker Swarm cluster." -ForegroundColor Yellow
} else {
    Write-Host "[INFO] Joining Docker Swarm cluster at $ManagerAddr..." -ForegroundColor Cyan
    docker swarm join --token "$SwarmToken" "$ManagerAddr"
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to join Docker Swarm cluster."
    }
}

# 3. Create transparent SQL*Plus shortcut on Desktop
$ShortcutPath = "C:\Users\Public\Desktop\SQLPlus.lnk"
Write-Host "[INFO] Creating transparent SQL*Plus shortcut at '$ShortcutPath'..." -ForegroundColor Cyan

try {
    $WshShell = New-Object -ComObject WScript.Shell
    $Shortcut = $WshShell.CreateShortcut($ShortcutPath)
    $Shortcut.TargetPath = "sqlplus.exe"
    $Shortcut.Arguments = $ConnectString
    $Shortcut.Description = "SQL*Plus Student Direct Connection"
    $Shortcut.Save()
    Write-Host "[SUCCESS] Created shortcut: $ShortcutPath" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Failed to create desktop shortcut: $_" -ForegroundColor Red
}

Write-Host "[SUCCESS] Student PC setup completed successfully!" -ForegroundColor Green
