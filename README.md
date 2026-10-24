# HCG WAY — Editorial UI

React + Vite frontend for the existing HCG WAY engineering tools. Hash routes cover account access, the tool workspace, Bid evaluations, and Proactive/Retroactive productivity analysis. The editorial interface uses a lake backdrop and translucent public pages, with solid reading surfaces for assessments and tables.

## Access and sessions

Every tool route waits for a successful server session verification before opening. Cached user details or JWT claims never grant access. Session changes synchronize across tabs, expiration closes an open tool, and changing accounts remounts editors so another account cannot inherit a draft. Verification responses from an earlier session cannot overwrite or sign out a newer session.

Navigation, focus, and page restoration recheck the session. While rechecking, an already verified editor is hidden and inert without discarding its unsaved inputs. A temporary verification failure stays closed and offers retry; rejected or expired credentials return to sign-in. Server endpoints separately enforce authentication and project ownership.

## Admin console

Administrators have a visible **Admin** navigation entry at `/#/admin`. The read-only overview shows both tools' saved projects, owners and update times, with project/owner search, a tool filter, and links to open projects in their existing editors. Counts come from the verified project lists. Loading failures and denied access hide project information and offer retry; account changes cancel earlier requests and clear the previous overview.

`GET /api/admin/overview` authenticates the session and checks the account's **current role in the database** before reading project metadata. A cached administrator role or an old token cannot grant this endpoint access after demotion. Public registration always creates a regular `user` account; the console has no account-role editing capability. Its route exposes neither passwords nor answer documents or weekly inputs.

Install `backend-compat/admin-overview-service.cjs` through `backend-compat/patch-admin-backend.cjs` before publishing the Admin frontend. The patcher requires the Productivity v2 patch and matching `productivity-v2-service.cjs` / `productivity-v2-model.cjs` helpers already installed next to the existing server. It defaults to a dry-run; applying requires `--apply --backup-dir=/private/external/directory` with an existing private backup directory outside the backend source (mode `0700`). It installs the Admin helper and atomically patches the server, without changing the database schema or restarting the process. Check syntax, restart the same backend service, and verify administrator success plus regular-user rejection before releasing the frontend.

## Bid evaluations

New evaluations use all **62 questions across nine collapsible sections**, with default weights transcribed from the original Bid workbook’s C column. The first section opens initially; Expand all and Collapse all are also available. Collapsing a section never changes its answers or score.

- Each question has mutually exclusive circular Yes/No toggle buttons. Selecting the same answer again clears it; an unanswered question counts as zero.
- Selecting Yes loads the positive default weight; No loads the negative default. Switching answers restores that answer’s signed default.
- The existing minus/plus controls adjust the signed value by one, including across zero. Default restores the selected answer’s signed default. Unanswered values cannot be adjusted.
- Every selected question contributes its actual assigned value. No automatic bid/no-bid recommendation or decision threshold is defined.

The answers JSON includes `__hcg_bid.version`. New records use version 2. Earlier records without metadata retain version 1 and the original 16-question method. Loading an earlier record preserves its saved score and values; editing continues to use the earlier Yes-only calculation. Earlier records are never silently expanded or converted. Invalid, incomplete, inconsistent, or unsupported version-2 data blocks editing and saving.

Save/load requests are scoped to the active evaluation and cancelled or ignored when navigation makes them stale. Saving locks editing and prevents duplicate submissions. Errors remain visible without navigating away.

## Productivity analysis

The calculator and reference table share a catalog of all **19 factors and 57 severity coefficients** transcribed from `ProductivityV1.6.xlsm`, including Turnover, negative Second Shift values, and fractional percentages such as Owner-Furnished Items at 4.3%. Source workbooks were inspected without executing VBA. Static, independent fixtures record source cells and sample results; the private workbooks are not part of this repository.

Proactive and Retroactive retain **separate inputs**, as in the workbook. Each project has a common duration of 1–52 weeks, while each method retains its own planned hours, change hours, selected factors, and all 19 raw factor arrays. Removing a factor from the calculation preserves its inputs for later use. Percentage entry uses human units (`22` means 22%); storage and calculation retain unrounded fractions.

For each week, revised hours `H = planned + change`, and `F` is the sum of selected factors. Proactive loss is `H × F`; Retroactive loss is `H − H / (1 + F)`. Totals sum the raw weekly results. Negative values retain the source formula behavior; Retroactive `F = −1` is rejected because its denominator is zero. Display rounding is not written back into saved data.

Both methods save in a single backend transaction with a revision check. Loading an earlier three-factor project copies its inputs into both methods without writing anything. Its first v2 save checks a fingerprint of the old inputs before importing; subsequent saves require the latest revision. Earlier browser versions cannot overwrite an imported v2 project. Old database rows remain as the pre-import recovery snapshot.

Project/account changes cancel stale loads. Unsaved drafts, including unfinished numeric input, are retained while switching methods. A navigation warning protects drafts when leaving the project; sign-out and browser-close warnings are also installed. Invalid or failed loads cannot be edited or saved as empty data. Reset affects only the active method and keeps the project's actual duration. Extending duration preserves inputs; shortening is blocked if either method contains nonzero data in the removed weeks, including hidden factors.

## Development and checks

```sh
npm ci
npm run dev
npm run check
```

The development server proxies `/api` to the existing backend on `localhost:8080`; it does not start a backend or database. Keep credentials outside source control.

`npm run check` runs ESLint, model/compatibility regression tests, and the production build. Bid fixtures cover all 62 questions, their weights, four answer states, the workbook's saved sample, and signed manual overrides. Productivity fixtures cover every catalog coefficient and every week of the original sample: Proactive 1958 and Retroactive 1492.760192390018. Additional tests exercise mode independence, all 19 factors across 52 weeks, raw precision, incomplete/corrupt data, reset/resize behavior, concurrent revisions, transaction failures, legacy import races, and schema validation.

Tests normally use self-contained fixtures and a mock database. Optional integration tests patch a locally supplied original server in memory and exercise its real Express/authentication/legacy routes against the isolated mock database:

```sh
HCG_BACKEND_SOURCE=/absolute/private/path/server.js npm run check
```

Without that private source, only those integration cases are explicitly skipped. They do not connect to the production database. `HCG_TEST_TCP=1` opts into a local HTTP listener where binding is permitted; the default transport avoids opening a port.

## Deployment

Deploy the matching [backend compatibility guards](backend-compat/README.md) **before** the version-2 frontend. Bid uses the existing JSON answers and signed integer score columns. Productivity requires one additive JSON-document table; the schema utility performs a strict dry-run before any explicit creation. It never alters or drops earlier tables. Authentication and ownership checks remain in place.

Build locally rather than on the small production instance:

```sh
npm run build
gzip -k -6 dist/assets/*.js dist/assets/*.css
```

Back up the backend, database, and frontend before release. Install hashed assets before atomically replacing `index.html`; retain earlier assets for open browser tabs and rollback. Preserve the existing Nginx `/api` proxy and HTTPS configuration. Hashed assets may use long-lived immutable caching; HTML must revalidate and authenticated API responses must not be publicly cached.

Tool pages are loaded on demand. Font declarations use `font-display: swap` with system fallbacks. Precompressed gzip assets require the matching Nginx configuration and retain their original identity files.

## Validation and remaining limits

The earlier Bid v2 deployment passed model and route tests. Browser checks covered all nine sections, all 62 controls, default/override scoring, clearing a selection, keyboard expansion, and 320px/390px layouts without horizontal overflow. A clearly labelled production QA record saved all 62 No answers at −149 and retained them after reopening and refreshing.

The current source includes the coordinated Productivity v2 frontend/backend implementation and regression tests. A passing build or mock-database test is not evidence of a completed production deployment, browser acceptance, or support for 25 concurrent users. Record those release checks separately when performed.

The Bid workbook defines no bid/no-bid threshold. Some risk-worded questions still assign positive values for Yes; source parity does not establish that a higher total always means a better project. Blank/toggle behavior and restoring an answer's signed default are deliberate web interactions rather than a reproduction of every VBA side effect. The Productivity page uses sequential week labels; arbitrary workbook column labels and Excel-specific buttons/macros are not reproduced.
