-- Create the Airflow metadata database.
-- This script is auto-executed by postgres on first init
-- via /docker-entrypoint-initdb.d/ mount.
CREATE DATABASE airflow_metadata;
