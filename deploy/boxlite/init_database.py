import shlex
import subprocess
from pathlib import Path
from urllib.parse import unquote, urlsplit

root = Path("/app/crm")
values = {}
for line in (root / ".env").read_text().splitlines():
    if "=" in line and not line.lstrip().startswith("#"):
        key, raw = line.split("=", 1)
        parsed = shlex.split(raw, comments=True)
        values[key.strip()] = parsed[0] if parsed else ""
url = urlsplit(values["DATABASE_URL"])
if url.hostname not in ("127.0.0.1", "localhost") or url.username != "crm" or url.path != "/crm":
    raise RuntimeError("This initializer requires the local crm role and crm database")
password = unquote(url.password or "")
if len(password) < 24:
    raise RuntimeError("Generate a database password of at least 24 characters")

def sql(statement):
    result = subprocess.run(
        ["sudo", "-u", "postgres", "psql", "-v", "ON_ERROR_STOP=1", "-At"],
        input=statement, text=True, capture_output=True,
    )
    if result.returncode:
        raise RuntimeError("Database initialization failed; SQL output is withheld to protect credentials")
    return result.stdout.strip()

if sql("SELECT 1 FROM pg_roles WHERE rolname = 'crm'") != "1":
    sql("CREATE ROLE crm LOGIN PASSWORD '" + password.replace("'", "''") + "'")
if sql("SELECT 1 FROM pg_database WHERE datname = 'crm'") != "1":
    sql("CREATE DATABASE crm OWNER crm")
print("Database role and database are ready")
