#!/bin/bash
# Exit on any error
set -e

echo "Running database initialization script..."

# Start background loop to wait for FREEPDB1 to be open and ORDS to be installed,
# so we can create/REST-enable the STUDENT and TEACHER schemas inside the pluggable database.
(
  echo "Background schema-enable loop started..."
  for i in {1..120}; do
    # Check if FREEPDB1 pluggable database is open read-write
    pdb_status=$(sqlplus -s / as sysdba <<EOF
SET HEAD OFF FEEDBACK OFF PAGES 0
SELECT open_mode FROM v\$pdbs WHERE name = 'FREEPDB1';
exit;
EOF
    )
    pdb_status=$(echo "$pdb_status" | tr -d '[:space:]')
    
    if [ "$pdb_status" = "READWRITE" ]; then
      # PDB is open! Ensure STUDENT and TEACHER users are created locally in FREEPDB1 PDB
      sqlplus -s / as sysdba <<EOF
ALTER SESSION SET CONTAINER = FREEPDB1;

-- Grant inherit privileges to ORDS schema owner (required to allow ORDS execution as SYS)
GRANT INHERIT PRIVILEGES ON USER SYS TO ORDS_METADATA;

-- Create local user STUDENT
DECLARE
  user_count NUMBER;
BEGIN
  SELECT count(*) INTO user_count FROM dba_users WHERE username = 'STUDENT';
  IF user_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE USER STUDENT IDENTIFIED BY StudentPassword123';
    EXECUTE IMMEDIATE 'GRANT CONNECT, RESOURCE, DBA TO STUDENT';
    EXECUTE IMMEDIATE 'ALTER USER STUDENT QUOTA UNLIMITED ON USERS';
  END IF;
END;
/

-- Create local user TEACHER
DECLARE
  user_count NUMBER;
BEGIN
  SELECT count(*) INTO user_count FROM dba_users WHERE username = 'TEACHER';
  IF user_count = 0 THEN
    EXECUTE IMMEDIATE 'CREATE USER TEACHER IDENTIFIED BY OraclePassword123';
    EXECUTE IMMEDIATE 'GRANT CONNECT, RESOURCE, DBA TO TEACHER';
    EXECUTE IMMEDIATE 'ALTER USER TEACHER QUOTA UNLIMITED ON USERS';
  END IF;
END;
/
exit;
EOF

      # Check if ORDS is installed and package is valid in FREEPDB1 PDB
      ords_status=$(sqlplus -s / as sysdba <<EOF
ALTER SESSION SET CONTAINER = FREEPDB1;
SET HEAD OFF FEEDBACK OFF PAGES 0
SELECT status FROM dba_objects WHERE owner = 'ORDS_METADATA' AND object_name = 'ORDS' AND object_type = 'PACKAGE';
exit;
EOF
      )
      ords_status=$(echo "$ords_status" | tr -d '[:space:]')
      
      if [ "$ords_status" = "VALID" ]; then
        echo "ORDS package detected in FREEPDB1! REST-enabling STUDENT and TEACHER schemas..."
        sqlplus -s / as sysdba <<EOF
ALTER SESSION SET CONTAINER = FREEPDB1;
BEGIN
  ORDS.ENABLE_SCHEMA(
    p_enabled             => TRUE,
    p_schema              => 'STUDENT',
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'student',
    p_auto_rest_auth      => FALSE
  );
  
  ORDS.ENABLE_SCHEMA(
    p_enabled             => TRUE,
    p_schema              => 'TEACHER',
    p_url_mapping_type    => 'BASE_PATH',
    p_url_mapping_pattern => 'teacher',
    p_auto_rest_auth      => FALSE
  );
  COMMIT;
END;
/
exit;
EOF
        echo "STUDENT and TEACHER schemas REST-enabled successfully in FREEPDB1."
        break
      fi
    fi
    
    echo "Waiting for FREEPDB1 to be open and ORDS to be installed... ($i/120)"
    sleep 5
  done
) &
