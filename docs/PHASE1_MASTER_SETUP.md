# Phase 1: Master PC Setup & Cluster Initialization

This guide provides step-by-step instructions for setting up the **Master PC** (Docker Swarm Manager), initializing the internal overlay network, and hosting a local Docker registry for distribution across 100+ lab computers.

---

## Prerequisites

Before initializing the Master PC:
1. Ensure Docker Engine (v20.10 or higher) is installed and the Docker daemon is running.
2. Configure a static IP address on the physical LAN interface of the Master PC (e.g., `192.168.1.10`).
3. Verify firewall rules allow TCP port `2377` (Swarm management), TCP/UDP port `7946` (container network discovery), and UDP port `4789` (overlay network traffic) from worker PCs.

---

## Automated 1-Click Master Initialization Scripts

For automated setup across Linux, standard PowerShell, or restricted Windows CMD environments, run the corresponding initialization script from the repository root:

* **Linux / Git Bash**: [master-setup.sh](file:///home/xotem/projects/vitdbms/scripts/master-setup.sh)
  ```bash
  chmod +x scripts/master-setup.sh
  ./scripts/master-setup.sh "192.168.1.10" "oracle-xe:latest"
  ```
* **Windows (PowerShell Admin)**: [master-setup.ps1](file:///home/xotem/projects/vitdbms/scripts/master-setup.ps1)
  ```powershell
  .\scripts\master-setup.ps1 -AdvertiseAddr "192.168.1.10" -SourceImage "oracle-xe:latest"
  ```
* **Windows (Command Prompt / CMD .bat - No PowerShell)**: [master-setup.bat](file:///home/xotem/projects/vitdbms/scripts/master-setup.bat)
  ```cmd
  scripts\master-setup.bat 192.168.1.10 oracle-xe:latest
  ```

> [!NOTE]
> If PowerShell script execution is restricted on your Windows host (`ExecutionPolicy Restricted`), use `master-setup.bat` or refer to the comprehensive [RESTRICTED_POWERSHELL_GUIDE.md](file:///home/xotem/projects/vitdbms/docs/RESTRICTED_POWERSHELL_GUIDE.md).

---

## Step 1: Initialize Swarm Manager

Initialize the Docker node as the Swarm Manager by advertising its static LAN IP address.

```bash
# Replace 192.168.1.10 with your Master PC's physical LAN IP address
export MASTER_LAN_IP="192.168.1.10"

docker swarm init --advertise-addr ${MASTER_LAN_IP}
```

### Output Verification & Join Token Capture

Upon successful initialization, Docker displays the command for worker nodes to join:

```text
Swarm initialized: current node (px9ab12cd34ef) is now a manager.

To add a worker to this swarm, run the following command:

    docker swarm join --token SWMTKN-1-49mgw7p5b... 192.168.1.10:2377
```

> [!TIP]
> Save the worker join token string (`SWMTKN-1-...`). You can retrieve it at any time from the Master PC by running:
> ```bash
> docker swarm join-token worker -q
> ```

---

## Step 2: Create Internal Attachable Overlay Network

Create the `admin_internal_net` overlay network. This network enables administrative oversight and grading from the Master PC without routing container traffic over the physical LAN.

```bash
docker network create \
  --driver overlay \
  --attachable \
  --internal \
  admin_internal_net
```

### Network Configuration Flags

* `--driver overlay`: Enables multi-host networking across all Docker Swarm nodes.
* `--attachable`: Allows non-swarm containers (e.g., ad-hoc admin grading scripts or query runners) to manually attach to the network.
* `--internal`: Restricts external connectivity. Containers connected to this overlay cannot route traffic out to the internet or the physical LAN through the overlay interface.

Verify network creation:

```bash
docker network ls --filter name=admin_internal_net
```

---

## Step 3: Configure & Launch Local Docker Registry

To avoid downloading large Oracle database images individually on 100+ PCs over the internet, host a local registry on port `5000` of the Master PC.

### 1. Launch the Registry Service

```bash
docker run -d \
  -p 5000:5000 \
  --restart=always \
  --name registry \
  registry:2
```

### 2. Configure Insecure Registry Access

Because the local registry runs over HTTP without TLS inside the lab network, configure Docker on the Master PC (and worker nodes) to trust the registry.

Edit `/etc/docker/daemon.json` (Linux) or `C:\ProgramData\Docker\config\daemon.json` (Windows):

```json
{
  "insecure-registries": [
    "192.168.1.10:5000"
  ]
}
```

Restart the Docker service to apply changes:

```bash
# Linux
sudo systemctl restart docker

# Windows (PowerShell as Administrator)
Restart-Service docker
```

---

## Step 4: Tag & Push Oracle XE Image to Local Registry

Tag your prepared Oracle XE image with the local registry address and push it so worker nodes can pull it rapidly over the physical LAN.

```bash
# 1. Tag the local image for the registry
docker tag oracle-xe:latest 192.168.1.10:5000/oracle-xe:latest

# 2. Push image to local registry
docker push 192.168.1.10:5000/oracle-xe:latest
```

### Verification

Verify that the image is available in the local registry catalog:

```bash
curl -X GET http://192.168.1.10:5000/v2/_catalog
```

Expected response:

```json
{"repositories":["oracle-xe"]}
```

---

## Next Steps

With the Master PC configured, proceed to **Phase 2: Student PC Setup** ([PHASE2_STUDENT_SETUP.md](file:///home/xotem/projects/vitdbms/docs/PHASE2_STUDENT_SETUP.md)) to configure worker nodes and deploy 1-click desktop access shortcuts.
