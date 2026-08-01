@echo off
setlocal enabledelayedexpansion

:: Batch Admin Execution Script for Windows CMD / Batch
:: Usage: run-batch-admin.bat [ServiceName] [NetworkName] [SqlCmd] [SysPassword] [EphemeralImage]
:: Example: run-batch-admin.bat lab_oracle-db admin_internal_net "SELECT instance_name, status FROM v$instance;" LabDbPassword2026 gvenzl/oracle-xe

set SERVICE_NAME=%~1
if "%SERVICE_NAME%"=="" set SERVICE_NAME=lab_oracle-db

set NETWORK_NAME=%~2
if "%NETWORK_NAME%"=="" set NETWORK_NAME=admin_internal_net

set SQL_CMD=%~3
if "%SQL_CMD%"=="" set SQL_CMD=SELECT instance_name, status, host_name FROM v$instance;

set SYS_PASSWORD=%~4
if "%SYS_PASSWORD%"=="" set SYS_PASSWORD=LabDbPassword2026

set EPHEMERAL_IMAGE=%~5
if "%EPHEMERAL_IMAGE%"=="" set EPHEMERAL_IMAGE=gvenzl/oracle-xe

echo [INFO] Starting Batch Admin Execution...
echo [INFO] Target Service: %SERVICE_NAME%
echo [INFO] Target Network: %NETWORK_NAME%

echo [INFO] Querying service tasks for '%SERVICE_NAME%'...
docker service ps "%SERVICE_NAME%" --filter "desired-state=running"
if errorlevel 1 (
    echo [ERROR] Service '%SERVICE_NAME%' not found or docker query failed.
    exit /b 1
)

echo [INFO] Extracting container IP addresses on network '%NETWORK_NAME%'...
set TEMP_FILE=%TEMP%\overlay_ips_%RANDOM%.txt
if exist "%TEMP_FILE%" del "%TEMP_FILE%"

docker network inspect %NETWORK_NAME% --format "{{range .Containers}}{{.IPv4Address}}{{\"\n\"}}{{end}}" > "%TEMP_FILE%" 2>nul

echo [INFO] Executing SQL batch query against database containers...

for /f "tokens=1 delims=/" %%a in (%TEMP_FILE%) do (
    if not "%%a"=="" (
        echo ======================================================================
        echo [INFO] Executing SQL query against container IP: %%a
        echo ======================================================================
        
        (
            echo SET PAGESIZE 50
            echo SET LINESIZE 200
            echo %SQL_CMD%
            echo EXIT;
        ) | docker run --rm -i --net %NETWORK_NAME% %EPHEMERAL_IMAGE% sqlplus -s "sys/%SYS_PASSWORD%@%%a:1521/XE as sysdba"
        
        if errorlevel 1 (
            echo [WARNING] SQL execution encountered an issue for IP %%a
        )
        echo.
    )
)

if exist "%TEMP_FILE%" del "%TEMP_FILE%"
echo [SUCCESS] Batch admin execution completed across all nodes!
endlocal
