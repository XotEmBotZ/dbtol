@echo off
setlocal enabledelayedexpansion

:: Docker Swarm Stack Deployment Script for Windows CMD / Batch
:: Usage: deploy-stack.bat [StackName] [StackFile]
:: Example: deploy-stack.bat lab docker-stack.yml

set STACK_NAME=%~1
if "%STACK_NAME%"=="" set STACK_NAME=lab

set STACK_FILE=%~2
if "%STACK_FILE%"=="" set STACK_FILE=docker-stack.yml

set SERVICE_NAME=%STACK_NAME%_oracle-db
set NETWORK_NAME=admin_internal_net

echo [INFO] Starting Stack Deployment...
echo [INFO] Stack Name: %STACK_NAME%
echo [INFO] Stack File: %STACK_FILE%

:: 1. Check prerequisites
if not exist "%STACK_FILE%" (
    echo [ERROR] Stack file '%STACK_FILE%' not found!
    exit /b 1
)

for /f "tokens=*" %%i in ('docker info --format "{{.Swarm.LocalNodeState}}" 2^>nul') do set SWARM_STATE=%%i
if not "%SWARM_STATE%"=="active" (
    echo [ERROR] Docker Swarm is not active on this node. Please run master-setup.bat first.
    exit /b 1
)

for /f "tokens=*" %%i in ('docker network ls --filter "name=%NETWORK_NAME%" -q') do set NET_ID=%%i
if "%NET_ID%"=="" (
    echo [WARNING] Overlay network '%NETWORK_NAME%' not found. Creating...
    docker network create --driver overlay --attachable --internal %NETWORK_NAME%
)

:: 2. Deploy stack
echo [INFO] Deploying Docker Swarm stack '%STACK_NAME%'...
docker stack deploy -c "%STACK_FILE%" "%STACK_NAME%"
if errorlevel 1 (
    echo [ERROR] Failed to deploy stack '%STACK_NAME%'.
    exit /b 1
)

:: 3. Check service tasks
echo [INFO] Service tasks for '%SERVICE_NAME%' (desired-state=running):
docker service ps "%SERVICE_NAME%" --filter "desired-state=running"

echo [SUCCESS] Stack deployment command executed successfully!
endlocal
