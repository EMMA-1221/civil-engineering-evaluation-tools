import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import test from 'node:test';
import { createProductivityDocument } from '../src/productivityDocument.js';

const require = createRequire(import.meta.url);
const service = require('../backend-compat/admin-overview-service.cjs');
const { patchAdminSource } = require('../backend-compat/patch-admin-backend.cjs');
const { ADMIN_USER_SQL, ADMIN_BIDS_SQL, ADMIN_PRODUCTIVITY_SQL } = service;
const date = new Date('2026-10-24T12:34:56Z');
const secretSentinel = 'private-data-that-must-not-be-returned';
const clone = value => structuredClone(value);

class MetadataDatabase {
  constructor() {
    this.users = [{ id: 1, role: 'admin' }, { id: 2, role: 'user' }];
    this.bids = [{ id: 8, user_id: 1, bid_name: 'Example bid', bid_location: 'Madison',
      total_score: '-149', created_at: date, updated_at: date, username: 'Owner', email: 'owner@example.test',
      answers: secretSentinel, password_hash: secretSentinel }];
    this.productivity = [{ project_id: 7, user_id: 2, project_name: 'Example productivity',
      total_weeks: 14, total_proactive_loss: '66.00', total_retroactive_loss: '42.58',
      created_at: date, updated_at: date, username: 'Other owner', email: 'other@example.test',
      description: secretSentinel, notes: secretSentinel }];
    this.v2 = [];
    this.calls = [];
    this.fail = null;
  }
  async query(sql, params) {
    this.calls.push({ sql, params });
    if (this.fail?.(sql)) throw new Error(secretSentinel);
    if (sql === ADMIN_USER_SQL) return [clone(this.users.filter(user => user.id === params[0]))];
    if (sql === ADMIN_BIDS_SQL) return [clone(this.bids)];
    if (sql === ADMIN_PRODUCTIVITY_SQL) return [clone(this.productivity)];
    if (sql.startsWith('SELECT project_id, revision, document, updated_at FROM productivity_loss_v2 WHERE project_id IN')) {
      return [clone(this.v2.filter(row => params.includes(row.project_id)))];
    }
    throw new Error(`Unrecognized query in fixture: ${sql}`);
  }
}

function application(db) {
  let route;
  function authenticateToken(req, res, next) {
    if (!req.authenticated) return res.status(401).json({ msg: 'Missing or invalid test token.' });
    return next();
  }
  service.registerAdminOverviewRoute({ get(url, ...handlers) {
    assert.equal(url, '/admin/overview');
    assert.equal(handlers[0], authenticateToken);
    assert.equal(handlers.length, 2);
    route = handlers;
  } }, { db, authenticateToken });
  return async (overrides = {}) => {
    const req = { authenticated: true, user: { id: 1, role: 'admin' }, body: {}, headers: {}, ...overrides };
    const res = { statusCode: 200, headers: {}, body: undefined,
      status(code) { this.statusCode = code; return this; },
      set(name, value) { this.headers[name.toLowerCase()] = value; return this; },
      json(body) { this.body = body; return this; } };
    await route[0](req, res, () => route[1](req, res));
    return { status: res.statusCode, headers: res.headers, body: res.body };
  };
}

test('admin endpoint runs authentication first and performs no database queries for unauthenticated requests', async () => {
  const db = new MetadataDatabase();
  const response = await application(db)({ authenticated: false, user: { id: 1, role: 'admin' } });
  assert.equal(response.status, 401);
  assert.equal(db.calls.length, 0);
});

test('a missing or malformed authenticated ID cannot query users or projects', async () => {
  const db = new MetadataDatabase(); const request = application(db);
  for (const user of [null, {}, { id: 0 }, { id: -1 }, { id: 1.5 }, { id: '1 OR 1=1' }, { id: [] }]) {
    const response = await request({ user });
    assert.equal(response.status, 401); assert.equal(response.body.code, 'AUTH_REQUIRED');
  }
  assert.equal(db.calls.length, 0);
});

test('ordinary, demoted, deleted and unknown-role accounts cannot read any project metadata despite spoofed admin claims', async () => {
  for (const role of ['user', 'manager', 'ADMIN', 'owner', null, undefined]) {
    const db = new MetadataDatabase(); db.users[1].role = role;
    const response = await application(db)({ user: { id: 2, role: 'admin' },
      body: { role: 'admin', user: { id: 1, role: 'admin' } }, headers: { 'x-role': 'admin' } });
    assert.equal(response.status, 403); assert.equal(response.body.code, 'ADMIN_ACCESS_DENIED');
    assert.equal(response.headers['cache-control'], 'no-store');
    assert.deepEqual(db.calls, [{ sql: ADMIN_USER_SQL, params: [2] }]);
  }
  const missing = new MetadataDatabase();
  assert.equal((await application(missing)({ user: { id: 999, role: 'admin' } })).status, 403);
  assert.equal(missing.calls.length, 1);
});

test('the current database role grants access even when a stale claim says user, and demotion takes effect on the next request', async () => {
  const db = new MetadataDatabase(); const request = application(db);
  assert.equal((await request({ user: { id: 1, role: 'user' } })).status, 200);
  db.users[0].role = 'user'; db.calls = [];
  assert.equal((await request({ user: { id: 1, role: 'admin' } })).status, 403);
  assert.equal(db.calls.length, 1);
});

test('admin overview whitelists metadata, normalizes SQL totals and dates, and exposes no full answers or credentials', async () => {
  const db = new MetadataDatabase();
  const response = await application(db)();
  assert.equal(response.status, 200); assert.equal(response.headers['cache-control'], 'no-store');
  assert.deepEqual(response.body.summary, { bidProjects: 1, productivityProjects: 1, projectOwners: 2 });
  assert.match(response.body.generatedAt, /^\d{4}-\d\d-\d\dT/);
  assert.deepEqual(response.body.bids, [{ id: 8, name: 'Example bid', location: 'Madison',
    owner: { id: 1, username: 'Owner', email: 'owner@example.test' }, createdAt: date.toISOString(), updatedAt: date.toISOString(), totalScore: -149 }]);
  assert.deepEqual(response.body.productivity, [{ id: 7, name: 'Example productivity',
    owner: { id: 2, username: 'Other owner', email: 'other@example.test' }, createdAt: date.toISOString(), updatedAt: date.toISOString(),
    totalWeeks: 14, proactiveLoss: 66, retroactiveLoss: 42.58, modelVersion: 1, revision: 0 }]);
  assert.equal(JSON.stringify(response.body).includes(secretSentinel), false);
  assert.equal(db.calls.some(call => /^(INSERT|UPDATE|DELETE|ALTER|CREATE|DROP|REPLACE)\b/i.test(call.sql)), false);
  assert.equal([ADMIN_USER_SQL, ADMIN_BIDS_SQL, ADMIN_PRODUCTIVITY_SQL].some(sql => /SELECT\s+\*|password|answers|description|notes/i.test(sql)), false);
});

test('overview overlays saved v2 duration, updated timestamp and both exact totals instead of stale legacy fields', async () => {
  const db = new MetadataDatabase(); const document = createProductivityDocument(5);
  document.modes.proactive.selectedFactorIds = ['owner_furnished'];
  document.modes.proactive.planned[0] = 1000; document.modes.proactive.factors.owner_furnished[0] = 0.043;
  document.modes.retroactive.selectedFactorIds = ['second_shift'];
  document.modes.retroactive.planned[0] = 1000; document.modes.retroactive.factors.second_shift[0] = -0.05;
  const updated = new Date('2026-10-25T12:00:00Z');
  db.v2 = [{ project_id: 7, revision: 7, document: JSON.stringify(document), updated_at: updated }];
  const response = await application(db)();
  assert.equal(response.status, 200);
  const row = response.body.productivity[0];
  assert.equal(row.totalWeeks, 5); assert.equal(row.modelVersion, 2); assert.equal(row.revision, 7);
  assert.equal(row.proactiveLoss, 43); assert.equal(row.retroactiveLoss, 1000 - 1000 / 0.95);
  assert.equal(row.updatedAt, updated.toISOString());
  assert.equal('document' in row, false); assert.equal('modes' in row, false);
});

test('no projects, null legacy totals and missing joined owner names are represented without inventing values', async () => {
  const db = new MetadataDatabase(); db.bids = [];
  Object.assign(db.productivity[0], { username: null, email: null, total_weeks: null,
    total_proactive_loss: null, total_retroactive_loss: null, created_at: null, updated_at: null });
  const response = await application(db)();
  assert.equal(response.status, 200);
  assert.deepEqual(response.body.productivity[0].owner, { id: 2, username: null, email: null });
  assert.equal(response.body.productivity[0].proactiveLoss, null); assert.equal(response.body.productivity[0].createdAt, null);
  db.productivity = []; db.calls = [];
  const empty = await application(db)();
  assert.deepEqual(empty.body.summary, { bidProjects: 0, productivityProjects: 0, projectOwners: 0 });
  assert.deepEqual(empty.body.bids, []); assert.deepEqual(empty.body.productivity, []);
  assert.equal(db.calls.length, 3);
});

test('blank legacy names get an explicit safe display fallback without changing saved metadata', async () => {
  const db = new MetadataDatabase();
  db.bids[0].bid_name = '  '; db.productivity[0].project_name = '';
  const response = await application(db)();
  assert.equal(response.status, 200);
  assert.equal(response.body.bids[0].name, 'Untitled project');
  assert.equal(response.body.productivity[0].name, 'Untitled project');
  assert.equal(db.bids[0].bid_name, '  '); assert.equal(db.productivity[0].project_name, '');
});

test('user lookup failures and project/model failures return a generic error, never partial data or sensitive failure text', async () => {
  for (const failed of [ADMIN_USER_SQL, ADMIN_BIDS_SQL, ADMIN_PRODUCTIVITY_SQL, 'v2']) {
    const db = new MetadataDatabase();
    db.fail = sql => failed === 'v2' ? sql.includes('FROM productivity_loss_v2') : sql === failed;
    const response = await application(db)();
    assert.equal(response.status, 500); assert.equal(response.body.code, 'ADMIN_OVERVIEW_FAILED');
    assert.equal(JSON.stringify(response.body).includes(secretSentinel), false);
    assert.equal('bids' in response.body, false);
    if (failed === ADMIN_USER_SQL) assert.equal(db.calls.length, 1);
  }
  for (const corrupt of ['document', 'metadata']) {
    const db = new MetadataDatabase();
    if (corrupt === 'document') db.v2 = [{ project_id: 7, revision: 1, document: '{invalid' }];
    else db.bids[0].total_score = Infinity;
    const response = await application(db)();
    assert.equal(response.status, 500); assert.equal('productivity' in response.body, false);
  }
});

// A synthetic test-only server skeleton keeps this suite independent of private
// deployment configuration and of any audit files outside the public checkout.
const baseSource = `// Test-only authentication and pre-existing route placeholders.
const authenticateToken = (req, res, next) => next();
registerProductivityV2Routes(app, { db, authenticateToken });
app.get('/bids', authenticateToken, originalBidHandler);
app.get('/productivity-losses', authenticateToken, originalProductivityHandler);
// ==================== SERVER START ====================
app.listen(3000);
`;

test('admin source patch touches only its new registration, preserves existing routes, and supports CommonJS and ESM idempotently', () => {
  for (const source of [baseSource, `import express from 'express';\n${baseSource}`]) {
    const result = patchAdminSource(source);
    assert.equal(result.changed, true);
    assert.equal(result.moduleType, source.startsWith('import ') ? 'esm' : 'commonjs');
    const inserted = result.source.slice(0, result.source.indexOf('// HCG_ADMIN_OVERVIEW_V1'));
    const anchor = '// ==================== SERVER START ====================';
    assert.equal(inserted, source.slice(0, source.indexOf(anchor)));
    assert.equal(result.source.slice(result.source.indexOf(anchor)), source.slice(source.indexOf(anchor)));
    assert.equal(patchAdminSource(result.source).changed, false);
    assert.equal(patchAdminSource(result.source).source, result.source);
  }
});

test('admin source patch rejects missing dependencies, duplicate anchors, existing routes and partial or modified patches', () => {
  const patched = patchAdminSource(baseSource).source;
  for (const source of [
    baseSource.replace('registerProductivityV2Routes(app, { db, authenticateToken });', ''),
    baseSource.replace('// ==================== SERVER START ====================', ''),
    `${baseSource}\n// ==================== SERVER START ====================`,
    `${baseSource}\napp.get('/admin/overview', function () {});`,
    `${baseSource}\n// HCG_ADMIN_OVERVIEW_V1`,
    patched.replace('registerAdminOverviewRoute(app, { db, authenticateToken });', ''),
    patched.replace("require('./admin-overview-service.cjs')", "require('./changed.cjs')"),
    `${patched}\napp.get('/admin/overview', function () {});`,
    `${patched}\n// HCG_ADMIN_OVERVIEW_V1`,
  ]) assert.throws(() => patchAdminSource(source));
});

const patchFile = new URL('../backend-compat/patch-admin-backend.cjs', import.meta.url);
const helperNames = ['admin-overview-service.cjs', 'productivity-v2-service.cjs', 'productivity-v2-model.cjs'];
function patchCli(filename, extra = []) {
  return spawnSync(process.execPath, [patchFile.pathname, filename, ...extra], { encoding: 'utf8' });
}

test('patch CLI is read-only by default, requires an external backup on apply, and leaves a private exact original', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hcg-admin-patch-'));
  try {
    const backend = path.join(temp, 'backend'); fs.mkdirSync(backend);
    const backups = path.join(temp, 'backups'); fs.mkdirSync(backups, { mode: 0o700 });
    const filename = path.join(backend, 'server.js'); fs.writeFileSync(filename, baseSource, { mode: 0o640 });
    for (const name of helperNames.slice(1)) fs.copyFileSync(new URL(`../backend-compat/${name}`, import.meta.url), path.join(backend, name));
    const before = fs.readdirSync(backend).sort();
    const dry = patchCli(filename); assert.equal(dry.status, 0, dry.stderr);
    assert.equal(JSON.parse(dry.stdout).mode, 'dry-run'); assert.equal(JSON.parse(dry.stdout).schemaChanged, false);
    assert.equal(fs.readFileSync(filename, 'utf8'), baseSource); assert.deepEqual(fs.readdirSync(backend).sort(), before);
    assert.notEqual(patchCli(filename, ['--apply']).status, 0);
    assert.notEqual(patchCli(filename, ['--apply', `--backup-dir=${backend}`]).status, 0);
    fs.chmodSync(backups, 0o755);
    assert.notEqual(patchCli(filename, ['--apply', `--backup-dir=${backups}`]).status, 0);
    fs.chmodSync(backups, 0o700);
    const applied = patchCli(filename, ['--apply', `--backup-dir=${backups}`]);
    assert.equal(applied.status, 0, applied.stderr); assert.equal(JSON.parse(applied.stdout).restarted, false);
    assert.equal(fs.statSync(filename).mode & 0o777, 0o640);
    const backupFiles = fs.readdirSync(backups); assert.equal(backupFiles.length, 1);
    const backup = path.join(backups, backupFiles[0]);
    assert.equal(fs.readFileSync(backup, 'utf8'), baseSource); assert.equal(fs.statSync(backup).mode & 0o777, 0o600);
    assert.equal(fs.readFileSync(path.join(backend, helperNames[0]), 'utf8'), fs.readFileSync(new URL(`../backend-compat/${helperNames[0]}`, import.meta.url), 'utf8'));
    const repeated = patchCli(filename, ['--apply']); assert.equal(repeated.status, 0, repeated.stderr);
    assert.equal(JSON.parse(repeated.stdout).changed, false); assert.equal(fs.readdirSync(backups).length, 1);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});

test('patch CLI rejects server/helper symlinks and changed runtime dependencies before source mutation', () => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'hcg-admin-refuse-'));
  try {
    const backend = path.join(temp, 'backend'); fs.mkdirSync(backend);
    const backups = path.join(temp, 'backups'); fs.mkdirSync(backups);
    const filename = path.join(backend, 'server.js'); fs.writeFileSync(filename, baseSource);
    const args = ['--apply', `--backup-dir=${backups}`];
    const linked = path.join(backend, 'linked.js'); fs.symlinkSync(filename, linked);
    assert.notEqual(patchCli(linked).status, 0);
    for (const name of helperNames.slice(1)) fs.copyFileSync(new URL(`../backend-compat/${name}`, import.meta.url), path.join(backend, name));
    fs.appendFileSync(path.join(backend, helperNames[1]), '\n// changed\n');
    assert.notEqual(patchCli(filename, args).status, 0);
    assert.equal(fs.readFileSync(filename, 'utf8'), baseSource); assert.equal(fs.readdirSync(backups).length, 0);
    fs.copyFileSync(new URL(`../backend-compat/${helperNames[1]}`, import.meta.url), path.join(backend, helperNames[1]));
    fs.symlinkSync(new URL(`../backend-compat/${helperNames[0]}`, import.meta.url).pathname, path.join(backend, helperNames[0]));
    assert.notEqual(patchCli(filename, args).status, 0); assert.equal(fs.readFileSync(filename, 'utf8'), baseSource);
    assert.equal(fs.readdirSync(backups).length, 0);
  } finally { fs.rmSync(temp, { recursive: true, force: true }); }
});
