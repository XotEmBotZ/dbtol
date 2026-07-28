#!/bin/bash
# Exit on error
set -e

echo "Starting ORDS Master Entrypoint..."

# 1. Initialize global ORDS configuration if settings.xml doesn't exist
if [ ! -f "$ORDS_CONFIG/global/settings.xml" ]; then
  echo "Initializing global ORDS configurations..."
  ords --config $ORDS_CONFIG config set --global database.api.enabled true
  ords --config $ORDS_CONFIG config set --global feature.sdw true
  ords --config $ORDS_CONFIG config set --global restEnabledSql.active true
  ords --config $ORDS_CONFIG config set --global security.requireHTTPS false
fi

# 2. Configure ORDS pools for each student database instance
# We wait for the databases to be accessible first (handled by depends_on healthcheck in docker-compose, but we add a safety check here)
for pool in student1 student2 student3; do
  db_host=""
  if [ "$pool" = "student1" ]; then db_host="oracle-db-1"; fi
  if [ "$pool" = "student2" ]; then db_host="oracle-db-2"; fi
  if [ "$pool" = "student3" ]; then db_host="oracle-db-3"; fi

  # Check if the database connection pool already has a configuration file
  if [ ! -f "$ORDS_CONFIG/databases/$pool/pool.xml" ]; then
    echo "Installing and configuring ORDS pool '$pool' for database $db_host..."
    
    # Run the ORDS installer in silent mode.
    # It takes the SYS password and ORDS_PUBLIC_USER password from stdin.
    ords --config $ORDS_CONFIG install \
      --db-pool $pool \
      --db-hostname $db_host \
      --db-port 1521 \
      --db-servicename FREEPDB1 \
      --admin-user SYS \
      --proxy-user \
      --password-stdin <<EOF
$ORACLE_PASSWORD
$ORDS_PUBLIC_USER_PASSWORD
EOF
    echo "Pool '$pool' configured successfully."
  else
    echo "ORDS pool '$pool' configuration already exists. Skipping install."
  fi
done

echo "Starting ORDS Standalone Server on port 8080..."
# Start the ORDS web server
exec ords --config $ORDS_CONFIG serve
