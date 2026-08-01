# Post-Swarm-Join Operations Guide & Command Reference

This document provides a step-by-step reference of commands to execute on the **Master Node** and **Student Worker Nodes** immediately after completing `docker swarm init` and `docker swarm join`.

---

## 1. Master Node Verification

Run these commands on the **Master PC** to confirm cluster health before stack deployment:

```bash
# 1. Check all nodes joined the Swarm and are Active
docker node ls

# 2. Verify the internal overlay network exists
docker network inspect admin_internal_net
```

---

## 2. Stack Deployment

Deploy or update the global Oracle RDBMS service stack across all joined worker nodes:

### Option A: Using the Automated Script (Recommended)
```bash
./scripts/deploy-stack.sh
```

### Option B: Using Manual Docker Stack Command
```bash
docker stack deploy -c docker-stack.yml lab
```

---

## 3. Monitoring Service Health & Task Distribution

Monitor service provisioning and container startup across the lab fleet:

```bash
# 1. View running Swarm stacks
docker stack ls

# 2. View global service replica count (Target: N/N running)
docker service ls

# 3. View task status per node
docker service ps lab_oracle-db

# 4. View detailed task status (including errors if any)
docker service ps lab_oracle-db --no-trunc

# 5. Tail aggregated live logs from all containers in the stack
docker service logs -f lab_oracle-db
```

---

## 4. Student PC Local Verification (Student Worker Node)

Run these commands directly on any **Student PC** to verify local database operation:

```bash
# 1. Verify local container is running
docker ps

# 2. Test local Oracle healthcheck script
docker exec $(docker ps -q -f name=lab_oracle-db) /opt/oracle/healthcheck.sh

# 3. Test SQL*Plus connection on loopback (127.0.0.1:1521)
sqlplus SYSTEM/LabDbPassword2026@//127.0.0.1:1521/FREEPDB1
```

---

## 5. Automated Fleet Administration & Grading

Run batch queries across all student nodes from the Master PC:

```bash
# Example: Check database open status across all lab containers
./scripts/run-batch-admin.sh "SELECT name, open_mode FROM v\$pdbs;"

# Example: Check connected session count
./scripts/run-batch-admin.sh "SELECT count(*) FROM v\$session WHERE status = 'ACTIVE';"
```

---

## 6. Stack Maintenance & Lifecycle Operations

```bash
# Force a rolling update / restart of all containers in the fleet
docker service update --force lab_oracle-db

# Tear down the stack without leaving the Swarm cluster
docker stack rm lab
```
