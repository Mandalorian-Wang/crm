import os
import shlex
import subprocess
import sys
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlsplit

root = Path('/app/crm')
values = {}
for line in (root / '.env').read_text().splitlines():
    if '=' in line and not line.lstrip().startswith('#'):
        key, raw = line.split('=', 1)
        parsed = shlex.split(raw, comments=True)
        values[key.strip()] = parsed[0] if parsed else ''

url = urlsplit(values.get('DATABASE_URL_UNPOOLED') or values['DATABASE_URL'])
if url.scheme not in ('postgres', 'postgresql') or not url.hostname:
    raise RuntimeError('A valid PostgreSQL connection is required')
local = url.hostname in ('localhost', '127.0.0.1', '::1')
action = sys.argv[1]
if action == 'start':
    if local:
        result = subprocess.run(['pg_ctlcluster', '15', 'main', 'start'])
        if result.returncode:
            subprocess.run(['pg_ctlcluster', '15', 'main', 'status'], check=True)
    else:
        print('Using external PostgreSQL; local database startup skipped')
elif action == 'backup':
    target = Path('/root/crm.dump')
    if local:
        with target.open('wb') as output:
            subprocess.run(['sudo', '-u', 'postgres', 'pg_dump', '-Fc', unquote(url.path.lstrip('/'))], stdout=output, check=True)
    else:
        params = parse_qs(url.query)
        env = {
            **os.environ,
            'PGHOST': url.hostname,
            'PGPORT': str(url.port or 5432),
            'PGDATABASE': unquote(url.path.lstrip('/')),
            'PGUSER': unquote(url.username or ''),
            'PGPASSWORD': unquote(url.password or ''),
            'PGSSLMODE': params.get('sslmode', ['require'])[0],
        }
        subprocess.run(['/usr/lib/postgresql/18/bin/pg_dump', '-Fc', '--file', str(target)], env=env, check=True)
    target.chmod(0o600)
    print('Database backup created')
else:
    raise RuntimeError('Expected start or backup')
