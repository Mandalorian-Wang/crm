# Linked user notes and organization assignment

## Release

- App: https://internal-crm.dev.boxliteapp.com/boxlite
- Sandbox: uTE4Z8Pj1LM7, port 8080.
- Application version: ee4d3c8. Initial implementation: c58108b.
- Database: existing Neon production project steep-frost-79122866.
- Migration: 20261118120000_registration_source_override.
- Backup before migration: /root/crm-before-user-notes-20261118.dump, mode 0600.

## Behavior

An empty organization Daily note tab reads linked inbound-user notes.
Notes retain their contact attribution, author, event time, and original storage.
The list supports older-page loading, loading states, failures, and retry.
An organization with its own Daily notes shows those notes instead.
No source notes are copied or removed.

Inbound users gains a Without organization shortcut for records without a primary organization.
A visible bulk Link to organization action previews selected users and requires a destination.
Individual user headers expose the same linking dialog.
The API rejects archived destination organizations and skips archived users.
Cloud membership is separate from the editable primary organization.

Registration source accepts custom text and clearing through UI and MCP.
Contact.registrationSourceManual records manual ownership of this value.
The importer locks the contact before checking this flag.
Manual edits lock the same contact before writing the field.
This ordering prevents concurrent imports from overwriting manual changes.
Untouched records continue automatic source detection.
Other source-managed fields remain read-only.

## Verification

- API, app, and sync type checks: exit 0.
- API build: exit 0.
- Local Next build and final Linux sandbox Next build: exit 0.
- Targeted tests: 10 pass, 0 fail, 35 assertions.
- Changed-file Biome checks: pass.
- Browser: password sign-in, missing-organization filter, two-user bulk link and success readback.
- Browser: inherited note body, timestamp, author, source link, and source navigation.
- Browser: source edited to Conference referral; reload preserves the value.
- Browser: organization note creation replaces the fallback view.
- API readback: original inbound note remains intact.
- MCP: association, source persistence, inherited notes, editable metadata, protected Cloud ID, and clearing pass.
- Real importMember execution: manual Partner referral survives; untouched source becomes Cloud.
- Repeated importMember execution: manually cleared source remains empty.
- Test scope: one QA organization, two QA users, and their synthetic deals only.
- Test records are archived after verification. Original customer data is unchanged by these tests.

The mocked unit suite uses a deliberately unreachable test URL. It does not connect to production:

```sh
TEST_DATABASE_URL=postgresql://test:test@127.0.0.1:1/crm_test bun test --tsconfig-override apps/api/tsconfig.json apps/api/test/linked-user-notes.spec.ts apps/api/test/sales-workflows.spec.ts apps/api/test/crm-mcp-guidance.spec.ts
```

The full destructive integration suite is not run against production.
Native Codex MCP tool loading is not claimed. Live protocol checks use the MCP SDK and the saved private key.

## Issues

1. RISK — The existing Next.js version emits a security upgrade warning on the initial local build.
   Fix: framework security upgrade remains separate. The retry and final sandbox build pass.
