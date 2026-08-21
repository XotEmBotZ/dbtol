#!/usr/bin/env bash
# ==============================================================================
# node-install.sh - All-in-One Child Node Setup (SQL*Plus, Swarm Join, Compose)
# Pipeable: curl -fsSL <URL>/scripts/node-install.sh | bash
# ==============================================================================
set -euo pipefail

REPO_URL="https://github.com/XotEmBotZ/dbtol.git"
INSTALL_DIR="${HOME}/dbtol"
ORACLE_BASE="/opt/oracle"
ORACLE_HOME="${ORACLE_BASE}/instantclient_21_4"
BASIC_ZIP="instantclient-basic-linux.x64-21.4.0.0.0dbru.zip"
SQLPLUS_ZIP="instantclient-sqlplus-linux.x64-21.4.0.0.0dbru.zip"
BASIC_URL="https://download.oracle.com/otn_software/linux/instantclient/214000/${BASIC_ZIP}"
SQLPLUS_URL="https://download.oracle.com/otn_software/linux/instantclient/214000/${SQLPLUS_ZIP}"

echo "============================================================"
echo "  Oracle 23c Free Node Setup & SQL*Plus Installer (WSL/Linux)"
echo "============================================================"
echo

# ------------------------------------------------------------
# 1. Prompt for Docker Swarm Join Command (reads /dev/tty for curl | bash compatibility)
# ------------------------------------------------------------
echo "=== Step 1: Docker Swarm Join Configuration ==="
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")

if [ "${SWARM_STATE}" = "active" ]; then
    echo "[INFO] Node is already part of a Docker Swarm."
else
    echo "Paste the 'docker swarm join' command from manager:"
    if [ -t 0 ]; then
        read -r SWARM_JOIN_CMD
    else
        read -r SWARM_JOIN_CMD < /dev/tty
    fi

    if [ -z "${SWARM_JOIN_CMD}" ]; then
        echo "[ERROR] No join command provided. Exiting."
        exit 1
    fi

    echo "[INFO] Executing swarm join..."
    eval "${SWARM_JOIN_CMD}"
fi

# ------------------------------------------------------------
# 2. System Architecture & Prerequisites
# ------------------------------------------------------------
echo
echo "=== Step 2: Prerequisites & Instant Client Dependencies ==="
ARCH="$(uname -m)"
if [ "$ARCH" != "x86_64" ]; then
    echo "[ERROR] Architecture is $ARCH. Only x86_64 is supported."
    exit 1
fi

sudo apt update
sudo apt install -y wget unzip ca-certificates libaio1t64 git

# Fix Ubuntu libaio compatibility
LIBAIO_DIR="/usr/lib/x86_64-linux-gnu"
if [ -f "${LIBAIO_DIR}/libaio.so.1t64" ] && [ ! -e "${LIBAIO_DIR}/libaio.so.1" ]; then
    sudo ln -s "${LIBAIO_DIR}/libaio.so.1t64" "${LIBAIO_DIR}/libaio.so.1"
fi

# ------------------------------------------------------------
# 3. Download & Extract Oracle Instant Client 21.4
# ------------------------------------------------------------
echo
echo "=== Step 3: Installing Oracle Instant Client + SQL*Plus ==="
sudo mkdir -p "$ORACLE_BASE"
sudo chown "$USER:$USER" "$ORACLE_BASE"

cd "$ORACLE_BASE"

if [ ! -f "$BASIC_ZIP" ] || [ ! -s "$BASIC_ZIP" ]; then
    echo "Downloading Basic Instant Client package..."
    wget --progress=bar:force -O "$BASIC_ZIP" "$BASIC_URL"
fi

if [ ! -f "$SQLPLUS_ZIP" ] || [ ! -s "$SQLPLUS_ZIP" ]; then
    echo "Downloading SQL*Plus package..."
    wget --progress=bar:force -O "$SQLPLUS_ZIP" "$SQLPLUS_URL"
fi

unzip -o -q "$BASIC_ZIP" -d "$ORACLE_BASE"
unzip -o -q "$SQLPLUS_ZIP" -d "$ORACLE_BASE"
mkdir -p "$ORACLE_HOME/network/admin"

# Configure dynamic linker & symlink
echo "$ORACLE_HOME" | sudo tee /etc/ld.so.conf.d/oracle-instantclient.conf >/dev/null
sudo ldconfig
sudo ln -sf "$ORACLE_HOME/sqlplus" /usr/local/bin/sqlplus

# Configure shell profile (~/.bashrc)
sed -i '/# Oracle Instant Client 21.4 - BEGIN/,/# Oracle Instant Client 21.4 - END/d' ~/.bashrc 2>/dev/null || true
cat >> ~/.bashrc <<'RC_EOF'

# Oracle Instant Client 21.4 - BEGIN
export ORACLE_IC="/opt/oracle/instantclient_21_4"
export LD_LIBRARY_PATH="$ORACLE_IC${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PATH="$ORACLE_IC:$PATH"
# Oracle Instant Client 21.4 - END
RC_EOF

export ORACLE_IC="$ORACLE_HOME"
export LD_LIBRARY_PATH="$ORACLE_IC${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
export PATH="$ORACLE_IC:$PATH"

# ------------------------------------------------------------
# 4. Clone / Update Git Repository & Start Docker Compose
# ------------------------------------------------------------
echo
echo "=== Step 4: Deploying Local Oracle Container via Compose ==="

if [ -d "$INSTALL_DIR/.git" ]; then
    echo "[INFO] Repository exists at $INSTALL_DIR. Pulling latest..."
    git -C "$INSTALL_DIR" pull
else
    echo "[INFO] Cloning $REPO_URL into $INSTALL_DIR..."
    git clone "$REPO_URL" "$INSTALL_DIR"
fi

cd "$INSTALL_DIR"

echo "[INFO] Starting Oracle container with Docker Compose..."
docker compose up -d

# ------------------------------------------------------------
# 5. Verification
# ------------------------------------------------------------
echo
echo "============================================================"
echo "                   SETUP COMPLETED!"
echo "============================================================"
echo
echo "SQL*Plus Executable : $(which sqlplus)"
echo "Compose Project     : $INSTALL_DIR"
echo "Swarm Status        : $(docker info --format '{{.Swarm.LocalNodeState}}')"
echo
echo "Container Status:"
docker compose ps
echo
echo "Connect locally using SQL*Plus:"
echo "  sqlplus SYSTEM/LabDbPassword2026@127.0.0.1:1521/FREEPDB1"
echo "  sqlplus student/StudentPassword123@127.0.0.1:1521/FREEPDB1"
echo "============================================================"
