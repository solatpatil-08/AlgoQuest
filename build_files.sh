#!/usr/bin/env bash
# Exit immediately if a command exits with a non-zero status
set -o errexit

echo "==> Installing Python dependencies..."
python3 -m pip install -r requirements.txt

echo "==> Collecting static files..."
python3 manage.py collectstatic --noinput

# Optionally execute migrations if DATABASE_URL is configured and enabled
if [ -n "$DATABASE_URL" ] && [ "${RUN_MIGRATIONS_ON_BUILD:-false}" = "true" ]; then
  echo "==> Running database migrations..."
  python3 manage.py migrate --noinput
  if [ "${LOAD_CHALLENGE_BANK_ON_BUILD:-false}" = "true" ]; then
    echo "==> Loading challenge bank into database..."
    python3 manage.py load_challenge_bank
  fi
fi

echo "==> Build completed successfully!"
