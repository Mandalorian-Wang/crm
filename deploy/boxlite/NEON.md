# Neon database deployment

The CRM runs on BoxLite while all application PostgreSQL data resides in Neon. The API, Next.js server, and daily import worker share the root `.env`. Linear SSO remains the identity provider.

## Project

- Organization: `org-patient-sky-92718703`
- Project: `BOXLITE-INTERNAL-CRM` (`dark-dream-09220582`)
- Branch: `production`
- Service: Postgres only
- Application: `https://internal-crm.dev.boxliteapp.com`

`neon.ts` leaves existing branch policy and optional services unchanged. Postgres exists on every Neon branch. `.neon` and all environment files remain ignored by Git.

## Setup

```sh
npm i -g neon@latest --registry=https://registry.npmjs.org
neon login
neon init -y --no-agent-setup --org-id org-patient-sky-92718703 --project-id dark-dream-09220582 --branch production --services postgres
neon deploy
```

Back up the private root `.env` before running Neon commands. The CLI writes its database variables into that file. Keep existing Linear, Backoffice, session-signing, and application URL settings. Use the official npm registry when a mirror lacks newly published Neon dependencies. Install repository dependencies with Bun.

`DATABASE_URL` supplies the pooled application connection. `DATABASE_URL_UNPOOLED` supplies the direct migration and backup connection. Prisma's existing PostgreSQL adapter remains unchanged. Prisma CLI uses the direct URL when present, and falls back to `DATABASE_URL` for local databases. Never put database connection strings in shell arguments, logs, commits, or browser code.

## Initial migration and cutover

1. Check the destination schema before importing. Do not overwrite an existing unrelated database.
2. Take an external backup of the source and restore it to Neon with `pg_restore --no-owner --no-acl --single-transaction --exit-on-error`, using direct-connection credentials through PostgreSQL environment variables.
3. Verify Prisma reads and transactional writes. Roll back verification records.
4. Build the deployed CRM with `npm run build`. `npm run build:all` also builds the optional Eve agent and requires its microsandbox VM runtime. The default build covers the frontend, API, sync dependencies, and database client.
5. Stop the API, web, and sync processes before taking the final source snapshot. Restore that snapshot, then compare row counts and content hashes for every public table before restarting any application writer.
6. Upload the private root `.env` and deploy the startup/backup helpers. Run `bun run --filter=@crm/db db:deploy` to confirm migration history.
7. Start the API, web, and sync processes. Verify the public health endpoint, authenticated organization reads, and a temporary record's write/read/delete flow. Confirm the worker resumes its existing successful-day checkpoints.
8. Stop the old local PostgreSQL service after verification. Preserve its files and the final source backup for rollback. The startup helper skips local PostgreSQL for remote database URLs.

Do not run the integration test suite against production. It requires a separate `TEST_DATABASE_URL` and contains destructive test fixtures.

## Backups and recovery

`python deploy/boxlite/manage.py backup` selects the configured database, uses the direct Neon URL, and exports the archive to the local ignored `deploy/boxlite/.local/crm.dump`. It does not silently back up the retired sandbox database. `install_pg_client.sh` installs PostgreSQL 18 client tools for the Neon PostgreSQL 18 server. An older `pg_dump` cannot back up a newer server. Use `/usr/lib/postgresql/18/bin/pg_restore` to inspect or restore Neon archives; Debian may still resolve the unqualified command to version 15.

Keep an additional copy of the final pre-Neon source dump. Rolling back after Neon accepts new writes requires transferring those writes; restarting the old database alone loses them.

A replacement BoxLite sandbox needs application code and the private Neon connection settings. It must not initialize or seed a fresh local CRM database. Rebind the held application domain to the replacement port 8080. Neon retains application data independently of the sandbox lifecycle. No automated off-platform backup schedule is created by this setup.
