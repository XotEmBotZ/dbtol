#!/usr/bin/env bash
# ==============================================================================
# master-setup.sh - Universal Docker Swarm Master Initialization Script
# ==============================================================================
set -euo pipefail

ADVERTISE_ADDR="${1:-192.168.1.10}"
SOURCE_IMAGE="${2:-oracle-xe:latest}"
TARGET_REGISTRY="${ADVERTISE_ADDR}:5000"
TARGET_IMAGE="${TARGET_REGISTRY}/oracle-xe:latest"
NETWORK_NAME="admin_internal_net"
REGISTRY_CONTAINER_NAME="registry"

echo "[INFO] Starting Swarm Master Node Initialization..."
echo "[INFO] Advertise Address: ${ADVERTISE_ADDR}"
echo "[INFO] Source Image: ${SOURCE_IMAGE}"
echo "[INFO] Target Image: ${TARGET_IMAGE}"

# 1. Initialize Docker Swarm Manager
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
if [ "${SWARM_STATE}" = "active" ]; then
    echo "[INFO] Docker Swarm is already active on this node."
else
    echo "[INFO] Initializing Docker Swarm Manager with --advertise-addr ${ADVERTISE_ADDR}..."
    docker swarm init --advertise-addr "${ADVERTISE_ADDR}"
fi

# Print Join Tokens for reference
echo "[INFO] Worker Join Token:"
docker swarm join-token worker -q || true

# 2. Create internal attachable overlay network admin_internal_net
if docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1; then
    echo "[INFO] Network '${NETWORK_NAME}' already exists."
else
    echo "[INFO] Creating attachable internal overlay network '${NETWORK_NAME}'..."
    docker network create \
        --driver overlay \
        --attachable \
        --internal \
        "${NETWORK_NAME}"
fi

# 3. Run local Docker Registry on port 5000
if docker container inspect "${REGISTRY_CONTAINER_NAME}" >/dev/null 2>&1; then
    echo "[INFO] Container '${REGISTRY_CONTAINER_NAME}' exists."
    if [ "$(docker container inspect -f '{{.State.Running}}' "${REGISTRY_CONTAINER_NAME}")" != "true" ]; then
        echo "[INFO] Starting registry container..."
        docker container start "${REGISTRY_CONTAINER_NAME}"
    fi
else
    echo "[INFO] Deploying local Docker registry on port 5000..."
    docker run -d \
        -p 5000:5000 \
        --restart=always \
        --name "${REGISTRY_CONTAINER_NAME}" \
        registry:2
fi

# 4. Tag and Push oracle-xe:latest to local registry
echo "[INFO] Tagging ${SOURCE_IMAGE} as ${TARGET_IMAGE}..."
docker tag "${SOURCE_IMAGE}" "${TARGET_IMAGE}"

echo "[INFO] Pushing image ${TARGET_IMAGE} to local registry..."
docker push "${TARGET_IMAGE}"

echo "[SUCCESS] Master Swarm setup completed successfully!"
