# Organization type menu and catalog

## Release

App version: 2961f4e. URL: https://internal-crm.dev.boxliteapp.com/boxlite/companies.

The type menu sizes to its content instead of the short trigger button.
Long labels wrap inside colored tags. Content width stays within the viewport with 8px edge clearance.
Shared components expose opt-in content sizing and wrapping. Other menus keep their existing sizing.

## Catalog

The live dictionary expands from four to fourteen active options.
The four existing option IDs, names, colors, and customer assignments remain unchanged.
Ten new options are added through the authenticated MCP dictionary operation:

| Type | Color |
| --- | --- |
| AI Application | blue |
| Developer Tools | green |
| SaaS Platform | cyan |
| Data & Analytics | purple |
| Cloud Infrastructure | blue |
| Security & Testing | rose |
| Enterprise Internal Team | orange |
| Education & Research | green |
| Consulting & Agency | amber |
| Open Source Project | gray |

These are persisted dictionary data in Neon. They are not hard-coded UI options.
Team members can edit them in Settings → Dictionaries.
No customer is classified automatically by this change.

## Verification

- App type check passes.
- Linux sandbox Next build passes. Web restarts successfully.
- Health check returns status ok and database up.
- Browser reads fourteen active types plus No type.
- All fourteen labels have no horizontal text clipping.
- Menu scrolls when its content exceeds available height.
- A temporary browser-only long unbroken label wraps without data writes.
- At a 375px viewport, the settled long-label menu is 359px wide, from x=8 to x=367.
- Temporary label text is restored before closing the browser task.
- MCP readback verifies all ten additions. Existing options remain intact.
