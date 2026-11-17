# Organization acquisition, region and competitor dictionaries

## Release

App and API version: ffe6305. URL: https://internal-crm.dev.boxliteapp.com/boxlite/companies.

Cloud organizations now expose Growth channel (single select), Customer region (single select), and Competitors in use (multiple select). Team members maintain each shared dictionary in Settings → Dictionaries, including names, colors and active status. Customer region records the customer's location, not a Cloud deployment region.

The live catalog starts with 12 acquisition channels and 10 geographic regions. Competitor names are left for the team to configure. Empty competitor selections mean unknown/unrecorded, not a confirmed absence of competitors. No existing customer is automatically classified.

## Data and API

Field keys are growth_channel, customer_region and competitors. Single values use existing option IDs; competitor values use an array of IDs. Empty arrays clear the selection. Writes validate ownership by field and deduplicate IDs. Previously selected inactive options remain readable and may be retained or removed; they cannot be newly selected.

The existing dictionaries.organizationTypes and dictionaries.saveOrganizationType MCP operations accept a key parameter. Omitting it retains organization_type compatibility. Record filters use OR among selected values of one field and AND across different fields. Table cells display labels.

Migrations add the MULTI_SELECT enum, optionIds array and GIN index before inserting the three field definitions. A private sandbox database backup was created before migration. Existing field values and organization types are retained.

## Verification

- DB field and focused MCP/sales workflow tests: 30 passed, 0 failed, 91 assertions.
- API, app, sync and DB type checks passed; API build passed.
- Local and Linux sandbox Next builds passed.
- Authenticated MCP SDK tests passed: single/multiple value persistence, deduplication, combined filters, table labels, invalid IDs, cross-dictionary IDs, single-select array rejection, clear, and inactive-option retention/rejection.
- Browser verified Settings dictionary tabs and acquisition options; changed a single selection and applied two competitor selections, then reloaded and verified persisted values.
- Dedicated QA organization archived and two QA competitor options deactivated after verification.

## Issues

An existing Next security nudge interrupted the first local build; the subsequent local build and sandbox build passed. Framework security upgrade remains a separate outstanding maintenance task. Competitor product names require team configuration.
