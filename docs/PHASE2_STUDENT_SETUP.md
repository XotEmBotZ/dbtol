# Phase 2: Student PC Setup & Provisioning

This document details the configuration and mass-provisioning of 100+ student lab PCs (Windows/Linux) to join the Docker Swarm cluster as worker nodes while securing host permissions and providing a simple 1-click database shortcut for students.

---

## 1. Student PC Preparation Guide (Mass Deployment)

For computer labs with 100+ PCs, individual manual setup is inefficient. Provisioning should be automated via **Active Directory Group Policy Objects (GPO)** or **Disk Image Deployment** (e.g., Fog Project, Clonezilla, or Microsoft Deployment Toolkit).

### Baseline Image Requirements

Every student PC image must include:
* Windows 10/11 Enterprise/Pro or Linux host OS.
* Docker Desktop / Docker Engine installed with Swarm capabilities enabled.
* Oracle Instant Client or SQL*Plus installed locally.
* Configured `daemon.json` with the Master PC's insecure registry address:

```json
{
  "insecure-registries": [
    "192.168.1.10:5000"
  ]
}
```

---

## 2. Host Security & Privilege Audit

> [!CAUTION]
> Failure to strip Docker daemon administrative access from student user accounts creates a critical security vulnerability. Students in the `docker-users` group can run `docker exec` to gain root access inside containers or inspect peer node traffic.

### Removing Student Accounts from `docker-users`

On Windows host PCs, any user account in the `docker-users` group has full control over the local Docker daemon socket.

#### PowerShell Privilege Audit Command (Run as Administrator):

```powershell
# Remove 'Domain Users' or specific student account from local docker-users group
Remove-LocalGroupMember -Group "docker-users" -Member "LAB\Domain Users" -ErrorAction SilentlyContinue
Remove-LocalGroupMember -Group "docker-users" -Member "Student" -ErrorAction SilentlyContinue
```

#### Enforcing via GPO (Restricted Groups):

1. Open **Group Policy Management Console (`gpmc.msc`)**.
2. Navigate to `Computer Configuration` -> `Policies` -> `Windows Settings` -> `Security Settings` -> `Restricted Groups`.
3. Add group `docker-users`.
4. Define members explicitly to include **ONLY** `Administrators` and the `LabAdmin` account. Ensure student accounts are excluded.

---

## 3. Swarm Worker Join Procedure

Each student PC joins the Swarm as a worker node. The Docker Swarm Manager will automatically provision exactly one Oracle XE container to each student PC upon joining due to the `mode: global` stack definition.

### Manual Join Command

On each student PC (run via elevated prompt or startup script):

```cmd
:: Replace <WORKER_TOKEN> and 192.168.1.10 with Master PC values
docker swarm join --token SWMTKN-1-49mgw7p5b... 192.168.1.10:2377
```

### Automated Join via Startup Task (PowerShell)

Deploy a scheduled task via GPO that executes at computer startup:

```powershell
$MasterIP = "192.168.1.10"
$Token = "SWMTKN-1-49mgw7p5b..."

# Check if node is already part of a swarm
$SwarmState = (docker info --format '{{.Swarm.LocalNodeState}}')

if ($SwarmState -ne "active") {
    Write-Host "Joining Swarm Cluster..." -ForegroundColor Yellow
    docker swarm join --token $Token "$($MasterIP):2377"
} else {
    Write-Host "Node is already active in Swarm." -ForegroundColor Green
}
```

---

## 4. 1-Click Desktop Shortcut Deployment (`SQLPlus.lnk`)

To ensure a seamless student experience without requiring command-line execution or Docker knowledge, deploy a 1-click desktop shortcut on all student PCs.

### Connection String Specification

* **Host**: `localhost` (or `127.0.0.1`)
* **Port**: `1521`
* **Pluggable Database (PDB)**: `XEPDB1`
* **Full Connect Identifier**: `localhost:1521/XEPDB1`

### Desktop Shortcut Properties

```text
Shortcut Name:  SQLPlus - Oracle Lab DB
Target:         C:\oracle\instantclient\sqlplus.exe student/LabDbPassword2026@localhost:1521/XEPDB1
Start in:       C:\Users\Public\Documents
Icon:           C:\oracle\instantclient\sqlplus.exe (or custom Oracle icon)
```

### Automated Shortcut Creation via PowerShell GPO Script

Deploy this script across all lab PCs to place `SQLPlus.lnk` on the Public Desktop (`C:\Users\Public\Desktop`), making it accessible to any logged-in student:

```powershell
$TargetExe = "C:\oracle\instantclient\sqlplus.exe"
$Arguments = "student/LabDbPassword2026@localhost:1521/XEPDB1"
$ShortcutPath = "C:\Users\Public\Desktop\SQLPlus.lnk"

$WScriptShell = New-Object -ComObject WScript.Shell
$Shortcut = $WScriptShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = $TargetExe
$Shortcut.Arguments = $Arguments
$Shortcut.WorkingDirectory = "C:\Users\Public\Documents"
$Shortcut.Description = "Connect to local Oracle Database XE"
$Shortcut.Save()
```

> [!NOTE]
> When a student double-clicks `SQLPlus.lnk`, SQL*Plus opens immediately connected to their dedicated container database instance running locally on `127.0.0.1:1521`.
