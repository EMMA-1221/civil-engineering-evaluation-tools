# HCG WAY — Editorial UI

React + Vite frontend for the existing HCG WAY engineering tools. Hash routes cover account access, the tool workspace, Bid evaluations, and Proactive/Retroactive productivity analysis. The editorial interface uses a lake backdrop and translucent public pages, with solid reading surfaces for assessments and tables.

## Bid evaluations

New evaluations use all **62 questions across nine collapsible sections**, with default weights transcribed from the original Bid workbook’s C column. The first section opens initially; Expand all and Collapse all are also available. Collapsing a section never changes its answers or score.

- Each question has mutually exclusive circular Yes/No toggle buttons. Selecting the same answer again clears it; an unanswered question counts as zero.
- Selecting Yes loads the positive default weight; No loads the negative default. Switching answers restores that answer’s signed default.
- The existing minus/plus controls adjust the signed value by one, including across zero. Default restores the selected answer’s signed default. Unanswered values cannot be adjusted.
- Every selected question contributes its actual assigned value. No automatic bid/no-bid recommendation or decision threshold is defined.

The answers JSON includes `__hcg_bid.version`. New records use version 2. Earlier records without metadata retain version 1 and the original 16-question method. Loading an earlier record preserves its saved score and values; editing continues to use the earlier Yes-only calculation. Earlier records are never silently expanded or converted. Invalid, incomplete, inconsistent, or unsupported version-2 data blocks editing and saving.

Save/load requests are scoped to the active evaluation and cancelled or ignored when navigation makes them stale. Saving locks editing and prevents duplicate submissions. Errors remain visible without navigating away.

## Development and checks

```sh
npm ci
npm run dev
npm run check
```

The development server proxies `/api` to the existing backend on `localhost:8080`; it does not start a backend or database. Keep credentials outside source control.

`npm run check` runs ESLint, 16 model/compatibility regression tests, and the production build. Tests cover all-Yes +149, all-No −149, unselected zero, signed manual adjustments, clearing and restoring defaults, legacy round trips, malformed data, score consistency, and old-client protection.

## Deployment

Deploy the matching [backend compatibility guard](backend-compat/README.md) **before** the version-2 frontend. It validates new payloads and prevents a browser still running the earlier frontend from overwriting a version-2 record. Existing authentication and ownership checks remain in place. The inspected database already uses JSON answers and a signed integer total, so this change requires no table migration.

Build locally rather than on the small production instance:

```sh
npm run build
gzip -k -6 dist/assets/*.js dist/assets/*.css
```

Back up the backend, database, and frontend before release. Install hashed assets before atomically replacing `index.html`; retain earlier assets for open browser tabs and rollback. Preserve the existing Nginx `/api` proxy and HTTPS configuration. Hashed assets may use long-lived immutable caching; HTML must revalidate and authenticated API responses must not be publicly cached.

Tool pages are loaded on demand. Font declarations use `font-display: swap` with system fallbacks. Precompressed gzip assets require the matching Nginx configuration and retain their original identity files.

## Validation and remaining limits

The version-2 release passed lint, all 16 portable tests, and the production build. A separate deployment test exercised the actual authentication and Bid routes over HTTP with an isolated mock database (10/10 passed). Browser checks covered all nine sections, all 62 controls, default/override scoring, clearing a selection, keyboard expansion, and 320px/390px layouts without horizontal overflow. A clearly labelled production QA record saved all 62 No answers at −149 and retained them after reopening and refreshing. These checks are not a capacity test for 25 concurrent users.

Productivity code is unchanged in this release. Its main Proactive and Retroactive formulas match the source workbook, but the calculation/storage model currently supports only three factor classes rather than the workbook’s 19. The reference table omits Turnover. The audit also identified fixed 14-week reset behavior, stale project-load/save risks, and factor precision/unit issues; those require a separate coordinated frontend/backend change. Do not treat the current productivity tool as a complete reproduction of the workbook.
