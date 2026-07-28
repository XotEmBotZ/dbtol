# Phase 3: Daily Operations, Monitoring & Batch Oversight

This document covers day-to-day lab operations, stack deployment, cluster health monitoring, automated administrative batch grading over the `admin_internal_net` overlay network, and teardown/reset workflows.

---

## 1. Daily Lab Lifecycle Workflow

```
+-----------------------------------------------------------------------------------+
| DAILY LAB LIFECYCLE                                                               |
+-----------------------------------------------------------------------------------+
| 1. LAB STARTUP     | Deploy stack `lab` from Master PC before student arrival     |
| 2. VERIFICATION    | Monitor cluster health (`docker service ps`) to confirm DBs  |
| 3. SESSION EXEC    | Students log in and execute queries via local 1-click icon   |
| 4. BATCH OVERSIGHT | Admin runs automated SQL grading script across overlay net   |
| 5. SESSION RESET   | Teardown stack or reset data volumes between classes         |
+-----------------------------------------------------------------------------------+
```

---

## 2. Deploying the Oracle DB Stack

At the start of a lab session or course term, deploy the Oracle XE stack from the Master PC.

### Stack Deployment Command

From the directory containing `docker-stack.yml` on the Master PC:

```bash
docker stack deploy -c docker-stack.yml lab
```

### What Happens During Deployment

1. The Swarm Manager evaluates the `docker-stack.yml` file.
2. Service `lab_oracle-db` configured with `mode: global` schedules exactly **one** container instance on every active worker node in the Swarm.
3. Worker nodes pull `192.168.1.10:5000/oracle-xe:latest` over the high-speed local LAN.
4. Containers start up, bind `127.0.0.1:1521` locally on host PCs, and join the overlay network `admin_internal_net`.

---

## 3. Monitoring Cluster Health & Status

Track the operational status of all 100+ Oracle database instances across the lab using Docker Swarm service inspection commands on the Master PC.

### Check Service Status & Running Instances

```bash
docker service ps lab_oracle-db --filter "desired-state=running"
```

#### Example Output:

```text
ID           NAME                                       IMAGE                             NODE            DESIRED STATE   CURRENT STATE            ERROR   PORTS
x1a2b3c4d5   lab_oracle-db.px9ab12cd34ef                192.168.1.10:5000/oracle-xe:latest   student-pc-001  Running         Running 5 minutes ago            *:1521->1521/tcp
y9z8x7w6v5   lab_oracle-db.qw8er7ty6ui5                192.168.1.10:5000/oracle-xe:latest   student-pc-002  Running         Running 5 minutes ago            *:1521->1521/tcp
```

### Filter Failed or Restarting Containers

```bash
docker service ps lab_oracle-db --filter "desired-state=shutdown" --filter "desired-state=failed"
```

### Inspect Container Logs Centrally

View database startup logs for a specific node:

```bash
docker service logs lab_oracle-db --tail 50 --raw
```

---

## 4. Automated Batch Administrative Oversight & Grading

> [!TIP]
> Because all student Oracle containers are attached to `admin_internal_net`, the instructor or administrator can run batch SQL queries against all 100+ student databases directly from the Master PC over the internal overlay network.

### Ephemeral Admin Query Runner Strategy

The Master PC can launch an ephemeral container attached to `admin_internal_net` to discover container IPs and run verification or grading queries without exposing any ports on the student PCs.

### Automated Batch Grading Script (`batch_grade.sh`)

Save this script on the Master PC to run automated checks against all active student databases:

```bash
#!/usr/bin/env bash
# batch_grade.sh - Runs SQL grading queries across all student containers on admin_internal_net

NETWORK_NAME="admin_internal_net"
GRADE_QUERY="SELECT count(*) FROM user_tables;"

echo "=== Starting Automated Batch Grading Session ==="

# Get task IDs and container IPs on the overlay network
TASKS=$(docker service ps lab_oracle-db -q --filter "desired-state=running")

for TASK in $TASKS; do
    NODE_NAME=$(docker inspect --format '{{.NodeID}}' "$TASK")
    
    echo "[+] Running grading query on Node Task: $TASK ($NODE_NAME)..."
    
    # Execute SQL command inside ephemeral query runner attached to admin_internal_net
    docker run --rm \
      --network ${NETWORK_NAME} \
      192.168.1.10:5000/oracle-xe:latest \
      sqlplus -s SYSTEM/LabDbPassword2026@${TASK}:1521/XEPDB1 <<EOF
        SET HEADINGS OFF;
        SET FEEDBACK OFF;
        ${GRADE_QUERY}
        EXIT;
EOF
done

echo "=== Batch Grading Session Completed ==="
```

---

## 5. Stack Teardown & Reset Procedures

### End-of-Day / End-of-Session Teardown

To stop all student database containers at the end of the lab session while preserving volume data:

```bash
docker stack rm lab
```

### Complete Environment Reset (Wipe & Re-initialize)

If a lab session requires resetting student databases to a clean slate:

```bash
# 1. Remove the active stack
docker stack rm lab

# 2. Wait for container cleanup confirmation
echo "Waiting for stack removal..."
sleep 10

# 3. Re-deploy the fresh stack across all nodes
docker stack deploy -c docker-stack.yml lab
```

> [!NOTE]
> Because storage inside global service instances is configured ephemerally by default, redeploying the stack automatically provides every student PC with a clean, freshly initialized Oracle XE database.
