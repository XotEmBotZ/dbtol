# Restricted PowerShell Environment Setup & Operations Guide

This guide provides exhaustive, step-by-step procedures for deploying, administering, and operating the **Oracle XE Swarm Lab Fleet** in environments where PowerShell script execution is completely blocked by corporate policy (`Set-ExecutionPolicy Restricted`), Group Policy (GPO), or AppLocker/Software Restriction Policies (SRP).

---

## 1. Why PowerShell is Restricted in Lab Environments & Security Implications

### Security Rationale for PowerShell Restrictions
In university computer labs and enterprise environments, Windows PowerShell (`powershell.exe` / `pwsh.exe`) is frequently targeted by malicious actors and unauthorized users due to its deep access to the Windows API, WMI, and administrative interfaces. Consequently, IT security policies strictly enforce PowerShell script execution blocks via:

* **Default Execution Policy**: `Set-ExecutionPolicy Restricted` (prevents execution of all unverified `.ps1` script files).
* **AppLocker Rules**: Restricting `.ps1`, `.psm1`, and `.psd1` file execution to administrative paths only.
* **GPO Machine Policies**: Disabling script execution across domain-joined student computers.
* **Constrained Language Mode (CLM)**: Disabling COM objects, custom types, and API calls within PowerShell sessions.

### Impact on Lab Deployment
If your automated setup scripts rely exclusively on `.ps1` PowerShell scripts, deployment will fail on student PCs with errors such as:
```text
File C:\scripts\student-setup.ps1 cannot be loaded because running scripts is disabled on this system.
For more information, see about_Execution_Policies at https://go.microsoft.com/fwlink/?LinkID=135170.
    + CategoryInfo          : SecurityError: (:) [], PSSecurityException
    + FullyQualifiedErrorId : UnauthorizedAccess
```

> [!IMPORTANT]
> To bypass these security restrictions without compromising IT policy or requesting system-wide execution policy bypasses, this infrastructure provides native Command Prompt (`cmd.exe`) `.bat` batch scripts, VBScript COM wrappers, and Active Directory GPO Preference workflows.

---

## 2. Master PC Setup Without PowerShell (`cmd.exe` / `.bat` / Git Bash)

The Master PC (Swarm Manager) can be fully initialized using CMD batch scripts or Git Bash.

### Option A: Standard Command Prompt (`cmd.exe` via `.bat`)

Run [master-setup.bat](file:///home/xotem/projects/vitdbms/scripts/master-setup.bat) as Administrator:

```cmd
:: Run from repo root directory in Administrator Command Prompt
scripts\master-setup.bat 192.168.1.10 oracle-xe:latest
```

#### Manual CMD Commands (Step-by-Step Equivalent):

```cmd
:: 1. Initialize Swarm Manager
docker swarm init --advertise-addr 192.168.1.10

:: 2. Display Worker Join Token (Copy string for student PCs)
docker swarm join-token worker -q

:: 3. Create Attachble Internal Overlay Network
docker network create --driver overlay --attachable --internal admin_internal_net

:: 4. Start Local Docker Registry on Port 5000
docker run -d -p 5000:5000 --restart=always --name registry registry:2

:: 5. Tag and Push Oracle XE Image to Registry
docker tag oracle-xe:latest 192.168.1.10:5000/oracle-xe:latest
docker push 192.168.1.10:5000/oracle-xe:latest
```

### Option B: Git Bash Terminal

```bash
# Execute native bash master setup script in Git Bash
./scripts/master-setup.sh "192.168.1.10" "oracle-xe:latest"
```

---

## 3. Student PC Setup Without PowerShell (`cmd.exe` / `.bat` / GPO)

Student worker PCs can join the Swarm cluster and configure local security parameters using CMD batch scripts or GPO native policies.

### Option A: Command Prompt Batch Script (`.bat`)

Run [student-setup.bat](file:///home/xotem/projects/vitdbms/scripts/student-setup.bat) in an elevated Command Prompt (`cmd.exe`):

```cmd
scripts\student-setup.bat SWMTKN-1-49mgw7p5b... 192.168.1.10:2377 student student_user/LabPassword2026@localhost:1521/XEPDB1
```

### Option B: Manual Command Prompt Execution

```cmd
:: 1. Audit and remove student user from local docker-users group
net localgroup docker-users student /delete

:: 2. Join Docker Swarm Cluster
docker swarm join --token SWMTKN-1-49mgw7p5b... 192.168.1.10:2377
```

### Option C: GPO Startup Task Deployment (No PowerShell)

Configure a Computer Startup Script GPO via `cmd.exe`:
1. Open **`gpmc.msc`** (Group Policy Management Console).
2. Navigate to `Computer Configuration` -> `Policies` -> `Windows Settings` -> `Scripts (Startup/Shutdown)` -> `Startup`.
3. Add a Batch Script (`join-swarm.bat`):
   ```cmd
   @echo off
   for /f "tokens=*" %%i in ('docker info --format "{{.Swarm.LocalNodeState}}" 2^>nul') do set SWARM_STATE=%%i
   if not "%SWARM_STATE%"=="active" (
       docker swarm join --token SWMTKN-1-49mgw7p5b... 192.168.1.10:2377
   )
   ```

---

## 4. Alternative Desktop Shortcut Creation Without PowerShell

When `.ps1` script execution is blocked, desktop shortcuts (`SQLPlus.lnk`) can be provisioned using VBScript, standard Windows GUI, or GPO Preferences.

### Method 1: Windows VBScript Helper (`create_shortcut.vbs`)

VBScript is natively supported on all Windows systems via `cscript.exe` / `wscript.exe` and is not impacted by PowerShell `ExecutionPolicy`.

Create `create_shortcut.vbs`:

```vbscript
Set WshShell = CreateObject("WScript.Shell")
PublicDesktop = WshShell.SpecialFolders("AllUsersDesktop")
Set Shortcut = WshShell.CreateShortcut(PublicDesktop & "\SQLPlus.lnk")

Shortcut.TargetPath = "C:\oracle\instantclient\sqlplus.exe"
Shortcut.Arguments = "student_user/LabPassword2026@localhost:1521/XEPDB1"
Shortcut.WorkingDirectory = "C:\Users\Public\Documents"
Shortcut.Description = "Connect to local Oracle XE Database"
Shortcut.IconLocation = "C:\oracle\instantclient\sqlplus.exe, 0"
Shortcut.Save
```

Execute via CMD:
```cmd
cscript //nologo create_shortcut.vbs
```

### Method 2: Standard Windows GUI Manual Creation

1. Right-click on the Desktop -> **New** -> **Shortcut**.
2. For **Type the location of the item**, enter:
   `C:\oracle\instantclient\sqlplus.exe student_user/LabPassword2026@localhost:1521/XEPDB1`
3. Click **Next**, enter shortcut name: `SQLPlus - Oracle Lab DB`.
4. Click **Finish**.
5. Right-click the newly created shortcut -> **Properties** -> set **Start in** to `C:\Users\Public\Documents`.

### Method 3: GPO Preferences -> Shortcuts (Domain Mass Deployment)

To deploy `SQLPlus.lnk` to 100+ lab machines without running client-side scripts:
1. Open **`gpmc.msc`**.
2. Navigate to `Computer Configuration` (or `User Configuration`) -> `Preferences` -> `Windows Settings` -> `Shortcuts`.
3. Right-click **Shortcuts** -> **New** -> **Shortcut**.
4. Configure Properties:
   * **Action**: `Update` or `Create`
   * **Name**: `SQLPlus - Oracle Lab DB`
   * **Target Type**: `FileSystem Object`
   * **Location**: `All Users Desktop` (`%Public%\Desktop`)
   * **Target Path**: `C:\oracle\instantclient\sqlplus.exe`
   * **Arguments**: `student_user/LabPassword2026@localhost:1521/XEPDB1`
   * **Working Directory**: `C:\Users\Public\Documents`

---

## 5. Auditing User Permissions Without PowerShell

To verify that student accounts cannot control the host Docker daemon socket:

### Method 1: Command Prompt (`cmd.exe` with `net.exe`)

Inspect members of `docker-users` local group:
```cmd
net localgroup docker-users
```

#### Remove Student Account via CMD:
```cmd
net localgroup docker-users student /delete
```

### Method 2: Windows Graphical UI (`lusrmgr.msc` / Computer Management)

1. Press `Win + R`, type **`lusrmgr.msc`**, and press Enter.
2. Select **Groups** -> double-click **`docker-users`**.
3. Verify the member list. Ensure only `Administrators` or `LabAdmin` are present.
4. Select any student account or `Domain Users` group and click **Remove**.
5. Click **Apply** and **OK**.

---

## 6. Operations & Batch Administrative Queries via `.bat`, Git Bash, or WSL

### Stack Deployment via `.bat` Script

Deploy the stack from the Master PC using [deploy-stack.bat](file:///home/xotem/projects/vitdbms/scripts/deploy-stack.bat):

```cmd
scripts\deploy-stack.bat lab docker-stack.yml
```

### Batch Administrative Queries via `.bat` Script

Execute batch SQL queries across all running student containers on `admin_internal_net` using [run-batch-admin.bat](file:///home/xotem/projects/vitdbms/scripts/run-batch-admin.bat):

```cmd
scripts\run-batch-admin.bat lab_oracle-db admin_internal_net "SELECT count(*) FROM user_tables;" LabDbPassword2026 gvenzl/oracle-xe
```

### Operations via Git Bash / WSL on Master PC

If Git Bash or WSL is installed on the Master PC, administrators can run the native Linux bash tools:

```bash
# Stack deployment
./scripts/deploy-stack.sh "lab" "docker-stack.yml"

# Automated batch grading over overlay network
./scripts/run-batch-admin.sh "lab_oracle-db" "admin_internal_net" "SELECT instance_name, status FROM v\$instance;" "LabDbPassword2026"
```

---

## Summary Matrix: Script Execution Paths

| Task | PowerShell (`.ps1`) Path | Restricted PowerShell (`.bat` / VBS / GPO) Path |
| :--- | :--- | :--- |
| **Master Node Setup** | `.\scripts\master-setup.ps1` | `scripts\master-setup.bat` or Git Bash `./scripts/master-setup.sh` |
| **Student Node Join** | `.\scripts\student-setup.ps1` | `scripts\student-setup.bat` or GPO Startup Batch Script |
| **User Group Audit** | `Get-LocalGroupMember` / `Remove-LocalGroupMember` | `net localgroup docker-users` / `lusrmgr.msc` |
| **Desktop Shortcut** | WScript.Shell in PowerShell | `create_shortcut.vbs` / Right-Click GUI / GPO Shortcuts |
| **Stack Deploy** | `.\scripts\deploy-stack.ps1` | `scripts\deploy-stack.bat` |
| **Batch Admin Query** | `.\scripts\run-batch-admin.ps1` | `scripts\run-batch-admin.bat` |
