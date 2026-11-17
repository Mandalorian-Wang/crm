# CRM MCP daily maintenance audit

## Deployment

- API commit: `9ab162d`, deployed to sandbox `uTE4Z8Pj1LM7`.
- Frontend remains at its prior deployed build. No UI changes or database migration.
- MCP endpoint: `https://internal-crm.dev.boxliteapp.com/api/mcp/crm`.

## Improvements

1. `crm_describe` returns current field definitions, option IDs, read-only flags, filterability and operation guidance.
2. MCP rejects unknown input properties before Zod can silently strip them.
3. MCP rejects unknown and non-filterable filter fields, and SELECT labels used instead of option IDs.
4. Organization and contact lists accept `fieldKeys`. Filtered fields are included automatically.
5. Guidance covers AND/OR semantics, Shanghai date boundaries, numeric ranges, owner identity, pagination and note retry/version handling.

## Verification

Real MCP SDK calls authenticate through the user-level Codex configuration. The key is never embedded in source or output. Each supported operation is described before use.

- First live pass: 21 checks pass. Covers organization/contact creation, updates, owner propagation, existing type assignment, custom field definition/value updates, note append idempotency, note updates, stale-version rejection, source-field protection, input rejection, archive and restore.
- Second pass: four checks pass for custom field restore, dictionary create/update/archive and inbound meeting notes. A combined-filter assertion identifies missing values from fields hidden in UI tables.
- The missing-values issue is fixed with explicit field projection and automatic inclusion of filtered fields.
- Final pass: seven checks pass. Covers AND filtering across Box count, settled usage and registration date, hidden field projection, live field metadata, identity-specific guidance, unknown projection rejection and permanent-deletion exclusion.
- Combined-filter result: 30 organizations. All returned rows satisfy the three predicates.
- Four focused unit tests pass with nine assertions. API and app type checks pass. API production build passes.
- The database integration suite is extended for unknown properties and filter keys. That suite is not rerun in this task; real public-endpoint checks provide integration evidence.
- Shanghai note freeze logic remains unchanged. This audit checks stale-version rejection; it does not simulate a midnight rollover.

Only explicitly named QA records are written. QA organization, contact, field definition and dictionary option are archived after verification. No permanent deletion is used.

## Local Codex setup

The user-level config preserves previous settings, stores the CRM header, and uses mode 0600. The downloaded credential is removed only after verifying the saved config. Codex CLI parses the enabled server. The active desktop conversation does not hot-load its tools; a new conversation or application restart is still required for native tool access.
