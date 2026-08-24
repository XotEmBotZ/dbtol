#!/usr/bin/env bash
# ==============================================================================
# connect-sqlplus.sh - Helper script to connect to local Oracle DB via SQL*Plus
# ==============================================================================
set -euo pipefail

ORACLE_HOST="${ORACLE_HOST:-127.0.0.1}"
ORACLE_PORT="${ORACLE_PORT:-1521}"
ORACLE_SERVICE="${ORACLE_SERVICE:-FREEPDB1}"

USER_CHOICE="${1:-student}"

case "${USER_CHOICE}" in
    sys|system|admin)
        echo "[INFO] Connecting as SYSTEM to ${ORACLE_HOST}:${ORACLE_PORT}/${ORACLE_SERVICE}..."
        sqlplus SYSTEM/LabDbPassword2026@"${ORACLE_HOST}:${ORACLE_PORT}/${ORACLE_SERVICE}"
        ;;
    sysdba)
        echo "[INFO] Connecting as SYSDBA to ${ORACLE_HOST}:${ORACLE_PORT}/${ORACLE_SERVICE}..."
        sqlplus sys/LabDbPassword2026@"${ORACLE_HOST}:${ORACLE_PORT}/${ORACLE_SERVICE}" as sysdba
        ;;
    student|*)
        echo "[INFO] Connecting as student to ${ORACLE_HOST}:${ORACLE_PORT}/${ORACLE_SERVICE}..."
        sqlplus student/StudentPassword123@"${ORACLE_HOST}:${ORACLE_PORT}/${ORACLE_SERVICE}"
        ;;
esac
