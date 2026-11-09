# BoxLite CRM deployment

The BoxLite dev sandbox serves the app through Nginx on port 8080. The public tunnel uses HTTPS. PostgreSQL, the API, and Next.js remain behind the gateway. Only the gateway port is published.

## Login

Set `ALLOWED_SIGN_IN=polygala.ai` and `CRM_PASSWORD_LOGIN=true`. The provisioning command reads `CRM_ADMIN_USERNAME` and `CRM_ADMIN_PASSWORD` from the private root `.env`. It creates a credential account with a scrypt password hash. Public email/password signup is disabled. The username form maps `admin` to `admin@polygala.ai`. The normal session, secure-cookie, origin and rate-limit protections remain enabled. Google, Microsoft and OIDC support remain available when configured.

Run `bun run --filter=@crm/sync bootstrap` after migrations. Re-running it preserves the workspace and contacts. A changed admin password replaces the hash and revokes that account's sessions. Set `CRM_PASSWORD_LOGIN=false` when retiring temporary password access.

`CRM_RESEARCH_OPTIONAL=true` permits the app to run without a Context enrichment key. It does not enable AI research. Configure the existing agent separately to use AI features.

## Import schedule and recovery

The supervised sync worker runs both sources at 00:00 UTC, equivalent to 08:00 Asia/Shanghai. It checks each minute. Starting after the scheduled time recovers the missed run. A successful source runs once per UTC date. Failed sources retry after fifteen minutes. Each source holds a PostgreSQL advisory lock; a second worker cannot run the same source concurrently. `importRun` stores outcome, processed count, and timestamps.

The first run imports the current accessible baseline. Later runs enumerate current records and insert missing identities. Full enumeration discovers new members in older Cloud organizations. Imports do not infer churn from missing source records. A failed or partial source never receives a successful checkpoint. Identity records make retries idempotent. Archives and purges of mapped records do not trigger automatic recreation.

Manual retry: `bun run --filter=@crm/sync sync --force`.

## Mapping

| Source | CRM | Mapping |
| --- | --- | --- |
| Cloud organization | Company | Exact organization name, source ID, organization creation date, member count, Box count |
| Cloud member | Contact | Source display name, validated email when present, user ID, membership joining date |
| Cloud organization/member pair | Deal | One signup opportunity, organization, owner, member identity and joining date |
| GitHub stargazer | Contact | Numeric GitHub ID, public username, profile URL, avatar, repository and Star time |

Cloud opportunities start at `NEW_SIGNUP` / **Cloud signup**. Amount stays null. Signup is not a purchase or sales qualification. Organization creation time and membership joining time are distinct; neither is asserted to be the user's original registration time.

Contacts are deduplicated by stable Cloud user ID and exact valid email; GitHub contacts use numeric GitHub ID and exact profile URL. The importer does not infer an email from a GitHub username or merge people by similar names. One person in multiple Cloud organizations retains the existing Company relationship. Each organization/member deal retains its source identifiers; a DealContact association is created only when the Contact belongs to that Company.

Existing core names, owners, company relationships, deal stages, amounts, and manual Notion URLs are preserved. Source-specific custom fields refresh from the source.

The `notion_document` URL custom field appears on every Contact's detail sheet. Users enter the document URL manually. The importer never writes this field and never creates a Notion page.

## Source access

Backoffice uses `BACKOFFICE_API_KEY` as a Bearer token and requires `customers.impact.read`. It follows every customer cursor and every independent member cursor, including empty pages with continuation cursors. The endpoint defaults to `https://api.backoffice.boxlite.ai`.

Backoffice does not expose GitHub stargazers. The importer uses GitHub's public stargazers API for `GITHUB_STAR_REPOSITORY`, default `boxlite-ai/boxlite`. Public access works without a token within the IP rate limit. `GITHUB_TOKEN` is optional; use a dedicated read-only credential when the unauthenticated limit is insufficient.

## Runtime

Install PostgreSQL 15, Nginx, Supervisor, Node 22 and Bun in the sandbox. Copy the repository into `/app/crm` and put the private `.env` there with mode 0600. Set `API_URL` and `APP_URL` to the actual URL returned by BoxLite's tunnel API. Set `INTERNAL_API_URL=http://127.0.0.1:3001`.

Run dependency installation, Prisma migrations, admin provisioning, and the Next.js production build. Copy `nginx.conf` into Nginx's enabled sites. Install an executable `/opt/crm-start` that invokes `sudo -n /app/crm/deploy/boxlite/start.sh`. The sandbox entrypoint waits for this file and runs it after each start.

The supervisor restarts API, web, sync, and gateway processes. The startup script starts PostgreSQL first. Logs use `/var/log/crm-*`. `GET /healthz` checks API/database availability. Verify the sign-in page separately for web readiness.

The sandbox disk stores PostgreSQL data. Keep the sandbox; deleting it destroys its database. Backups must be exported outside the sandbox. No managed external backup service is configured by these files.

## Reproduce the deployment

Use a fresh Debian 12 x86_64 `python` sandbox. The provision script installs PostgreSQL 15, Node 22.22.0 and Bun 1.4.4. Run commands from the repository root.

1. Create a local Python environment outside the checkout and install `boxlite==0.11.0`.
2. Export `BOXLITE_API_KEY` from your secret manager or existing shell configuration. Set `BOXLITE_REST_URL=https://api.dev.boxlite.ai`. Do not paste the key into a command, this document, or a Git commit.
3. Run `python deploy/boxlite/manage.py create`. This creates a persistent sandbox and an HTTPS tunnel. It writes identifiers to the ignored `deploy/boxlite/.local/deployment.json`. It refuses to replace an existing sandbox.
4. Copy `.env.example` to the root `.env`. Set `DATABASE_URL` to a local `crm` database connection with a random password of at least 24 characters. Set a random `BETTER_AUTH_SECRET`, `ALLOWED_SIGN_IN=polygala.ai`, `CRM_PASSWORD_LOGIN=true`, `CRM_RESEARCH_OPTIONAL=true`, `CRM_ADMIN_USERNAME`, `CRM_ADMIN_PASSWORD`, and `BACKOFFICE_API_KEY`. Set `API_URL` and `APP_URL` to the returned tunnel URL and `INTERNAL_API_URL=http://127.0.0.1:3001`. Set `GITHUB_STAR_REPOSITORY=boxlite-ai/boxlite`. Keep `GITHUB_TOKEN` unset unless you have a dedicated read-only token. Use `chmod 600 .env`.
5. Commit source changes before upload. The uploader archives committed `HEAD`, never the working directory, secrets, or installed dependencies.

```sh
python deploy/boxlite/manage.py upload
python deploy/boxlite/manage.py upload-env
python deploy/boxlite/manage.py run 'sh /app/crm/deploy/boxlite/provision.sh'
python deploy/boxlite/manage.py run 'python3 /app/crm/deploy/boxlite/init_database.py'
python deploy/boxlite/manage.py run 'cd /app/crm && bun install --frozen-lockfile --registry https://registry.npmjs.org && bun run --filter=@crm/db db:generate && bun run --filter=@crm/db db:deploy && bun run --filter=@crm/sync bootstrap && NEXT_TELEMETRY_DISABLED=1 bun run --filter=app build'
```

The initializer only creates a missing role or database. It never resets a database or changes an existing role password. Database credentials travel through process input, not command arguments or output.

Activate the gateway and startup script after the build succeeds:

```sh
python deploy/boxlite/manage.py run 'cp /app/crm/deploy/boxlite/nginx.conf /etc/nginx/sites-enabled/default && nginx -t && chmod 700 /app/crm/deploy/boxlite/start.sh && printf "#!/bin/sh\nexec sudo -n /app/crm/deploy/boxlite/start.sh\n" > /opt/crm-start && chmod 755 /opt/crm-start'
python deploy/boxlite/manage.py status
```

Verify `/healthz`, `/sign-in`, invalid-password rejection, successful admin login, Contact fields, and Deals. Check both source results using:

```sh
python deploy/boxlite/manage.py run 'tail -20 /var/log/crm-sync.log; tail -20 /var/log/crm-sync-error.log'
```

The SDK file API sits behind a request-size limit. Keep archives below 16 MiB. Install dependencies inside the sandbox; never upload `node_modules` with the source. Use the official npm registry when a local npm mirror cannot serve the lockfile or audit API.

## Update, backup and recovery

Before updates, run `python deploy/boxlite/manage.py backup`. The dump stays in the ignored private deployment directory. Store an encrypted copy outside the sandbox. Do not commit a dump: it contains customer data and authentication records.

For this dev environment, stop the supervised programs during updates, upload committed source, run installation/migrations/build, then start the programs. This is a maintenance operation and does not promise zero downtime.

```sh
python deploy/boxlite/manage.py run 'supervisorctl -c /app/crm/deploy/boxlite/supervisord.conf stop all'
python deploy/boxlite/manage.py upload
python deploy/boxlite/manage.py run 'cd /app/crm && bun install --frozen-lockfile --registry https://registry.npmjs.org && bun run --filter=@crm/db db:generate && bun run --filter=@crm/db db:deploy && NEXT_TELEMETRY_DISABLED=1 bun run --filter=app build'
python deploy/boxlite/manage.py run 'supervisorctl -c /app/crm/deploy/boxlite/supervisord.conf start all'
python deploy/boxlite/manage.py status
```

Upload `.env` again only when configuration changes. Run `bootstrap` after an intentional admin-password change. Never delete the sandbox as a restart method. Its entrypoint restores PostgreSQL and Supervisor after a normal stop/start. Restore a database dump into a separate sandbox first to verify it before replacing data.

## Validation and dependency updates

Use a separate database whose name ends in `_test`. Set `TEST_DATABASE_URL` to it, apply migrations, and run the repository checks. Never point tests at `crm`.

```sh
bun run check-types
bun run lint
bun run lint:slop
bun run test
npm_config_registry=https://registry.npmjs.org bun audit
```

This customization upgrades Next.js to 16.4.1 and Better Auth and its plugins to 1.7.7. The lockfile includes security fixes for transitive dependencies. The root overrides keep Multer, the Vercel CLI's Zod, and Vercel Blob's Undici on patched compatible releases. Run the full checks after dependency changes. Avoid regenerating the auth schema over the application schema without reviewing the migration.

`.gitignore` excludes root `.env` files, private deployment state, database dumps, dependencies and build output. `.env.example` contains variable names and example values only. Do not add credentials to deployment scripts or logs.

## Cloud organization and contact fields

The Companies navigation entry and page title display **Cloud organizations**. Company IDs and relationships remain stable. Imports initialize an organization's email from the API's current creator identity and fill existing blank emails. They never overwrite a non-empty email. A missing or invalid creator email stays empty. Account linking can change the creator reference, so this is not a historical registration-email guarantee.

Contacts expose `registration_source` with `Cloud`, `GitHub`, or `Cloud + GitHub`, derived from imported identities that reference the same contact. Imports preserve the manually maintained `discord` and `notion_document` fields. A GitHub username alone does not prove a Cloud identity; cross-source merges require reliable identity evidence.

The current Backoffice `/billing/usage` contract supplies organization/currency aggregates, settled amounts and invoice counts. It does not supply subscription IDs, plans, subscription status, billing periods, individual order IDs or payment state. These aggregates cannot establish actual subscribed orders. Deals therefore remain signup opportunities pending a subscription/order data source; do not relabel them as paid subscriptions.

## Organization detail and source visibility

Contacts have **All**, **Github Opensource**, and **Cloud** tabs. Filtering runs on the server before pagination. A contact with both source IDs appears in both source tabs and once in All. The selected tab is kept in the URL. Search and facet counts use the same source filter.

Organization details use the full panel width with responsive property columns. The header shows Cloud member/Box counts and organization creation date instead of sales pipeline totals. Empty fields show a dash; editing placeholders are never presented as source data. The organization creation column supports ascending and descending sorting across all pages, with missing dates last.

The `linear_url` URL field is manually editable and preserved by sync. A valid HTTPS Linear link enables **Open Linear** in the header. The current Backoffice response has no Linear mapping, so no link is fabricated. Discord and Notion fields are also manual.

Cloud sync imports the organization directory before fetching members. A failing member endpoint does not block later organizations. Per-organization daily checkpoints resume incomplete work without repeating successful organizations. The member status field reports incomplete runs; retries follow the same fifteen-minute policy. Old daily checkpoints are removed after seven days. Organization counts and dates refresh on each run.

The billing job reads `/v1/billing/usage` using a fixed UTC month-to-date snapshot and follows its cursor. `Settled usage this month` keeps currencies separate and converts minor units with each currency's exponent, without floating point rounding. `Usage window (UTC)` and `Usage synced at` show the coverage and freshness. Missing aggregate rows display **No settled usage reported**, never a fabricated zero. Failed fetches preserve the last successful values and timestamps. Settlement can be delayed; the API declares coverage unknown. These totals are not complete real-time usage. This is settled consumption, not current wallet balance, cash payment, subscription revenue or a Deal value. Wallet balances and actual subscription orders require additional Backoffice endpoints.

GitHub restricts Stargazer listings to repository admins and collaborators under its July 2026 access policy. Configure a dedicated `GITHUB_TOKEN` that covers `boxlite-ai/boxlite` and satisfies the current endpoint permissions. Check repository selection and organization approval when GitHub returns `403 Resource not accessible by personal access token`; a token alone does not establish access. See [GitHub Stargazers documentation](https://docs.github.com/en/rest/activity/starring#list-stargazers). Store the token in the private root `.env`, upload the environment, and restart sync. Never copy a personal GitHub CLI token into the server. A failed source remains FAILED in `importRun` and does not block other sources.

Better Auth 1.7 uses `/api/auth/callback/slack` for the Slack OAuth redirect. Update the Slack application redirect allow-list when enabling this optional integration.

## Pause GitHub imports

`GITHUB_SYNC_ENABLED=false` disables GitHub imports, including `sync --force`. The dev deployment currently uses this setting at the user's request. Cloud and billing jobs continue on their existing daily schedule. Existing contacts and the GitHub tab remain available. To resume, set `GITHUB_SYNC_ENABLED=true` after confirming token access, upload the private environment and restart the sync worker.

## Personal columns and organization favorites

The Contacts navigation, page and organization tab now display **Inbound users**. Routes and API entity names stay compatible. Chat is hidden from the primary navigation and Slack settings entry point.

The Columns menu on Cloud organizations and Inbound users saves visibility automatically to `userTablePreference`, keyed by authenticated user and table. Settings persist across devices and sessions. Field definitions remain workspace-wide; each user's visible-column choices are separate. Users who share the temporary admin login share its preferences.

Each organization row has a personal Favorite star. **My favorites** filters the current user's organizations on the server, before pagination, and applies the same scope to facet counts. Favorites use the authenticated session user; clients cannot choose another user ID. Unfavoriting does not change another user's favorites. Organization and user deletion cascade to their saved favorites.

Organization inbound-user counts open the linked-user tab. Linked names are explicit keyboard-accessible buttons that open the user record. An organization whose Cloud members have not been imported yet shows a pending-sync explanation instead of implying it has no members.

## Yesterday's Cloud overview

The home page replaces sales pipeline charts, deals-in-progress and overdue-task widgets with two Cloud metrics and an Inbound users table. A Cloud user means an organization. Yesterday is the half-open calendar day `[00:00, next 00:00)` in Asia/Shanghai. The denominator is organizations created in that window; the numerator is those organizations with evidence of a Box created in the same window.

The `overview` import runs before other imports at 08:00 Asia/Shanghai and stores a daily `cloudDailyOverview` snapshot. It fetches organization details and all member pages for yesterday's organizations first. The Inbound users list joins those member IDs to imported contacts, deduplicates contacts across organizations and lists their matching organizations. CRM import timestamps never determine this cohort. Archived contacts are excluded. Pagination is server-side.

Backoffice documents an optional latest retained Box creation time, not a full creation-event history. Requests explicitly include `include=activation`; an omitted or null activation value leaves activity unknown and never blocks member imports. A latest creation within yesterday proves activation. A later creation leaves yesterday's activity unknown unless a prior daily snapshot established it. For newly created organizations only, positive compute/storage allocation in yesterday's `/v1/usage` window supplies additional evidence of same-day Box use. Missing usage is never treated as inactivity. Usage pagination must finish before that evidence is applied. Unknown organizations are reported explicitly and the UI shows a lower-bound percentage instead of claiming an exact rate. A zero denominator displays a dash, and unavailable snapshots display pending data rather than fabricated zeros. Partial member fetches are retried while preserving earlier membership evidence.

## Cloud costs, range filters and reporting windows

Cloud organizations places **Settled usage this month**, Cloud boxes and the Cloud creation date next to the organization name. Amounts retain their currencies. Backoffice has no wallet-balance endpoint. Settlement measures discounted usage invoices, not payments, credit balance or subscription orders. Missing amounts remain unknown. The daily billing import also stores an exact Decimal USD amount in `cloud_settled_usage_usd` for numeric filtering; non-USD amounts are never converted or added to USD. Missing USD rows remove the numeric field rather than write zero.

The Filters menu supports minimum/maximum numeric ranges and inclusive calendar-date ranges. Dates use Asia/Shanghai. Multiple fields combine with AND before pagination. Owner, source and favorite filters still combine with these conditions. The URL and saved views retain all ranges. Admin field settings can enable filters for NUMBER and DATE fields. Invalid, duplicate and reversed range bounds fail validation.

**Assigned to me** selects the authenticated user's Owner filter on both organizations and Inbound users. Existing ownership assignment controls remain the source of responsibility. Shared admin sessions share the same identity. Sales opportunity counts are omitted from the organization table and Columns menu. The internal open-opportunity count covers non-archived opportunities in NEW_SIGNUP, DEMO_BOOKED, QUALIFIED_TO_BUY, DECISION_MAKER_BOUGHT_IN or CONTRACT_SENT. Cloud membership imports create NEW_SIGNUP opportunities; those rows do not establish a purchase.

Cloud overview supports Yesterday, Last 7 days and Last 15 days, ending at today's Shanghai midnight. The numerator describes cohort organizations with evidence of Box creation within the selected window, not necessarily their first registration day. Each window has an independent report key (`start-date` for one day; `start-date:days` for longer windows). The directory uses fixed `createdFrom` and `createdTo` filters with complete pagination and organization-ID deduplication. Counts represent organizations still available from the source when collected.

Yesterday's cohort receives priority detail/member refreshes; `include=activation` explicitly requests optional retained Box activity. Longer windows join existing Cloud membership import identities, including users whose primary CRM organization differs. The API joins newly synced memberships on each read, so ongoing Cloud backfill becomes visible without waiting for the next overview job. The page reports membership gaps against source member counts. This is the set of imported CRM relationships, not an immutable membership census.

Complete window usage queries supply positive activity evidence only. Null retained timestamps, missing resource rows and later Box creation cannot prove inactivity. Percentages remain lower bounds while any organization is unconfirmed. Detail and usage failures never become zero activity. The source client spaces requests globally within its process; priority detail requests use at most two concurrent workers.

The organization table removes CRM Created date from its columns and defaults to descending Cloud organization creation time. Internal `createdAt` remains available for persistence and auditing. Existing saved views remain compatible.

## Organization display cleanup and recent memberships

The organization table and Columns menu omit sales opportunity counts. The Cloud registration field displays **Registered at** in the table, filters and details; its stable key remains `cloud_registered_at`. Missing settled usage is stored as a missing value and displays a dash, never zero. The upgrade clears the old `No settled usage reported` placeholder values without changing recorded amounts.

Cloud still imports the organization directory before members. Member processing now traverses the creation-ordered directory in reverse, prioritizing recent organizations while retaining per-day checkpoints. A directory row can exist before its members finish importing. The detail page describes this pending state. A targeted member refresh resolves a specific waiting organization without waiting for historical backfill.

## Linear customer issues and source-managed fields

Set optional `LINEAR_API_KEY` and `LINEAR_WORKSPACE_SLUG=polygala` in the private root `.env`, then restart the API. Keep the key out of the browser and source archive. Linear uses the personal key directly in the Authorization header. No Linear mutations are sent.

Each organization has a **Linear issue** tab. Search the paginated customer directory and select one customer, or enter its UUID or customer URL. The API validates the configured workspace before saving the binding. Linking a different customer replaces the CRM binding. Unlinking removes the CRM binding and its Linear URL; it never deletes a Linear customer. The tab fetches linked issues through Customer requests, follows pagination and deduplicates issue IDs. Project-only requests are excluded. Fetch failures display an error instead of an empty list. Refresh issues fetches current data.

Cloud and GitHub source fields, registration source and bound Linear customer identifiers are read-only. Record value APIs reject edits, including mixed payloads. Field settings allow display changes but reject source type/agent changes, archival and deletion. Sync continues to write source values directly. Human-maintained Discord, Notion and generic Linear URL fields remain editable.
