#!/usr/bin/env bash
set -o errexit

pip install -r requirements.txt
python manage.py collectstatic --noinput
python manage.py migrate
if [ "${LOAD_CHALLENGE_BANK_ON_BUILD:-true}" = "true" ]; then
  python manage.py load_challenge_bank
fi
