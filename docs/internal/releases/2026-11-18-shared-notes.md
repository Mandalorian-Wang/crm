# Shared notes interaction

Organization Daily note now uses the same composer frame and date-grouped timeline as Inbound user Notes.

- Compact footer contains image attachment and submission actions.
- Cmd/Ctrl+Enter submits a note. Mention selection consumes Enter before submission.
- Clipboard images, dropped images and file selection use the existing image validation.
- Thumbnails open a preview dialog. Draft attachments can be removed.
- Same-day edits stay inline. Historical notes show a lock with a timestamp-rule tooltip.
- Last updater and update time remain visible. Shanghai date grouping matches the freeze boundary.
- Inbound activity types and existing note data remain unchanged.

No schema, API, credential or database migration changes.

## Verification

- App and shared UI TypeScript checks pass.
- Biome passes for the six changed app components. Repository configuration excludes shared UI components from Biome.
- Local production build passes on retry. Next.js reports an existing security advisory.
- Linux sandbox production build exits 0. Deployed application commit: `e8772b1`.
- Browser verifies team-member autocomplete, clipboard image input, Cmd/Ctrl+Enter submission, persisted image and mention after reload.
- Browser verifies thumbnail preview, inline edits, attachment removal and persisted changes after reload.
- Inbound Meeting entry creation and reload succeed through the shared composer.
- Temporary QA contact and organization are archived and purged. QA session signs out.
- API, web, sync and nginx report RUNNING. Health returns `{"status":"ok","database":"up"}`.
- No full repository test suite ran. Freeze and version checks remain unchanged on the server.
