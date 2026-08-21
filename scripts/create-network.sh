#!/usr/bin/env bash
# ==============================================================================
# create-network.sh - Create Docker Swarm Attachable Overlay Network
# ==============================================================================
set -euo pipefail

NETWORK_NAME="${1:-oracle_cluster_net}"

# Verify Docker Swarm is active on this node (Manager)
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
if [ "${SWARM_STATE}" != "active" ]; then
    echo "[ERROR] Docker Swarm is not initialized/active on this node."
    echo "[INFO] Run 'docker swarm init --advertise-addr <MANAGER_IP>' on the manager node first."
    exit 1
fi

# Check if overlay network already exists
if docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1; then
    echo "[INFO] Network '${NETWORK_NAME}' already exists."
else
    echo "[INFO] Creating attachable overlay network '${NETWORK_NAME}'..."
    docker network create \
        --driver overlay \
        --attachable \
        "${NETWORK_NAME}"
    echo "[SUCCESS] Overlay network '${NETWORK_NAME}' created successfully!"
fi
