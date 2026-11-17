# Evidence-driven sales workflow MCP improvements

## Evidence reviewed

Read-only review of the preceding 14 days includes the latest 60 active-record NOTE activities, 30 contact logs, four organization daily notes, nine personal favorites, recent non-Cloud field values and 12 import runs. These are bounded samples, not total counts.

The latest activity and contact-log samples are primarily one sales account. They show:

- Inbound notes preserve background, verified progress, actual contact time, next steps and source evidence.
- Outreach logs preserve actual sending time and evidence separately from recording time.
- Organization daily notes contain longer interviews and occasional team mentions. Two of the four daily notes are obvious tests.
- Personal favorites mark priority accounts. Type assignment and Linear binding supplement narrative updates.
- Cloud/Billing imports maintain source fields. A running import is not a completed fresh sync.

Account attribution does not establish whether a write came from UI, API or an automated assistant. No customer note content, email address or credential is committed here. Raw review data stays in the ignored local folder with mode 0600.

## Changes

- Add `companies.customerContext` to combine organization details, daily notes, linked inbound notes, paginated outreach history, follow-up state and sync status.
- Add `companies.contactHistory` with cursor pagination and evidence-text search.
- Expose existing `companies.followUp`, `companies.logContact`, `companies.updateFollowUp`, `companies.syncStatus` and `users.setCompanyFavorite` through MCP.
- Add optional request IDs to inbound activity creation. Identical and concurrent retries return one record; changed intent raises a conflict.
- Reject wrong organization/contact associations and activity creation on archived records.
- Include previously unassigned inbound notes after their contact is linked to an organization.
- Reject conflicting retries for contact logs and daily-note appends.
- Add operation guidance for evidence handling, event time, pagination, personal favorite scope and synchronization freshness.

No schema migration or external messaging. Existing frontend remains deployed unchanged.

## Verification

- 23 public MCP workflow checks pass: discoverability, real customer readback, no image base64 in context, combined outreach/inbound history, sync freshness, inbound retry and concurrency, timestamps, wrong associations, contact-event retry conflicts, future contact-time rejection, evidence search/pagination, explicit follow-up, personal favorites, mentions and bounded-history cursors.
- Five additional public MCP checks pass: a scoped QA note dated to the previous day is read-only; correct-version editing fails; historical content remains intact; conflicting append retry fails; a fresh correction appends successfully.
- Eight focused unit tests pass, with 26 assertions.
- API and frontend type checks pass. API production build passes.
- The existing integration suite gains workflow regression assertions. The full database integration suite is not run in this task.
- Two temporary QA organizations and one temporary contact are archived after testing. No real customer data is modified. No permanent deletion is used.
- Four Supervisor services report RUNNING. Health returns database up.

API deployed commit: `630aa06`. Fork target: `Mandalorian-Wang/crm`, `main`.
