#!/bin/bash
set -e

echo "Waiting for postgres..."
while ! pg_isready -h postgres -U timeliner; do
  sleep 1
done
echo "PostgreSQL started"

echo "Running database migrations..."
export FLASK_APP="app:create_app()"
flask db upgrade

python /app/load_mitre_data.py || echo "Warning: MITRE data loading failed, continuing..."

echo "Starting application..."
exec "$@"
