#!/usr/bin/env bash
# ==============================================================================
# deploy-stack.sh - Docker Swarm Stack Deployment & Health Check Script
# ==============================================================================
set -euo pipefail

STACK_NAME="${1:-lab}"
STACK_FILE="${2:-docker-stack.yml}"
SERVICE_NAME="${STACK_NAME}_oracle-db"
NETWORK_NAME="admin_internal_net"

echo "[INFO] Starting Stack Deployment..."
echo "[INFO] Stack Name: ${STACK_NAME}"
echo "[INFO] Stack File: ${STACK_FILE}"

# 1. Check prerequisites
if [ ! -f "${STACK_FILE}" ]; then
    echo "[ERROR] Stack file '${STACK_FILE}' not found!"
    exit 1
fi

SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
if [ "${SWARM_STATE}" != "active" ]; then
    echo "[ERROR] Docker Swarm is not active on this node. Please run master-setup.sh first."
    exit 1
fi

if ! docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1; then
    echo "[WARNING] Overlay network '${NETWORK_NAME}' not found. Creating..."
    docker network create --driver overlay --attachable --internal "${NETWORK_NAME}"
fi

# 2. Deploy stack
echo "[INFO] Deploying Docker Swarm stack '${STACK_NAME}'..."
docker stack deploy -c "${STACK_FILE}" "${STACK_NAME}"

# 3. Check task health
echo "[INFO] Waiting 5 seconds before checking service status..."
sleep 5

echo "[INFO] Querying service tasks for '${SERVICE_NAME}' (desired-state=running)..."
docker service ps "${SERVICE_NAME}" --filter "desired-state=running"

echo "[SUCCESS] Stack deployment command executed successfully!"
