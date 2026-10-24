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

## Validation

Production build, whitespace checks, and lint checks on the rewritten shell/login/navigation components pass. Static comparison confirmed the bid question file is unchanged, five productivity calculation/data definitions match the original syntax trees, and six productivity API calls retain their original contracts.

The user started the separate local review launcher. Desktop and 320px login layouts, registration-mode switching, test sign-in and sign-out, bid creation, manual scoring, saving, and reloading the saved answers were verified in the browser. The test evaluation had a Yes answer with an assigned value of +1, which remained +1 after refresh and reopening. These checks used an in-memory test API outside this repository, which is not included in the production bundle. Production database persistence and the full productivity save flow have not been re-tested. The preview does not connect to production services or real project records; public Google Fonts are still loaded.

After deployment, the public HTTPS entry page and its assets returned 200 with the expected SHA-256 checksums. API health reported a connected database, unauthenticated bid access returned 401, and HTTP redirected to HTTPS. Browser checks confirmed the new login page, an existing authenticated workspace, saved bid answers, and the productivity project library loaded successfully. Both tool headings had identical computed styles. These production checks were read-only; no new production record was created or edited. This validation does not establish capacity for 25 concurrent users.

## Loading performance

The performance update keeps Home/Login eager and loads six tool pages on demand through a stable Suspense boundary. Providers, authentication and saved project calculations are unchanged. The original DM Sans variable font declarations now live in the application CSS, avoiding a render-blocking Google Fonts stylesheet request; font files still come from Google with `font-display: swap` and system fallbacks.

Before the update, the entry JavaScript and CSS were sent uncompressed: 581,546 bytes combined. The optimized entry pair is served as 112,762 gzip bytes, a reduction of 80.6%; this is the entry pair, not the entire page. Hashed assets now use long-lived caching, with precompressed gzip and a dynamic gzip fallback for text assets. Neither API caching nor database memory settings were changed.

A read-only browser measurement on the normal current network recorded 552 ms first contentful paint and 568 ms largest contentful paint after the new entry assets were downloaded. The font was already cached, so this is not a fully cold-cache or throttled-network benchmark and does not promise subsecond loading for every visitor. After deployment, all 16 non-gzip release files matched their expected decoded hashes over HTTPS; gzip and identity responses, Vary, cache headers, missing-asset 404 behavior, database health, and authenticated bid/productivity routes were verified. No production records were written.
