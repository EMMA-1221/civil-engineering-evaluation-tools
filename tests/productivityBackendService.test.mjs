import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import http from 'node:http';
import { Duplex } from 'node:stream';
import service from '../backend-compat/productivity-v2-service.cjs';
import patcher from '../backend-compat/patch-productivity-backend.cjs';
import backendModel from '../backend-compat/productivity-v2-model.cjs';
import { createProductivityDocument, serializeProductivityDocument } from '../src/productivityDocument.js';

const clone = value => structuredClone(value);
const owner = { id: 7, role: 'user', username: 'fixture' };
const auth = (req, res, next) => req.user ? next() : res.status(401).json({ msg: 'No token provided' });
const oldWeek = number => ({ week_number: number, planned_work_hours: '1000.00', change_order_hours: '-100.00',
  overmanning: '0.1000', stacking_of_trades: '0.0000', overtime_5_10: '0.0000',
  proactive_loss: '90.00', retroactive_loss: '81.82', notes: null });

class MockPool {
  constructor() {
    this.state = { projects: new Map([
      [1, { id: 1, user_id: 7, project_name: 'AUDIT TEST legacy', total_weeks: 2, total_proactive_loss: '180.00', total_retroactive_loss: '163.64' }],
      [2, { id: 2, user_id: 8, project_name: 'AUDIT TEST other owner', total_weeks: 2 }],
    ]), weeks: new Map([[1, [oldWeek(1), oldWeek(2)]], [2, [oldWeek(1), oldWeek(2)]]]), v2: new Map() };
    this.nextId = 3; this.calls = []; this.events = []; this.locks = new Map();
    this.failCommit = false; this.failSql = null; this.failOccurrence = 1; this.matchCount = 0;
  }
  async getConnection() { return new MockConnection(this); }
  async query(sql, params = []) { return new MockConnection(this, true).query(sql, params); }
  seedV2(id = 1, document = createProductivityDocument(2), revision = 1) {
    this.state.v2.set(id, { project_id: id, revision, document: JSON.stringify(document), updated_at: '2026-10-24T00:00:00Z' });
  }
}

class MockConnection {
  constructor(pool, direct = false) { this.pool = pool; this.direct = direct; this.state = direct ? pool.state : null; this.unlock = null; }
  async beginTransaction() { this.state = clone(this.pool.state); this.pool.events.push('begin'); }
  async commit() {
    this.pool.events.push('commit');
    if (this.pool.failCommit) throw new Error('Injected commit failure');
    this.pool.state = clone(this.state); this.unlock?.(); this.unlock = null;
  }
  async rollback() { this.pool.events.push('rollback'); this.unlock?.(); this.unlock = null; }
  release() { this.pool.events.push('release'); this.unlock?.(); this.unlock = null; }
  async lock(id) {
    const previous = this.pool.locks.get(id) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => { release = resolve; });
    this.pool.locks.set(id, previous.then(() => gate));
    await previous;
    this.state = clone(this.pool.state); this.unlock = release;
    this.pool.events.push(`lock:${id}`);
    await this.pool.onLock?.(id);
  }
  async query(source, params = []) {
    const sql = source.replace(/\s+/g, ' ').trim();
    this.pool.calls.push({ sql, params: clone(params), connection: this });
    if (sql === 'START TRANSACTION READ ONLY') { await this.beginTransaction(); return [[]]; }
    if (!this.state) throw new Error('Mock transaction has not started');
    if (this.pool.failSql?.test(sql) && ++this.pool.matchCount === this.pool.failOccurrence) throw new Error('Injected SQL failure');
    if (/^SELECT .* FROM productivity_loss_projects WHERE id = \?/.test(sql)) {
      const id = Number(params[0]); if (sql.endsWith('FOR UPDATE')) await this.lock(id);
      const row = this.state.projects.get(id); return [row ? [clone(row)] : []];
    }
    if (sql.startsWith('SELECT project_id, revision, document, updated_at FROM productivity_loss_v2 WHERE project_id IN')) {
      return [[...this.state.v2.values()].filter(row => params.includes(row.project_id)).map(clone)];
    }
    if (sql === 'SELECT project_id, revision, document, updated_at FROM productivity_loss_v2 WHERE project_id = ?') {
      const row = this.state.v2.get(Number(params[0])); return [row ? [clone(row)] : []];
    }
    if (/^SELECT .* FROM productivity_loss_weeks WHERE project_id = \? ORDER BY week_number$/.test(sql)) {
      return [clone(this.state.weeks.get(Number(params[0])) || [])];
    }
    if (sql.startsWith('INSERT INTO productivity_loss_projects ')) {
      const id = this.pool.nextId++; const [user_id, project_name, description, total_weeks] = params;
      this.state.projects.set(id, { id, user_id, project_name, description, total_weeks, total_proactive_loss: 0, total_retroactive_loss: 0 });
      return [{ insertId: id }];
    }
    if (sql.startsWith('INSERT INTO productivity_loss_v2 ')) {
      const id = Number(params[0]); if (this.state.v2.has(id)) throw new Error('Duplicate mock v2');
      this.state.v2.set(id, { project_id: id, revision: 1, document: params[1], updated_at: '2026-10-24T01:00:00Z' }); return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('UPDATE productivity_loss_v2 SET ')) {
      const [revision, document, id, expected] = params; const row = this.state.v2.get(id);
      if (!row || row.revision !== expected) return [{ affectedRows: 0 }];
      Object.assign(row, { revision, document, updated_at: '2026-10-24T02:00:00Z' }); return [{ affectedRows: 1 }];
    }
    if (sql === 'DELETE FROM productivity_loss_projects WHERE id = ?') {
      const id = Number(params[0]); this.state.projects.delete(id); this.state.weeks.delete(id); this.state.v2.delete(id); return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('UPDATE productivity_loss_weeks SET ')) {
      const computed = sql.includes('revised_hours = ?');
      const keys = computed ? ['planned_work_hours', 'change_order_hours', 'revised_hours', 'overmanning', 'stacking_of_trades', 'overtime_5_10', 'total_factors', 'proactive_loss', 'retroactive_loss', 'notes']
        : ['planned_work_hours', 'change_order_hours', 'overmanning', 'stacking_of_trades', 'overtime_5_10'];
      // The original single-week route has 10 SET parameters then project/week.
      const actualId = Number(params[keys.length]); const actualWeek = Number(params[keys.length + 1]);
      const actualRow = (this.state.weeks.get(actualId) || []).find(week => Number(week.week_number) === actualWeek);
      if (!actualRow) return [{ affectedRows: 0 }];
      keys.forEach((key, index) => { actualRow[key] = params[index]; }); return [{ affectedRows: 1 }];
    }
    if (sql.startsWith('SELECT SUM(proactive_loss)')) {
      const rows = this.state.weeks.get(Number(params[0])) || [];
      return [[{ total_proactive: rows.reduce((sum, row) => sum + Number(row.proactive_loss || 0), 0),
        total_retroactive: rows.reduce((sum, row) => sum + Number(row.retroactive_loss || 0), 0) }]];
    }
    if (sql.startsWith('UPDATE productivity_loss_projects SET total_proactive_loss')) {
      Object.assign(this.state.projects.get(Number(params[2])), { total_proactive_loss: params[0], total_retroactive_loss: params[1] }); return [{ affectedRows: 1 }];
    }
    if (/^SELECT \* FROM productivity_loss_weeks WHERE project_id = \? AND week_number = \?$/.test(sql)) {
      return [[clone((this.state.weeks.get(Number(params[0])) || []).find(row => Number(row.week_number) === Number(params[1])))]];
    }
    if (sql.includes('FROM v_productivity_loss_summary')) {
      return [[...this.state.projects.values()].filter(project => !sql.includes('WHERE user_id') || project.user_id === params[0])
        .map(project => ({ ...clone(project), project_id: project.id }))];
    }
    throw new Error(`Unexpected mock SQL: ${sql}`);
  }
}

function application(pool) {
  const routes = new Map();
  const app = Object.fromEntries(['get', 'post', 'put', 'delete'].map(method => [method, (route, ...handlers) => routes.set(`${method} ${route}`, handlers)]));
  service.registerProductivityV2Routes(app, { db: pool, authenticateToken: auth });
  return async (method, path, { body = {}, user = owner, id = 1 } = {}) => {
    const handlers = routes.get(`${method} ${path}`); assert.ok(handlers);
    const response = { statusCode: 200, body: undefined, status(value) { this.statusCode = value; return this; }, json(value) { this.body = value; pool.events.push('response'); return this; } };
    const req = { body, user, params: { id: String(id) } };
    let passed = false; handlers[0](req, response, () => { passed = true; });
    if (passed) await handlers[1](req, response);
    return { status: response.statusCode, body: response.body };
  };
}

test('v2 API authenticates and authorizes before examining version or revision', async () => {
  const pool = new MockPool(); pool.seedV2(2, { broken: true }); const request = application(pool);
  assert.equal((await request('get', '/productivity-losses/:id/v2', { user: null })).status, 401);
  assert.equal(pool.calls.length, 0);
  for (const method of ['get', 'put', 'delete']) {
    pool.calls = [];
    const response = await request(method, '/productivity-losses/:id/v2', { id: 2, body: { expectedRevision: 'bad', document: null } });
    assert.equal(response.status, 403);
    assert.equal(pool.calls.some(call => call.sql.includes('FROM productivity_loss_v2')), false);
  }
});

test('legacy GET is read-only; first save requires fresh fingerprint and retains the old rollback inputs', async () => {
  const pool = new MockPool(); const request = application(pool); const before = clone(pool.state);
  const loaded = await request('get', '/productivity-losses/:id/v2');
  assert.equal(loaded.status, 200); assert.equal(loaded.body.revision, 0); assert.equal(loaded.body.isLegacy, true);
  assert.match(loaded.body.legacyFingerprint, /^[0-9a-f]{64}$/); assert.deepEqual(pool.state, before);
  const body = { expectedRevision: 0, document: loaded.body.document };
  assert.equal((await request('put', '/productivity-losses/:id/v2', { body })).status, 409);
  assert.equal(pool.state.v2.size, 0);
  pool.state.weeks.get(1)[0].planned_work_hours = '1234.00';
  assert.equal((await request('put', '/productivity-losses/:id/v2', { body: { ...body, expectedLegacyFingerprint: loaded.body.legacyFingerprint } })).status, 409);
  const refreshed = await request('get', '/productivity-losses/:id/v2');
  const oldProject = clone(pool.state.projects.get(1)); const oldWeeks = clone(pool.state.weeks.get(1));
  const saved = await request('put', '/productivity-losses/:id/v2', { body: { expectedRevision: 0,
    expectedLegacyFingerprint: refreshed.body.legacyFingerprint, document: refreshed.body.document } });
  assert.equal(saved.status, 200); assert.equal(saved.body.revision, 1);
  assert.deepEqual(pool.state.projects.get(1), oldProject); assert.deepEqual(pool.state.weeks.get(1), oldWeeks);
  assert.equal((await request('get', '/productivity-losses/:id/v2')).body.isLegacy, false);
});

test('v2 creation is atomic, defaults to 19 raw arrays and creates no legacy week rows', async () => {
  const pool = new MockPool(); const request = application(pool);
  const created = await request('post', '/productivity-losses-v2', { body: { project_name: 'AUDIT TEST', total_weeks: 52 } });
  assert.equal(created.status, 200); assert.equal(created.body.revision, 1);
  assert.equal(Object.keys(created.body.document.modes.proactive.factors).length, 19);
  assert.equal(created.body.document.totalWeeks, 52); assert.equal(pool.state.weeks.has(created.body.project_id), false);
  const rows = await service.augmentProductivityRows(pool, [{ project_id: created.body.project_id, total_weeks: 52, total_proactive_loss: null, total_retroactive_loss: null }]);
  assert.equal(rows[0].model_version, 2); assert.equal(rows[0].total_proactive_loss, 0);
  const failing = new MockPool(); failing.failSql = /^INSERT INTO productivity_loss_v2 /;
  const failed = await application(failing)('post', '/productivity-losses-v2', { body: { project_name: 'AUDIT TEST' } });
  assert.equal(failed.status, 500); assert.equal(failing.state.projects.size, 2); assert.equal(failing.state.v2.size, 0);
});

test('whole document save recomputes both modes without rounding or changing the old parent duration', async () => {
  const pool = new MockPool(); pool.seedV2(); const request = application(pool);
  const document = createProductivityDocument(3);
  document.modes.proactive.selectedFactorIds = ['owner_furnished'];
  document.modes.proactive.planned[0] = 1000; document.modes.proactive.factors.owner_furnished[0] = 0.043;
  document.modes.retroactive.selectedFactorIds = ['second_shift'];
  document.modes.retroactive.planned[0] = 1000; document.modes.retroactive.factors.second_shift[0] = -0.05;
  const response = await request('put', '/productivity-losses/:id/v2', { body: { expectedRevision: 1, document } });
  assert.equal(response.status, 200); assert.equal(response.body.revision, 2);
  assert.equal(response.body.project.total_weeks, 3); assert.equal(pool.state.projects.get(1).total_weeks, 2);
  assert.equal(response.body.project.total_proactive_loss, 43);
  assert.equal(response.body.project.total_retroactive_loss, 1000 - 1000 / 0.95);
  assert.deepEqual(response.body.document, document);
  const loaded = await request('get', '/productivity-losses/:id/v2');
  assert.deepEqual(loaded.body.document, document); assert.equal(loaded.body.revision, 2);
  const listed = await service.augmentProductivityRows(pool, [{ project_id: 1, total_weeks: 2 }]);
  assert.equal(listed[0].total_weeks, 3); assert.equal(listed[0].total_proactive_loss, 43);
});

test('two concurrent v2 saves serialize and exactly one stale revision loses with 409', async () => {
  const pool = new MockPool(); pool.seedV2(); const request = application(pool);
  const first = createProductivityDocument(2); first.modes.proactive.planned[0] = 1;
  const second = createProductivityDocument(2); second.modes.proactive.planned[0] = 2;
  const results = await Promise.all([first, second].map(document => request('put', '/productivity-losses/:id/v2', { body: { expectedRevision: 1, document } })));
  assert.deepEqual(results.map(result => result.status).sort(), [200, 409]);
  assert.equal(pool.state.v2.get(1).revision, 2);
});

function responseCapture() {
  return { statusCode: 200, body: undefined, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; } };
}

test('an old write that wins the project lock invalidates the pending first-import fingerprint', async () => {
  const pool = new MockPool(); const request = application(pool);
  const loaded = (await request('get', '/productivity-losses/:id/v2')).body;
  let announce; let release;
  const started = new Promise(resolve => { announce = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  const legacyHandler = service.withLegacyProductivityWrite(pool, async (req, res, connection) => {
    announce(); await gate;
    await connection.query(`UPDATE productivity_loss_weeks SET planned_work_hours = ?, change_order_hours = ?,
      overmanning = ?, stacking_of_trades = ?, overtime_5_10 = ? WHERE project_id = ? AND week_number = ?`,
    [888, 0, 0, 0, 0, 1, 1]);
    res.json({ success: true });
  });
  const legacyResponse = responseCapture();
  const oldWrite = legacyHandler({ user: owner, params: { id: '1' } }, legacyResponse);
  await started;
  const importing = request('put', '/productivity-losses/:id/v2', { body: { expectedRevision: 0,
    expectedLegacyFingerprint: loaded.legacyFingerprint, document: loaded.document } });
  release(); await oldWrite;
  assert.equal(legacyResponse.statusCode, 200); assert.equal((await importing).status, 409);
  assert.equal(pool.state.weeks.get(1)[0].planned_work_hours, 888); assert.equal(pool.state.v2.size, 0);
});

test('a first import that wins the project lock makes a queued old write return 409 without invoking its body', async () => {
  const pool = new MockPool(); const request = application(pool);
  const loaded = (await request('get', '/productivity-losses/:id/v2')).body;
  let announce; let release; let calls = 0;
  const started = new Promise(resolve => { announce = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  pool.onLock = async () => { calls++; if (calls === 1) { announce(); await gate; } };
  const importing = request('put', '/productivity-losses/:id/v2', { body: { expectedRevision: 0,
    expectedLegacyFingerprint: loaded.legacyFingerprint, document: loaded.document } });
  await started;
  let invoked = false; const legacyResponse = responseCapture();
  const oldWrite = service.withLegacyProductivityWrite(pool, async (req, res) => { invoked = true; res.json({ success: true }); })(
    { user: owner, params: { id: '1' } }, legacyResponse,
  );
  release();
  assert.equal((await importing).status, 200); await oldWrite;
  assert.equal(legacyResponse.statusCode, 409); assert.equal(invoked, false);
  assert.equal(pool.state.v2.get(1).revision, 1);
});

test('legacy errors and commit failures roll back before the captured response can be sent', async () => {
  for (const failure of ['handler', 'commit']) {
    const pool = new MockPool(); const before = clone(pool.state); pool.failCommit = failure === 'commit';
    const response = responseCapture();
    await service.withLegacyProductivityWrite(pool, async (req, res, connection) => {
      await connection.query('UPDATE productivity_loss_projects SET total_proactive_loss = ?, total_retroactive_loss = ? WHERE id = ?', [999, 999, 1]);
      if (failure === 'handler') res.status(400).json({ error: 'fixture rejected' });
      else res.json({ success: true });
    })({ user: owner, params: { id: '1' } }, response);
    assert.equal(response.statusCode, failure === 'handler' ? 400 : 500); assert.deepEqual(pool.state, before);
    assert.ok(pool.events.includes('rollback'));
  }
});

test('legacy load rejects missing week rows rather than silently inventing zeros', async () => {
  const pool = new MockPool(); pool.state.weeks.get(1).pop();
  const response = await application(pool)('get', '/productivity-losses/:id/v2');
  assert.equal(response.status, 409); assert.equal(response.body.code, 'PRODUCTIVITY_LEGACY_INPUTS_INVALID');
  assert.equal(pool.state.v2.size, 0);
});

test('invalid/shared/corrupt inputs cannot partially save and a commit failure never sends success', async () => {
  const pool = new MockPool(); pool.seedV2(); const request = application(pool); const before = clone(pool.state);
  const invalid = createProductivityDocument(2, 'shared'); invalid.modes.proactive.planned[0] = 1;
  assert.equal((await request('put', '/productivity-losses/:id/v2', { body: { expectedRevision: 1, document: invalid } })).status, 400);
  assert.deepEqual(pool.state, before);
  pool.failCommit = true;
  const response = await request('put', '/productivity-losses/:id/v2', { body: { expectedRevision: 1, document: createProductivityDocument(2) } });
  assert.equal(response.status, 500); assert.deepEqual(pool.state, before);
  assert.ok(pool.events.lastIndexOf('rollback') < pool.events.lastIndexOf('response'));
  pool.failCommit = false; pool.state.v2.get(1).document = '{broken';
  assert.equal((await request('get', '/productivity-losses/:id/v2')).status, 409);
  assert.equal((await request('put', '/productivity-losses/:id/v2', { body: { expectedRevision: 1, document: createProductivityDocument(2) } })).status, 409);
});

test('v2 delete checks owner and revision, uses cascade, and allows the maximum stored revision', async () => {
  const pool = new MockPool(); pool.seedV2(1, createProductivityDocument(2), 4294967295); const request = application(pool);
  assert.equal((await request('delete', '/productivity-losses/:id/v2', { body: { expectedRevision: 1 } })).status, 409);
  assert.equal(pool.state.projects.has(1), true);
  assert.equal((await request('delete', '/productivity-losses/:id/v2', { body: { expectedRevision: 4294967295 } })).status, 200);
  assert.equal(pool.state.projects.has(1), false); assert.equal(pool.state.v2.has(1), false); assert.equal(pool.state.weeks.has(1), false);
});

test('the frontend document serializes to the same strict backend contract in separate and shared modes', () => {
  for (const inputMode of ['separate', 'shared']) {
    const document = serializeProductivityDocument(createProductivityDocument(52, inputMode));
    assert.deepEqual(backendModel.validateProductivityDocument(document).document, document);
  }
});

test('the maximum supported numeric document plus description fits the unchanged 100KB JSON parser limit', () => {
  const document = createProductivityDocument(52);
  for (const mode of Object.values(document.modes)) {
    mode.selectedFactorIds = [];
    mode.planned.fill(Number.MAX_VALUE); mode.change.fill(-Number.MAX_VALUE);
    for (const values of Object.values(mode.factors)) values.fill(-Number.MAX_VALUE);
  }
  backendModel.validateProductivityDocument(document);
  const bytes = Buffer.byteLength(JSON.stringify({ project_name: 'X'.repeat(255), description: 'X'.repeat(10000), total_weeks: 52, document }));
  assert.ok(bytes < 100 * 1024);
});

const originalPath = process.env.HCG_BACKEND_SOURCE || '';
const actualAvailable = Boolean(originalPath) && fs.existsSync(originalPath);
let actualRuntime;
if (actualAvailable) {
  const backendRequire = createRequire(originalPath);
  const source = fs.readFileSync(originalPath, 'utf8');
  const authStart = source.indexOf('const authenticateToken =');
  const authEnd = source.indexOf('// ==================== USER AUTHENTICATION');
  const start = source.indexOf('// ==================== PRODUCTIVITY LOSS API');
  const end = source.indexOf('// ==================== SERVER START');
  actualRuntime = { source, routes: source.slice(authStart, authEnd) + source.slice(start, end)
    + '// ==================== SERVER START ====================\n', express: backendRequire('express'), jwt: backendRequire('jsonwebtoken') };
}

function actualApplication(pool) {
  const app = actualRuntime.express(); app.use(actualRuntime.express.json());
  const install = new Function('app', 'db', 'jwt', 'JWT_SECRET', 'require', 'console', patcher.patchProductivitySource(actualRuntime.routes).source);
  install(app, pool, actualRuntime.jwt, 'isolated-test-secret-not-production', name => {
    assert.equal(name, './productivity-v2-service.cjs'); return service;
  }, { log() {}, error() {} });
  return app;
}

async function httpRequest(app, method, path, body = {}, user = owner) {
  const headers = { 'content-type': 'application/json',
    ...(user ? { authorization: `Bearer ${actualRuntime.jwt.sign(user, 'isolated-test-secret-not-production', { expiresIn: 60 })}` } : {}) };
  if (process.env.HCG_TEST_TCP === '1') {
    const server = http.createServer(app);
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}${path}`, { method, headers,
        ...(method === 'GET' ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(3000) });
      return { status: response.status, body: await response.json() };
    } finally { server.closeAllConnections?.(); await new Promise(resolve => server.close(resolve)); }
  }
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`HTTP fixture timeout ${method} ${path}`)), 3000);
    const chunks = []; const socket = new Duplex({ read() {}, write(chunk, encoding, callback) { chunks.push(Buffer.from(chunk)); callback(); } });
    const req = new http.IncomingMessage(socket); req.method = method; req.url = path; req.httpVersion = '1.1'; req.complete = true;
    const bytes = Buffer.from(JSON.stringify(body)); req.headers = { ...headers, 'content-length': String(bytes.length) };
    const res = new http.ServerResponse(req); res.assignSocket(socket);
    res.on('finish', () => {
      clearTimeout(timer); const wire = Buffer.concat(chunks).toString('utf8');
      const [head, json] = wire.split('\r\n\r\n');
      try { resolve({ status: Number(head.split(' ')[1]), body: JSON.parse(json) }); } catch (error) { reject(error); }
      socket.destroy();
    });
    res.on('error', reject); app(req, res); req.push(bytes); req.push(null);
  });
}

test('actual original routes patch safely, remains idempotent, and does not change any Bid code', { skip: !actualAvailable && 'Original backend is unavailable in this checkout; service/model tests remain self-contained.' }, () => {
  const { source } = actualRuntime; const start = source.indexOf('// ==================== PRODUCTIVITY LOSS API');
  const end = source.indexOf('// ==================== SERVER START');
  const patched = patcher.patchProductivitySource(source);
  assert.equal(patched.source.slice(0, start), source.slice(0, start));
  assert.equal(patched.source.slice(patched.source.indexOf('// ==================== SERVER START')), source.slice(end));
  assert.equal(patched.moduleType, 'esm'); assert.equal(patcher.patchProductivitySource(patched.source).changed, false);
  assert.throws(() => patcher.patchProductivitySource(source.replace('    const [productivityLosses] = await db.query(query, params);', 'changed')), /anchor/);
  assert.doesNotThrow(() => actualApplication(new MockPool()));
});

test('actual HTTP/auth/old routes reject v2 before writes and before revealing document validity', { skip: !actualAvailable }, async () => {
  const pool = new MockPool(); pool.seedV2(); pool.seedV2(2, { broken: true }); const app = actualApplication(pool);
  assert.equal((await httpRequest(app, 'PUT', '/productivity-losses/1/weeks', {}, null)).status, 401);
  for (const [method, path, body] of [
    ['PUT', '/productivity-losses/1/weeks/1', {}], ['PUT', '/productivity-losses/1/weeks', { weeks: [] }],
    ['PATCH', '/productivity-losses/1/weeks-count', { total_weeks: 3 }], ['DELETE', '/productivity-losses/1', {}],
    ['GET', '/productivity-losses/1', {}], ['GET', '/productivity-losses/1/summary', {}],
  ]) assert.equal((await httpRequest(app, method, path, body)).status, 409, path);
  assert.equal((await httpRequest(app, 'PUT', '/productivity-losses/2/v2', { expectedRevision: 'bad', document: {} })).status, 403);
  assert.equal(pool.calls.some(call => /^(UPDATE|DELETE|INSERT)/.test(call.sql)), false);
});

test('actual HTTP old batch writes use one connection and roll back the entire partial failure', { skip: !actualAvailable }, async () => {
  const pool = new MockPool(); const app = actualApplication(pool); const before = clone(pool.state);
  pool.failSql = /^UPDATE productivity_loss_weeks SET /; pool.failOccurrence = 2;
  const response = await httpRequest(app, 'PUT', '/productivity-losses/1/weeks', { weeks: [1, 2].map(week_number => ({ week_number, planned_work_hours: 888 })) });
  assert.equal(response.status, 500); assert.deepEqual(pool.state, before);
  const writes = pool.calls.filter(call => /^UPDATE productivity_loss_weeks/.test(call.sql));
  assert.equal(writes.length, 2); assert.equal(writes[0].connection, writes[1].connection);
  assert.ok(pool.events.includes('rollback'));
});

test('actual HTTP legacy single-week update still uses the original three-factor calculation', { skip: !actualAvailable }, async () => {
  const pool = new MockPool(); const app = actualApplication(pool);
  const response = await httpRequest(app, 'PUT', '/productivity-losses/1/weeks/1', {
    planned_work_hours: 1000, change_order_hours: -100, overmanning: 0.1, stacking_of_trades: 0.2, overtime_5_10: 0.05,
  });
  assert.equal(response.status, 200);
  const expected = 900 * (0.1 + 0.2 + 0.05);
  assert.equal(pool.state.weeks.get(1)[0].proactive_loss, expected);
  assert.equal(pool.state.weeks.get(1)[0].retroactive_loss, 900 * ((0.1 + 0.2 + 0.05) / (1 + 0.1 + 0.2 + 0.05)));
  assert.equal(pool.state.v2.size, 0);
});

test('actual HTTP list includes a v2 project with zero legacy weeks and correct raw totals', { skip: !actualAvailable }, async () => {
  const pool = new MockPool(); const app = actualApplication(pool);
  const document = createProductivityDocument(1); document.modes.proactive.selectedFactorIds = ['owner_furnished'];
  document.modes.proactive.planned[0] = 1000; document.modes.proactive.factors.owner_furnished[0] = 0.043;
  const created = await httpRequest(app, 'POST', '/productivity-losses-v2', { project_name: 'AUDIT TEST', total_weeks: 1, document });
  assert.equal(created.status, 200); assert.equal(pool.state.weeks.has(created.body.project_id), false);
  const listed = await httpRequest(app, 'GET', '/productivity-losses');
  assert.equal(listed.status, 200);
  const row = listed.body.productivityLosses.find(project => project.project_id === created.body.project_id);
  assert.equal(row.model_version, 2); assert.equal(row.total_proactive_loss, 43); assert.equal(row.revision, 1);
});
