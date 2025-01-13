#!/bin/bash

# Generate random username and password
USERNAME=$(openssl rand -hex 8)
PASSWORD=$(openssl rand -base64 16)

# Create PostgreSQL user and database
# sudo -u postgres psql <<EOF#
psql <<EOF
CREATE USER "$USERNAME" WITH PASSWORD '$PASSWORD';
CREATE DATABASE access_control;
GRANT ALL PRIVILEGES ON DATABASE access_control TO "$USERNAME";
EOF

# Output the credentials
echo "Database: access_control"
echo "Username: $USERNAME"
echo "Password: $PASSWORD"