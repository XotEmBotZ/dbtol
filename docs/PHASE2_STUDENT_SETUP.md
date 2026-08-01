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

#### Command Prompt (`cmd.exe`) Privilege Audit Command:

```cmd
:: Audit local group membership
net localgroup docker-users

:: Remove student user account from local docker-users group
net localgroup docker-users student /delete
```

#### Enforcing via GPO (Restricted Groups):

1. Open **Group Policy Management Console (`gpmc.msc`)**.
2. Navigate to `Computer Configuration` -> `Policies` -> `Windows Settings` -> `Security Settings` -> `Restricted Groups`.
3. Add group `docker-users`.
4. Define members explicitly to include **ONLY** `Administrators` and the `LabAdmin` account. Ensure student accounts are excluded.

---

## 3. Swarm Worker Join Procedure

Each student PC joins the Swarm as a worker node. The Docker Swarm Manager will automatically provision exactly one Oracle XE container to each student PC upon joining due to the `mode: global` stack definition.

### Automated 1-Click Student Setup Scripts

* **Linux / Git Bash**: [student-setup.sh](file:///home/xotem/projects/vitdbms/scripts/student-setup.sh)
  ```bash
  ./scripts/student-setup.sh "<SWARM_WORKER_JOIN_TOKEN>" "192.168.1.10:2377" "student"
  ```
* **Windows (PowerShell Admin)**: [student-setup.ps1](file:///home/xotem/projects/vitdbms/scripts/student-setup.ps1)
  ```powershell
  .\scripts\student-setup.ps1 -SwarmToken "<SWARM_WORKER_JOIN_TOKEN>" -ManagerAddr "192.168.1.10:2377" -StudentUser "student"
  ```
* **Windows (Command Prompt / CMD .bat - No PowerShell)**: [student-setup.bat](file:///home/xotem/projects/vitdbms/scripts/student-setup.bat)
  ```cmd
  scripts\student-setup.bat <SWARM_WORKER_JOIN_TOKEN> 192.168.1.10:2377 student
  ```

> [!NOTE]
> If PowerShell script execution is restricted on student PCs, use `student-setup.bat` or refer to the comprehensive [RESTRICTED_POWERSHELL_GUIDE.md](file:///home/xotem/projects/vitdbms/docs/RESTRICTED_POWERSHELL_GUIDE.md).

### Manual Join Command

On each student PC (run via elevated prompt or startup script):

```cmd
:: Replace <WORKER_TOKEN> and 192.168.1.10 with Master PC values
docker swarm join --token SWMTKN-1-49mgw7p5b... 192.168.1.10:2377
```

### Automated Join via Startup Task (CMD / Batch)

Deploy a scheduled task or GPO startup script (`join-swarm.bat`) that executes at computer startup:

```cmd
@echo off
for /f "tokens=*" %%i in ('docker info --format "{{.Swarm.LocalNodeState}}" 2^>nul') do set SWARM_STATE=%%i
if not "%SWARM_STATE%"=="active" (
    docker swarm join --token SWMTKN-1-49mgw7p5b... 192.168.1.10:2377
)
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

### Deployment Method A: VBScript Helper Script (`create_shortcut.vbs` - No PowerShell)

Execute standard VBScript via CMD:

```cmd
:: Create temporary VBScript script to build desktop shortcut
echo Set WshShell = CreateObject("WScript.Shell") > create_shortcut.vbs
echo Set Shortcut = WshShell.CreateShortcut("C:\Users\Public\Desktop\SQLPlus.lnk") >> create_shortcut.vbs
echo Shortcut.TargetPath = "C:\oracle\instantclient\sqlplus.exe" >> create_shortcut.vbs
echo Shortcut.Arguments = "student/LabDbPassword2026@localhost:1521/XEPDB1" >> create_shortcut.vbs
echo Shortcut.WorkingDirectory = "C:\Users\Public\Documents" >> create_shortcut.vbs
echo Shortcut.Description = "Connect to local Oracle Database XE" >> create_shortcut.vbs
echo Shortcut.Save >> create_shortcut.vbs

cscript //nologo create_shortcut.vbs
del create_shortcut.vbs
```

### Deployment Method B: Native GPO Shortcut Policy (Domain Mass Deployment)

1. Open **Group Policy Management Console (`gpmc.msc`)**.
2. Navigate to `Computer Configuration` -> `Preferences` -> `Windows Settings` -> `Shortcuts`.
3. Right-click **Shortcuts** -> **New** -> **Shortcut**.
4. Configure Properties:
   * **Action**: `Create`
   * **Name**: `SQLPlus - Oracle Lab DB`
   * **Target Type**: `FileSystem Object`
   * **Location**: `All Users Desktop`
   * **Target Path**: `C:\oracle\instantclient\sqlplus.exe`
   * **Arguments**: `student/LabDbPassword2026@localhost:1521/XEPDB1`
   * **Working Directory**: `C:\Users\Public\Documents`

### Deployment Method C: Manual Windows GUI Setup

1. Right-click on Desktop -> **New** -> **Shortcut**.
2. Location: `C:\oracle\instantclient\sqlplus.exe student/LabDbPassword2026@localhost:1521/XEPDB1`
3. Shortcut Name: `SQLPlus - Oracle Lab DB`
4. Set **Start in** property to `C:\Users\Public\Documents`.

### Deployment Method D: Automated Shortcut Creation via PowerShell GPO Script

Deploy this script across all lab PCs to place `SQLPlus.lnk` on the Public Desktop (`C:\Users\Public\Desktop`):

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

