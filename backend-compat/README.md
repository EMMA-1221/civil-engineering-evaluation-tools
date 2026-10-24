# Backend compatibility guards

This directory contains scoped compatibility patches for the existing Express/MySQL backend. It does not contain database configuration, credentials, project records, or a replacement server. Keep original server backups and database dumps outside the source tree and source archives.

## Bid

Deploy the guard before publishing the version-2 frontend. It preserves existing legacy writes, validates complete 62-question version-2 payloads and their score, blocks old clients from overwriting a version-2 record, and rejects in-place conversion of an earlier record. Existing authentication and ownership checks remain ahead of the update guard. Manual signed adjustments are allowed.

`patch-backend.cjs` accepts the path to the existing backend's `server.js`. By default it only prints a dry-run result and checks that the expected route anchors match. `--apply` writes a private original-server backup, installs the helper next to the server, and atomically replaces the server file. It never restarts the process. It supports the existing ESM server and an equivalent CommonJS server.

Before applying, back up the existing backend and database, review the dry-run result, and verify the source matches the expected application. After applying, check JavaScript syntax, restart the same backend process, and verify API/database health. Restore the private backup if health fails. No table migration is required for the inspected database: answers is JSON and total_score is a signed INT.

`npm test` includes portable frontend-to-guard contract tests. A prior deployment check also exercised the actual application's authentication and Bid routes over HTTP with an isolated mock database; this must not be confused with a production-database test.

## Productivity

The runtime consists of `productivity-v2-model.cjs` and `productivity-v2-service.cjs`. The independent server validator accepts an exact version-2 document, a duration of 1–52 weeks, two complete method inputs, and all 19 factor arrays. It recomputes both totals without display rounding. Separate mode inputs are the frontend default; shared documents are accepted only when the inputs are deeply equal.

`productivity-v2-schema.cjs` exports `prepareProductivityV2Schema(connection, database, options)`. Importing it opens no connection and performs no migration. A call is a dry-run unless `options.allowCreate === true`. Preflight checks the parent table's signed INT ID and InnoDB engine. An existing v2 table must have the reviewed four columns, defaults, primary key, and same-database cascading foreign key. Differences fail explicitly; there is no implicit `ALTER`, blind `IF NOT EXISTS`, or `DROP`.

Only an absent `productivity_loss_v2` table can be created. It holds `project_id` (signed INT primary/foreign key), `revision`, the full JSON `document`, and `updated_at`. Earlier project/week tables and their DECIMAL columns are not modified. This avoids rounding new raw inputs into the earlier columns and preserves pre-import data for recovery.

The API paths below are relative to the existing backend; the production proxy adds `/api`:

| Method | Path | Behavior |
| --- | --- | --- |
| POST | `/productivity-losses-v2` | Creates a project and its initial document atomically; body `{project_name,total_weeks,document?}`. |
| GET | `/productivity-losses/:id/v2` | Returns project, validated document, revision, and legacy status. A legacy response includes a fingerprint and performs no write. |
| PUT | `/productivity-losses/:id/v2` | Saves both methods atomically using `{expectedRevision,document}`. First import also requires `expectedLegacyFingerprint`. |
| DELETE | `/productivity-losses/:id/v2` | Checks owner and expected revision before deleting the project through FK cascades. |

Existing project-list responses retain legacy fields and add the v2 model/revision. V2 duration, totals, and update time are derived from the validated JSON. New v2 projects have no synthetic legacy week rows and remain visible through the inspected LEFT JOIN summary view.

All writes acquire the existing parent project row lock before checking ownership and version/revision. First import rereads old inputs under that lock and compares their fingerprint. Competing saves cannot overwrite a newer revision. Original legacy week, batch, duration, and delete handlers use the same lock and transaction connection; they reject v2 projects with 409. Original detail/summary reads also reject known v2 documents. Authentication and ownership checks run before disclosing version details. Errors and failed commits roll back before a success response is sent.

`patch-productivity-backend.cjs /absolute/server.js` is a dry-run that requires exact source anchors. Applying requires `--apply --backup-dir=/private/external/directory`. It preserves the Bid prefix, connection configuration, parser limits, and server-start tail; it installs the two runtime helpers and atomically replaces the source. It does not create the table or restart the service.

Before applying, verify the current source hash, make fresh private database/backend/frontend backups, verify schema preflight, and run the isolated tests against the exact server source. Create only the reviewed absent table, apply the source patch, check syntax, and restart the same existing service. Verify health/authentication/legacy reads before staging the new frontend. Test real save/reopen, mode independence, stale-revision handling, and navigation before replacing the normal entry page. Do not run unnecessary builds or parallel test workers on a memory-constrained production instance.

If health fails, restore the private source backup and restart the same process. Retain the additive table and all JSON documents. An old backend/UI cannot edit the latest v2 state: old rows are only the pre-import snapshot, and new v2 projects have no old week inputs. Rollback after real v2 use therefore needs a recovery or read-only plan. No automatic table deletion is provided.

Self-contained model, service, schema, and frontend-contract tests run with `npm test`. To additionally exercise the actual original Express/authentication/legacy routes against a mock database, explicitly set `HCG_BACKEND_SOURCE=/absolute/private/server.js`. No private source path is embedded in the tests. Optional `HCG_TEST_TCP=1` uses localhost TCP where permitted; neither transport tests the production database.
