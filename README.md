# VITDBMS - Oracle 23c Free Lab Infrastructure & Faculty Dashboard

A lightweight, multi-node Oracle Database 23c Free infrastructure designed for university computer labs (WSL / Linux).

---

## High-Level Architecture

```mermaid
graph TD
    subgraph Master PC (Faculty Node)
        Manager[Docker Swarm Manager]
        NetScript[scripts/create-network.sh] -->|Creates| Overlay[oracle_cluster_net <br> attachable overlay]
        Dashboard[Faculty Dashboard <br> Next.js + Bun :3000] -->|Auto-Discovers Nodes via| Sock[/var/run/docker.sock/]
        Dashboard -->|Connects over Overlay| Overlay
    end

    subgraph Student PC 1 (Worker Node)
        Worker1[Docker Swarm Worker] -->|Joined to| Manager
        Compose1[docker compose up -d] -->|Runs| Oracle1[oracle-db 23c Free]
        Oracle1 -->|Attached to| Overlay
        Oracle1 -->|Publishes strictly to| Localhost1[127.0.0.1:1521]
        SQLPlus1[Local SQL*Plus] -->|Connects| Localhost1
    end

    subgraph Student PC N (Worker Node N)
        WorkerN[Docker Swarm Worker] -->|Joined to| Manager
        ComposeN[docker compose up -d] -->|Runs| OracleN[oracle-db 23c Free]
        OracleN -->|Attached to| Overlay
        OracleN -->|Publishes strictly to| LocalhostN[127.0.0.1:1521]
        SQLPlusN[Local SQL*Plus] -->|Connects| LocalhostN
    end
```

### Key Principles
1. **Strict Localhost Isolation**: Student Oracle instances bind port 1521 strictly to `127.0.0.1:1521`. External LAN machines cannot access student databases directly.
2. **Attachable Overlay Network**: All student Oracle containers attach to the `oracle_cluster_net` overlay network for faculty management.
3. **Monochrome Brutalist Faculty Dashboard**: A zero-fluff Next.js + Bun dashboard on the master node that auto-detects all student nodes without needing to manually look up or type IP addresses.

---

## Quickstart Guide

### 1. Master Node Setup (Faculty Machine)

```bash
# 1. Initialize Docker Swarm
docker swarm init --advertise-addr <MASTER_IP>

# 2. Create the attachable overlay network
./scripts/create-network.sh

# 3. Start Faculty Dashboard
docker compose -f docker-compose.master.yml up -d --build
```
> Access Dashboard at **`http://localhost:3000`**.

---

### 2. Student / Child Node Setup (One-Liner)

Run this single command on each student machine:

```bash
curl -fsSL https://raw.githubusercontent.com/XotEmBotZ/dbtol/main/scripts/node-install.sh | bash
```

The script automatically:
- Prompts for the `docker swarm join` command.
- Installs Oracle Instant Client 21.4 + SQL*Plus.
- Clones the repository to `~/dbtol`.
- Starts the local Oracle container via `docker compose up -d`.

---

## Database Credentials & Connection Details

| Parameter | Value |
| :--- | :--- |
| **SYSDBA Password** | `LabDbPassword2026` |
| **Student Username** | `student` |
| **Student Password** | `StudentPassword123` |
| **Pluggable Database** | `FREEPDB1` |
| **Local Port** | `1521` (bound to `127.0.0.1`) |

### Local Student Connection:
```bash
sqlplus student/StudentPassword123@localhost:1521/FREEPDB1
```

### Local Admin Connection:
```bash
sqlplus SYSTEM/LabDbPassword2026@localhost:1521/FREEPDB1
```

---

## Repository Structure

```
├── docker-compose.yml          # Per-node Oracle Compose configuration (localhost:1521)
├── docker-compose.master.yml   # Master node Faculty Dashboard Compose service
├── init-db.sh                  # Database startup & user initialization script
├── faculty-dashboard/          # Next.js 16 + Bun brutalist dashboard application
│   ├── app/                    # App Router UI & API routes
│   │   ├── api/nodes/route.ts  # Swarm auto-discovery API (via docker.sock)
│   │   └── api/oracle/route.ts # Thin-mode Oracle query execution & session manager
│   ├── Dockerfile              # Bun production container image
│   └── package.json
├── scripts/
│   ├── create-network.sh       # Swarm attachable overlay network creator
│   └── node-install.sh         # All-in-one pipeable student node installer
└── docs/
    ├── ARCHITECTURE.md
    └── TROUBLESHOOTING.md
```
