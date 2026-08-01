@echo off
setlocal enabledelayedexpansion

:: Master PC Setup Script for Windows CMD / Batch
:: Usage: master-setup.bat [AdvertiseAddr] [SourceImage]
:: Example: master-setup.bat 192.168.1.10 oracle-xe:latest

set ADVERTISE_ADDR=%~1
if "%ADVERTISE_ADDR%"=="" set ADVERTISE_ADDR=192.168.1.10

set SOURCE_IMAGE=%~2
if "%SOURCE_IMAGE%"=="" set SOURCE_IMAGE=oracle-xe:latest

set TARGET_REGISTRY=%ADVERTISE_ADDR%:5000
set TARGET_IMAGE=%TARGET_REGISTRY%/oracle-xe:latest
set NETWORK_NAME=admin_internal_net
set REGISTRY_CONTAINER=registry

echo [INFO] Starting Swarm Master Node Initialization...
echo [INFO] Advertise Address: %ADVERTISE_ADDR%
echo [INFO] Source Image: %SOURCE_IMAGE%
echo [INFO] Target Image: %TARGET_IMAGE%

:: 1. Check Swarm state and initialize if inactive
for /f "tokens=*" %%i in ('docker info --format "{{.Swarm.LocalNodeState}}" 2^>nul') do set SWARM_STATE=%%i
if "%SWARM_STATE%"=="active" (
    echo [INFO] Docker Swarm is already active on this node.
) else (
    echo [INFO] Initializing Docker Swarm Manager with --advertise-addr %ADVERTISE_ADDR%...
    docker swarm init --advertise-addr %ADVERTISE_ADDR%
    if errorlevel 1 (
        echo [ERROR] Failed to initialize Docker Swarm.
        exit /b 1
    )
)

echo [INFO] Worker Join Token:
docker swarm join-token worker -q

:: 2. Create internal attachable overlay network
for /f "tokens=*" %%i in ('docker network ls --filter "name=%NETWORK_NAME%" -q') do set NET_ID=%%i
if not "%NET_ID%"=="" (
    echo [INFO] Network '%NETWORK_NAME%' already exists.
) else (
    echo [INFO] Creating attachable internal overlay network '%NETWORK_NAME%'...
    docker network create --driver overlay --attachable --internal %NETWORK_NAME%
    if errorlevel 1 (
        echo [ERROR] Failed to create overlay network '%NETWORK_NAME%'.
        exit /b 1
    )
)

:: 3. Run local Docker Registry on port 5000
docker container inspect %REGISTRY_CONTAINER% >nul 2>&1
if not errorlevel 1 (
    echo [INFO] Container '%REGISTRY_CONTAINER%' exists.
    for /f "tokens=*" %%i in ('docker container inspect -f "{{.State.Running}}" %REGISTRY_CONTAINER% 2^>nul') do set IS_RUNNING=%%i
    if not "!IS_RUNNING!"=="true" (
        echo [INFO] Starting existing registry container...
        docker container start %REGISTRY_CONTAINER%
    )
) else (
    echo [INFO] Deploying local Docker registry on port 5000...
    docker run -d -p 5000:5000 --restart=always --name %REGISTRY_CONTAINER% registry:2
    if errorlevel 1 (
        echo [ERROR] Failed to run registry container.
        exit /b 1
    )
)

:: 4. Tag and Push oracle-xe:latest to local registry
echo [INFO] Tagging %SOURCE_IMAGE% as %TARGET_IMAGE%...
docker tag %SOURCE_IMAGE% %TARGET_IMAGE%
if errorlevel 1 (
    echo [ERROR] Failed to tag image %SOURCE_IMAGE%.
    exit /b 1
)

echo [INFO] Pushing image %TARGET_IMAGE% to local registry...
docker push %TARGET_IMAGE%
if errorlevel 1 (
    echo [ERROR] Failed to push image %TARGET_IMAGE% to local registry.
    exit /b 1
)

echo [SUCCESS] Master Swarm setup completed successfully!
endlocal
