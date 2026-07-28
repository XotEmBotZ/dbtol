# Architecture & Operational Comparison Matrix

This document provides a detailed comparison between a **Standard Unhardened Docker Setup** (traditional individual container deployment) and the **Hardened Docker Swarm Lab Setup** engineered for 100+ student PCs.

---

## Executive Summary Matrix

| Comparison Dimension | Standard Unhardened Setup | Hardened Swarm Lab Setup | Security & Operational Impact |
| :--- | :--- | :--- | :--- |
| **Port Exposure & Binding** | Exposed globally on LAN (`0.0.0.0:1521`) | Bound strictly to Loopback (`127.0.0.1:1521`) | **Zero LAN attack surface**. Prevents external port scanning, unauthorized database access, and MITM attacks across the lab network. |
| **Student UX & Access** | Manual string typing: `sqlplus user/pass@192.168.1.X:1521/XEPDB1` | 1-Click Desktop Shortcut (`SQLPlus.lnk` / `SQLPlus.sh`) | **Eliminates entry errors**. Pre-configured connection strings allow instant launch without manual terminal commands. |
| **Inter-Student Snooping** | Unprotected. Students can connect to neighboring PCs | Complete isolation via `--internal` overlay & global task mode | **Prevents academic misconduct**. Students cannot snoop, copy SQL queries, or drop tables on peers' databases. |
| **Image Distribution Speed** | Direct pull from Docker Hub (100+ concurrent WAN downloads) | Master Local HTTP Registry (`192.168.1.10:5000`) over Gigabit LAN | **Massive bandwidth reduction**. Distribution speeds jump from ~30+ minutes down to 10-15 seconds per PC. |
| **Host Resource Allocation** | Uncapped RAM/CPU (Database can consume 100% host resources) | Hard Capped: 3GB RAM Limit, 2.0 CPUs, 2GB Memory Reservation | **Host OS Stability**. Prevents database memory leaks or runaway recursive queries from crashing student PCs. |
| **Management & Grading** | Manual per-PC SSH/login, manual container start/stop | Centralized Docker Swarm Stack orchestrator loop | **Automated Fleet Ops**. Administrator deploys, monitors, and updates 100+ lab nodes in a single command. |

---

## Architectural Comparison Visualized

### Standard Unhardened Setup (Vulnerable to LAN Snooping)

```mermaid
graph TD
    subgraph Lab LAN Network (192.168.1.0/24)
        PC1[Student PC 1<br>0.0.0.0:1521]
        PC2[Student PC 2<br>0.0.0.0:1521]
        Attacker[Snooping Student]
    end

    DockerHub[(Docker Hub WAN)] -->|100x Heavy Pulls| PC1
    DockerHub -->|100x Heavy Pulls| PC2

    Attacker -.->|Unauthorized Access| PC1
    Attacker -.->|Unauthorized Access| PC2
```

### Hardened Swarm Lab Setup (Isolated & Optimized)

```mermaid
graph TD
    subgraph Master Node (192.168.1.10)
        MasterReg[Local Registry<br>:5000]
        SwarmManager[Swarm Manager<br>deploy-stack.sh]
    end

    subgraph Student PC Node (Worker)
        Loopback[127.0.0.1:1521]
        Container[Isolated Oracle DB<br>Limits: 3GB RAM / 2 CPU]
        Shortcut[1-Click Desktop Shortcut<br>SQLPlus.lnk]
        
        Shortcut -->|Connects local only| Loopback
        Loopback --> Container
    end

    MasterReg -->|Gigabit LAN Pull| Container
    SwarmManager -->|Global Service Stack| Container
```

---

## Detailed Dimension Breakdown

### 1. Port Exposure & Security Binding

> [!IMPORTANT]
> In standard Docker container deployments (`-p 1521:1521`), Docker binds container ports to `0.0.0.0`, exposing the Oracle TNS Listener to every device on the local network.

- **Standard Setup**:
  - Exposes port 1521 on all network interfaces (`0.0.0.0:1521`).
  - Open to network port scanners (e.g. `nmap`), brute-force login attempts, and unauthorized remote connections.
  - Requires complex network firewall rules on every PC to restrict traffic.
- **Hardened Swarm Setup**:
  - Configured in [docker-stack.yml](file:///home/xotem/projects/vitdbms/docker-stack.yml) using `mode: host` with `host_ip: 127.0.0.1`.
  - Listeners answer strictly on the local loopback interface (`127.0.0.1:1521`).
  - Completely invisible to external network interfaces. Remote LAN connections are rejected at the OS socket layer.

---

### 2. Student User Experience (UX)

> [!TIP]
> Simplifying student login minimizes lab setup time and eliminates support requests caused by mistyped IP addresses or SID credentials.

- **Standard Setup**:
  - Students must open Command Prompt or Terminal.
  - Instructors must write connection details on the whiteboard.
  - Students type complex connection strings manually:
    `sqlplus student_user/LabPassword2026@192.168.1.45:1521/XEPDB1`
  - High error rate due to syntax mistakes, case sensitivity, or mistyped IP addresses.
- **Hardened Swarm Setup**:
  - Automated by [student-setup.sh](file:///home/xotem/projects/vitdbms/scripts/student-setup.sh) / [student-setup.ps1](file:///home/xotem/projects/vitdbms/scripts/student-setup.ps1).
  - Generates a transparent Desktop launch shortcut (`SQLPlus.lnk` on Windows or `SQLPlus.sh` on Linux).
  - Students double-click the desktop icon to immediately launch an interactive SQL*Plus session pre-authenticated to their local database container.

---

### 3. Inter-Student Snooping Protection & Academic Integrity

> [!CAUTION]
> In an unhardened lab, curious or malicious students can connect to neighboring PCs to view tables, copy exam answers, or drop databases.

- **Standard Setup**:
  - Any student can target another student's IP address (`192.168.1.X:1521`).
  - If default passwords are used, students can read/modify peer databases.
  - No isolation between student machines on the shared LAN subnet.
- **Hardened Swarm Setup**:
  - Loopback-only binding ensures no inbound connection from LAN is accepted.
  - Overlay network `admin_internal_net` created with `--internal` flag by [master-setup.sh](file:///home/xotem/projects/vitdbms/scripts/master-setup.sh) isolates cluster communication.
  - Student user accounts on the host system are explicitly removed from the local `docker` / `docker-users` group during setup to prevent students from executing `docker exec` into host containers.

---

### 4. Image Distribution & Network Bandwidth

> [!NOTE]
> Oracle Database container images range from 1.5GB to 3GB+. Pulling this image across 100+ PCs simultaneously over a standard internet connection will saturate WAN bandwidth and crash the lab router.

- **Standard Setup**:
  - 100+ PCs independently attempt to pull `gvenzl/oracle-free` or `oracle-xe` directly from Docker Hub over WAN.
  - Consumes hundreds of gigabytes of external internet traffic.
  - Takes 30-60+ minutes per lab session to initialize new or updated images.
- **Hardened Swarm Setup**:
  - Master PC initializes a local HTTP container registry on port 5000 (`192.168.1.10:5000`) via [master-setup.sh](file:///home/xotem/projects/vitdbms/scripts/master-setup.sh) / [master-setup.ps1](file:///home/xotem/projects/vitdbms/scripts/master-setup.ps1).
  - Image is seeded ONCE on the Master PC and pushed to the local registry.
  - Student PCs pull images over high-speed local Gigabit LAN in under 15 seconds per PC.

---

### 5. Host Resource Caps & Stability

- **Standard Setup**:
  - Containers execute without explicit CPU or RAM limits.
  - An unoptimized recursive SQL query, Cartesian product join, or PL/SQL infinite loop can consume 100% CPU and all system memory.
  - Out-Of-Memory (OOM) condition causes host OS lockup, requiring hard power recycles.
- **Hardened Swarm Setup**:
  - Enforces strict resource constraints in [docker-stack.yml](file:///home/xotem/projects/vitdbms/docker-stack.yml):
    ```yaml
    resources:
      limits:
        cpus: '2.0'
        memory: 3072M
      reservations:
        memory: 2048M
    ```
  - Guarantees 3GB RAM ceiling and 2 CPU core cap per database container, reserving host system RAM for OS background processes and the student's web browser/IDE.

---

### 6. Management & Grading Automation

- **Standard Setup**:
  - Lab administrators must manually log into each of the 100+ student PCs to run commands, troubleshoot container states, or restart services.
  - Upgrading database images requires repeating manual steps on every machine.
  - No central dashboard or cluster-wide health visibility.
- **Hardened Swarm Setup**:
  - Uses Docker Swarm Service Orchestration with `mode: global`.
  - Executing [deploy-stack.sh](file:///home/xotem/projects/vitdbms/scripts/deploy-stack.sh) / [deploy-stack.ps1](file:///home/xotem/projects/vitdbms/scripts/deploy-stack.ps1) from the Master PC automatically deploys, updates, or restarts the database task across all registered worker PCs in parallel.
  - Instructor can inspect fleet-wide health in real-time using `docker service ps lab_oracle-db`.

---

## Summary Checklist for Deployment Validation

- [x] Host port 1521 bound strictly to `127.0.0.1` ([docker-stack.yml](file:///home/xotem/projects/vitdbms/docker-stack.yml))
- [x] Swarm worker join scripts configured ([student-setup.sh](file:///home/xotem/projects/vitdbms/scripts/student-setup.sh) / [student-setup.ps1](file:///home/xotem/projects/vitdbms/scripts/student-setup.ps1))
- [x] Local Master Registry running on `192.168.1.10:5000` ([master-setup.sh](file:///home/xotem/projects/vitdbms/scripts/master-setup.sh))
- [x] Transparent SQL*Plus 1-click desktop shortcuts generated
- [x] Hard RAM (3GB) and CPU (2.0 cores) limits enforced
- [x] Troubleshooting & diagnostic procedures documented ([TROUBLESHOOTING.md](file:///home/xotem/projects/vitdbms/docs/TROUBLESHOOTING.md))
