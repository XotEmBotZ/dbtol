@echo off
setlocal enabledelayedexpansion

:: Student PC Setup Script for Windows CMD / Batch
:: Usage: student-setup.bat <SwarmToken> [ManagerAddr] [StudentUser] [ConnectString]
:: Example: student-setup.bat SWMTKN-1-xxx 192.168.1.10:2377 student student_user/LabPassword2026@localhost:1521/XEPDB1

set SWARM_TOKEN=%~1
if "%SWARM_TOKEN%"=="" (
    echo [ERROR] Swarm Token is required!
    echo Usage: student-setup.bat ^<SwarmToken^> [ManagerAddr] [StudentUser] [ConnectString]
    exit /b 1
)

set MANAGER_ADDR=%~2
if "%MANAGER_ADDR%"=="" set MANAGER_ADDR=192.168.1.10:2377

set STUDENT_USER=%~3
if "%STUDENT_USER%"=="" set STUDENT_USER=student

set CONNECT_STRING=%~4
if "%CONNECT_STRING%"=="" set CONNECT_STRING=student_user/LabPassword2026@localhost:1521/XEPDB1

echo [INFO] Starting Student PC Setup...
echo [INFO] Target Manager Address: %MANAGER_ADDR%

:: 1. Audit and remove student user from local docker-users group using net.exe
echo [INFO] Audit: Verifying local group 'docker-users' membership...
net localgroup docker-users | find /i "%STUDENT_USER%" >nul
if not errorlevel 1 (
    echo [WARNING] Removing user '%STUDENT_USER%' from 'docker-users' group...
    net localgroup docker-users "%STUDENT_USER%" /delete
) else (
    echo [INFO] Verified: User '%STUDENT_USER%' is not in 'docker-users' group.
)

:: 2. Join Docker Swarm cluster
for /f "tokens=*" %%i in ('docker info --format "{{.Swarm.LocalNodeState}}" 2^>nul') do set SWARM_STATE=%%i
if "%SWARM_STATE%"=="active" (
    echo [INFO] Node is already part of a Docker Swarm cluster.
) else (
    echo [INFO] Joining Docker Swarm cluster at %MANAGER_ADDR%...
    docker swarm join --token "%SWARM_TOKEN%" "%MANAGER_ADDR%"
    if errorlevel 1 (
        echo [ERROR] Failed to join Docker Swarm cluster.
        exit /b 1
    )
)

:: 3. Create transparent SQL*Plus shortcut via temporary VBScript
set SHORTCUT_PATH=C:\Users\Public\Desktop\SQLPlus.lnk
echo [INFO] Creating transparent SQL*Plus shortcut at '%SHORTCUT_PATH%'...

set VBS_SCRIPT=%TEMP%\create_shortcut.vbs
echo Set WshShell = CreateObject("WScript.Shell") > "%VBS_SCRIPT%"
echo Set Shortcut = WshShell.CreateShortcut("%SHORTCUT_PATH%") >> "%VBS_SCRIPT%"
echo Shortcut.TargetPath = "sqlplus.exe" >> "%VBS_SCRIPT%"
echo Shortcut.Arguments = "%CONNECT_STRING%" >> "%VBS_SCRIPT%"
echo Shortcut.WorkingDirectory = "C:\Users\Public\Documents" >> "%VBS_SCRIPT%"
echo Shortcut.Description = "SQL*Plus Student Direct Connection" >> "%VBS_SCRIPT%"
echo Shortcut.Save >> "%VBS_SCRIPT%"

cscript //nologo "%VBS_SCRIPT%"
del "%VBS_SCRIPT%" >nul 2>&1

if exist "%SHORTCUT_PATH%" (
    echo [SUCCESS] Created shortcut: %SHORTCUT_PATH%
) else (
    echo [ERROR] Failed to create desktop shortcut.
)

echo [SUCCESS] Student PC setup completed successfully!
endlocal
