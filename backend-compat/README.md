# Bid scoring compatibility guard

This directory contains a small compatibility patch for the existing Express/MySQL backend. It does not contain database configuration, credentials, project records, or a replacement server.

Deploy the guard before publishing the version-2 frontend. It preserves existing legacy writes, validates complete 62-question version-2 payloads and their score, blocks old clients from overwriting a version-2 record, and rejects in-place conversion of an earlier record. Existing authentication and ownership checks remain ahead of the update guard. Manual signed adjustments are allowed.

`patch-backend.cjs` accepts the path to the existing backend's `server.js`. By default it only prints a dry-run result and checks that the expected route anchors match. `--apply` writes a private original-server backup, installs the helper next to the server, and atomically replaces the server file. It never restarts the process. It supports the existing ESM server and an equivalent CommonJS server.

Before applying, back up the existing backend and database, review the dry-run result, and verify the source matches the expected application. After applying, check JavaScript syntax, restart the same backend process, and verify API/database health. Restore the private backup if health fails. No table migration is required for the inspected database: answers is JSON and total_score is a signed INT.

`npm test` includes portable frontend-to-guard contract tests. An additional deployment check exercised the actual application's authentication and Bid routes over a test HTTP server with an isolated in-memory database; it is not part of this frontend source package and must not be confused with a production-database test.
