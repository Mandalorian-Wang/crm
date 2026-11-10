#!/bin/sh
set -eu
install -d /usr/share/postgresql-common/pgdg
curl -fsS https://www.postgresql.org/media/keys/ACCC4CF8.asc -o /usr/share/postgresql-common/pgdg/apt.postgresql.org.asc
printf 'deb [signed-by=/usr/share/postgresql-common/pgdg/apt.postgresql.org.asc] https://apt.postgresql.org/pub/repos/apt bookworm-pgdg main\n' > /etc/apt/sources.list.d/pgdg.list
apt-get update
DEBIAN_FRONTEND=noninteractive apt-get install -y postgresql-client-18
/usr/lib/postgresql/18/bin/pg_dump --version
