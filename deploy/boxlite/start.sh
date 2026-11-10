#!/bin/sh
set -eu
python3 /app/crm/deploy/boxlite/database.py start
exec /usr/bin/supervisord -n -c /app/crm/deploy/boxlite/supervisord.conf
