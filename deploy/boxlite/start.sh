#!/bin/sh
set -eu
pg_ctlcluster 15 main start || pg_ctlcluster 15 main status
exec /usr/bin/supervisord -n -c /app/crm/deploy/boxlite/supervisord.conf
