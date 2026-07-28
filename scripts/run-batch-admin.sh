#!/usr/bin/env bash
# ==============================================================================
# run-batch-admin.sh - Batch Admin Execution Across All Database Swarm Tasks
# ==============================================================================
set -euo pipefail

SERVICE_NAME="${1:-lab_oracle-db}"
NETWORK_NAME="${2:-admin_internal_net}"
SQL_CMD="${3:-SELECT instance_name, status, host_name FROM v\$instance;}"
SYS_PASSWORD="${4:-LabDbPassword2026}"
EPHEMERAL_IMAGE="${5:-gvenzl/oracle-xe}"

echo "[INFO] Starting Batch Admin Execution..."
echo "[INFO] Target Service: ${SERVICE_NAME}"
echo "[INFO] Target Network: ${NETWORK_NAME}"

# 1. Query docker service ps lab_oracle-db
echo "[INFO] Querying service tasks for '${SERVICE_NAME}'..."
if ! docker service ps "${SERVICE_NAME}" --filter "desired-state=running" >/dev/null 2>&1; then
    echo "[ERROR] Service '${SERVICE_NAME}' not found or has no running tasks."
    exit 1
fi
docker service ps "${SERVICE_NAME}" --filter "desired-state=running"

# 2. Extract container IPs on admin_internal_net
echo "[INFO] Extracting container IP addresses on network '${NETWORK_NAME}'..."
CONTAINER_IPS=()

# Extract IPs using network inspection
if docker network inspect "${NETWORK_NAME}" >/dev/null 2>&1; then
    RAW_IPS=$(docker network inspect "${NETWORK_NAME}" --format '{{range .Containers}}{{.IPv4Address}}{{"\n"}}{{end}}' 2>/dev/null | grep -v '^$' || true)
    for ip_cidr in ${RAW_IPS}; do
        ip="${ip_cidr%%/*}"
        if [ -n "${ip}" ]; then
            CONTAINER_IPS+=("${ip}")
        fi
    done
fi

if [ ${#CONTAINER_IPS[@]} -eq 0 ]; then
    echo "[ERROR] No active container IPs found attached to '${NETWORK_NAME}'."
    exit 1
fi

echo "[INFO] Found ${#CONTAINER_IPS[@]} database container IP(s): ${CONTAINER_IPS[*]}"

# 3. Run SQL commands against each database container using ephemeral container
for target_ip in "${CONTAINER_IPS[@]}"; do
    echo "======================================================================"
    echo "[INFO] Executing SQL batch query against database container at IP: ${target_ip}"
    echo "======================================================================"
    
    docker run --rm -i \
        --net "${NETWORK_NAME}" \
        "${EPHEMERAL_IMAGE}" \
        sqlplus -s "sys/${SYS_PASSWORD}@${target_ip}:1521/XE as sysdba" <<EOF || echo "[WARNING] SQL execution failed for IP ${target_ip}"
SET PAGESIZE 50
SET LINESIZE 200
${SQL_CMD}
EXIT;
EOF
    echo ""
done

echo "[SUCCESS] Batch admin execution completed across all nodes!"
