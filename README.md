# HCG WAY — Editorial UI

React + Vite frontend for the existing HCG WAY engineering tools. This working copy implements the selected editorial direction: a quiet lake backdrop, restrained typography, translucent public pages, and solid reading surfaces for assessments and tables.

## Development

```sh
npm ci
npm run dev
```

The development server proxies `/api` to the existing backend on `localhost:8080`. It does not start a backend or a database. Keep real credentials out of source control.

```sh
npm run build
gzip -k -6 dist/assets/*.js dist/assets/*.css
```

Deploy only the contents of `dist/` to the existing frontend web root after review. Preserve the existing Nginx `/api` proxy, HTTPS certificate configuration, backend, and database. The editorial UI was deployed to the existing EC2 website on 2026-10-24 UTC, after a recoverable frontend backup and archive/file checksum verification. Assets were installed before an atomic entry-page replacement; old assets were retained. No production backend or project data was changed.

Build locally rather than on the small production instance. The optional gzip step creates precompressed copies for Nginx `gzip_static`; keep the original files for browsers that request identity encoding. Only hashed `/assets/` files receive `Cache-Control: public, max-age=31536000, immutable`. The HTML entry point must keep `no-cache, must-revalidate`; API responses must not be publicly cached.

## Preserved behavior

- Hash routes, including bid creation/editing and both productivity analysis modes.
- Login and registration API payloads and Bearer token authentication.
- Bid questions, default assigned values of zero, manual value changes, and counting only Yes answers.
- Productivity factor data, weekly calculations, and save/load API contracts.

## UI and flow changes

- Rebuilt shared navigation, workspace, sign-in, registration, bid pages, and productivity pages.
- Opening the root URL while signed out now shows the sign-in page; the tool workspace appears after authentication. Removed anonymous Overview navigation and the duplicate sign-in link on the sign-in page.
- Unified account state through the existing authentication context; retained browser storage compatibility for existing tools.
- Preserved the requested route through sign-in. Cancelled stale verification requests to avoid clearing a newer session.
- Removed profile/settings links that had no corresponding page.
- Added responsive layouts, field labels, visible keyboard focus, and non-blocking bid form errors.
- Matched the two workspace tool headings in font family, size, weight, line height and spacing; matched their primary action links and removed the four corner captions.
- Balanced text for reading with a restrained scale: 15px bid list body, 16px assessment questions, 15px assessment column labels, 14px scoring notes and row action text, 13px table headings/dates, and 18px list section headings. Increased table line height and row spacing; kept the existing DM Sans family and large page title. Tool navigation is 14px and the shared tool footer is 12px. Touch inputs retain 16px text.
- Gave the administrator table explicit column widths and switched the list to labeled cards at 1100px. Date labels have more room and stack on phones; assessment questions keep their separate 850px layout breakpoint.
- Both workspace primary links use matching 16px medium text and a darker blue, with 14px subordinate tool descriptions and a 14px secondary link. They remain text links. Bid button text is 15px/14px within compact 43px/35px desktop controls; the original 44px touch minimum is preserved.
- The blank answer option reads “Select…” without changing its empty value. Each factor now states its answer and counting status, such as “Unanswered · not counted” or “Yes · counted in total”; only Yes answers contribute their assigned value, as before.
- Refined the account-page heading using the existing DM Sans family: 500 weight to match field labels, relaxed -0.2px tracking, and 1.28 line height. Desktop/mobile sizes remain 32px/29px, with the existing two-line welcome message, card and controls preserved.
- Added a home-only compact layout for desktop windows at least 1100px wide and at most 900px tall. It reduces header/footer padding, vertical whitespace, hero size and card spacing while preserving the primary-link emphasis. The viewport layout adapts directly; no browser zoom, CSS scaling or page clipping is used. Login and assessment layouts are unaffected, and narrow screens keep their natural scrolling layout.

## Validation

Production build, whitespace checks, and lint checks on the rewritten shell/login/navigation components pass. Static comparison confirmed the bid question file is unchanged, five productivity calculation/data definitions match the original syntax trees, and six productivity API calls retain their original contracts.

The user started the separate local review launcher. Desktop and 320px login layouts, registration-mode switching, test sign-in and sign-out, bid creation, manual scoring, saving, and reloading the saved answers were verified in the browser. The test evaluation had a Yes answer with an assigned value of +1, which remained +1 after refresh and reopening. These checks used an in-memory test API outside this repository, which is not included in the production bundle. Production database persistence and the full productivity save flow have not been re-tested. The preview does not connect to production services or real project records; public Google Fonts are still loaded.

After deployment, the public HTTPS entry page and its assets returned 200 with the expected SHA-256 checksums. API health reported a connected database, unauthenticated bid access returned 401, and HTTP redirected to HTTPS. Browser checks confirmed the new login page, an existing authenticated workspace, saved bid answers, and the productivity project library loaded successfully. Both tool headings had identical computed styles. These production checks were read-only; no new production record was created or edited. This validation does not establish capacity for 25 concurrent users.

The bid readability update was deployed after a fresh recoverable frontend backup. Browser checks confirmed the 16px list body, 14px dates, and 15px View/edit action; the administrator list worked at desktop, 1100px, and 390px widths. All 16 assessment rows fit at desktop and 320px, with no horizontal overflow. Existing saved answers were opened read-only. All 16 non-gzip release files matched their decoded HTTPS checksums; compression, caching, unauthenticated access protection, and database health checks still passed. No backend, database, or Nginx setting was changed for this typography update.

The follow-up clarity update confirmed matching 18px workspace primary links, compact 43px main/35px row buttons with larger text, and 18px assessment questions. Workspace and assessment layouts were checked at desktop and an actual 320px document width without horizontal overflow. In a new, unsaved evaluation, assigning +3 produced total 0 while unanswered, +3 for Yes, and 0 for No or N/A; each displayed counting note matched. The test was discarded without saving a record. The static release was backed up and all 16 decoded HTTPS file hashes, compression/cache behavior, unauthenticated protection, and health checks passed again.

The compact homepage update was checked at actual document viewports of 1512×800, 1366×768 and 1280×720. At each size, document scroll height equaled viewport height and the full tool sheet and footer remained visible. At 320px width, the page retained natural vertical scrolling without horizontal overflow. Tool descriptions computed to 14px and primary links to 18px. The release was backed up and its 16 decoded HTTPS resource hashes, compression/cache behavior and API health checks passed. No business data was changed.

The subsequent restrained typography revision confirmed 16px workspace primary links and assessment questions, 15px table body/main button text, and 14px notes/row-action text. Desktop buttons remained 43px/35px high; the homepage still fit the 1512×800 document viewport, and assessment text at 320px had no horizontal overflow. Existing saved answers were opened read-only. The backed-up static release again passed all 16 decoded HTTPS file hashes and compression/cache/API health checks.

## Loading performance

The performance update keeps Home/Login eager and loads six tool pages on demand through a stable Suspense boundary. Providers, authentication and saved project calculations are unchanged. The original DM Sans variable font declarations now live in the application CSS, avoiding a render-blocking Google Fonts stylesheet request; font files still come from Google with `font-display: swap` and system fallbacks.

Before the update, the entry JavaScript and CSS were sent uncompressed: 581,546 bytes combined. The optimized entry pair is served as 112,762 gzip bytes, a reduction of 80.6%; this is the entry pair, not the entire page. Hashed assets now use long-lived caching, with precompressed gzip and a dynamic gzip fallback for text assets. Neither API caching nor database memory settings were changed.

A read-only browser measurement on the normal current network recorded 552 ms first contentful paint and 568 ms largest contentful paint after the new entry assets were downloaded. The font was already cached, so this is not a fully cold-cache or throttled-network benchmark and does not promise subsecond loading for every visitor. After deployment, all 16 non-gzip release files matched their expected decoded hashes over HTTPS; gzip and identity responses, Vary, cache headers, missing-asset 404 behavior, database health, and authenticated bid/productivity routes were verified. No production records were written.
