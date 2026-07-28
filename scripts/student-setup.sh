#!/usr/bin/env bash
# ==============================================================================
# student-setup.sh - Automated Student Node Setup Script
# ==============================================================================
set -euo pipefail

SWARM_TOKEN="${1:-}"
MANAGER_ADDR="${2:-192.168.1.10:2377}"
STUDENT_USER="${3:-student}"
CONNECT_STRING="student_user/LabPassword2026@localhost:1521/XEPDB1"

if [ -z "${SWARM_TOKEN}" ]; then
    echo "[ERROR] Swarm join token is required!"
    echo "Usage: $0 <SWARM_TOKEN> [MANAGER_ADDR] [STUDENT_USER]"
    exit 1
fi

echo "[INFO] Starting Student PC Setup..."
echo "[INFO] Target Manager Address: ${MANAGER_ADDR}"

# 1. Check and ensure student accounts are NOT in local 'docker' / 'docker-users' group
echo "[INFO] Audit: Verifying '${STUDENT_USER}' is NOT in docker control groups..."
if getent group docker >/dev/null 2>&1; then
    if id -nG "${STUDENT_USER}" 2>/dev/null | grep -qw "docker"; then
        echo "[WARNING] Removing student user '${STUDENT_USER}' from 'docker' group to restrict control access..."
        if command -v gpasswd >/dev/null 2>&1; then
            sudo gpasswd -d "${STUDENT_USER}" docker || true
        elif command -v deluser >/dev/null 2>&1; then
            sudo deluser "${STUDENT_USER}" docker || true
        fi
    else
        echo "[INFO] Verified: User '${STUDENT_USER}' is not in 'docker' group."
    fi
else
    echo "[INFO] Local 'docker' group does not exist or requires no modification."
fi

# 2. Join Docker Swarm cluster
SWARM_STATE=$(docker info --format '{{.Swarm.LocalNodeState}}' 2>/dev/null || echo "inactive")
if [ "${SWARM_STATE}" = "active" ]; then
    echo "[INFO] Node is already part of a Docker Swarm cluster."
else
    echo "[INFO] Joining Docker Swarm cluster..."
    docker swarm join --token "${SWARM_TOKEN}" "${MANAGER_ADDR}"
fi

# 3. Create transparent SQL*Plus shortcut on Desktop
DESKTOP_DIR=""
if [ -d "/c/Users/Public/Desktop" ]; then
    DESKTOP_DIR="/c/Users/Public/Desktop"
elif [ -d "/mnt/c/Users/Public/Desktop" ]; then
    DESKTOP_DIR="/mnt/c/Users/Public/Desktop"
elif [ -d "${HOME}/Desktop" ]; then
    DESKTOP_DIR="${HOME}/Desktop"
else
    DESKTOP_DIR="/tmp"
fi

SHORTCUT_FILE="${DESKTOP_DIR}/SQLPlus.sh"
echo "[INFO] Creating transparent SQL*Plus launch shortcut at '${SHORTCUT_FILE}'..."

cat <<EOF > "${SHORTCUT_FILE}"
#!/usr/bin/env bash
# SQL*Plus Student Launcher
sqlplus ${CONNECT_STRING} "\$@"
EOF
chmod +x "${SHORTCUT_FILE}"

# If running on Windows environment via Git Bash/WSL, also attempt generating .lnk via PowerShell
if command -v powershell.exe >/dev/null 2>&1; then
    powershell.exe -NoProfile -Command "
        \$wsh = New-Object -ComObject WScript.Shell;
        \$shortcut = \$wsh.CreateShortcut('C:\\Users\\Public\\Desktop\\SQLPlus.lnk');
        \$shortcut.TargetPath = 'sqlplus.exe';
        \$shortcut.Arguments = '${CONNECT_STRING}';
        \$shortcut.Description = 'SQL*Plus Student Connection';
        \$shortcut.Save();
    " 2>/dev/null || true
fi

echo "[SUCCESS] Student PC setup completed successfully!"
