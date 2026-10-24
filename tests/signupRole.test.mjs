import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

// Production auth source is deliberately not included in this public repository.
// Supply a private, configuration-free audit copy to exercise the actual handlers:
// HCG_AUTH_AUDIT_SOURCE=/absolute/path/backend-routes.sanitized.js node --test tests/signupRole.test.mjs
const auditPath = process.env.HCG_AUTH_AUDIT_SOURCE;
const source = auditPath ? await readFile(auditPath, 'utf8') : null;
const fixtureOptions = source ? {} : {
  skip: 'Set HCG_AUTH_AUDIT_SOURCE to a private sanitized backend audit file.',
};
const plain = value => JSON.parse(JSON.stringify(value));

function authenticationSource() {
  const signup = /app\.post\(\s*['"]\/signup['"]\s*,/.exec(source);
  const login = /app\.post\(\s*['"]\/login['"]\s*,/.exec(source);
  assert.ok(signup && login && signup.index < login.index,
    'Audit fixture must contain the original signup and login route registrations.');
  const afterLogin = source.slice(login.index + login[0].length);
  const nextRoute = /\napp\.(?:get|post|put|patch|delete)\(/.exec(afterLogin);
  assert.ok(nextRoute, 'Require the following route boundary; never evaluate the full server.');
  return source.slice(signup.index, login.index + login[0].length + nextRoute.index);
}

function harness(query) {
  const handlers = new Map();
  const queries = [];
  const hashes = [];
  const signatures = [];
  const comparisons = [];
  const sandbox = vm.createContext({
    app: { post(path, handler) {
      assert.ok(path === '/signup' || path === '/login');
      assert.equal(handlers.has(path), false);
      handlers.set(path, handler);
    } },
    db: { async query(sql, params) {
      const call = { sql, params: plain(params) };
      queries.push(call);
      return query(call);
    } },
    bcrypt: {
      async hash(value, rounds) {
        hashes.push({ value, rounds });
        return 'isolated-test-hash';
      },
      async compare(value, hash) {
        comparisons.push({ value, hash });
        return true;
      },
    },
    // Test doubles only: never read, sign with, or return a production credential.
    JWT_SECRET: 'isolated-test-sentinel',
    jwt: { sign(payload, key, options) {
      assert.equal(key, 'isolated-test-sentinel');
      signatures.push({ payload: plain(payload), options: plain(options) });
      return 'isolated-test-token';
    } },
    console: { log() {}, error() {} },
  });
  vm.runInContext(authenticationSource(), sandbox, { timeout: 1000 });
  assert.deepEqual([...handlers.keys()], ['/signup', '/login']);

  return {
    queries, hashes, signatures, comparisons,
    async request(path, body) {
      const response = {
        statusCode: 200,
        body: undefined,
        status(code) { this.statusCode = code; return this; },
        json(value) { this.body = plain(value); return this; },
      };
      await handlers.get(path)({ body }, response);
      return response;
    },
  };
}

test('actual signup ignores injected administrator fields and explicitly inserts user', fixtureOptions, async () => {
  for (const maliciousFields of [
    { role: 'admin' },
    { role: 'admin', isAdmin: true, is_admin: 1, admin: true },
    { user: { role: 'admin' }, permissions: ['admin'], roles: ['admin'] },
    { id: 1, user_id: 1, role: ['admin'], accountType: 'admin' },
  ]) {
    const env = harness(({ sql }) => {
      if (sql.startsWith('SELECT')) return [[]];
      return [{ insertId: 42 }];
    });
    const response = await env.request('/signup', {
      username: 'isolated-test-user', email: 'isolated-test@example.invalid',
      password: 'isolated-test-input', ...maliciousFields,
    });
    assert.equal(response.statusCode, 200);
    assert.equal(response.body.userId, 42);
    assert.equal(env.queries.length, 2);
    assert.match(env.queries[1].sql,
      /^INSERT INTO users \(username, email, password_hash, role\) VALUES \(\?, \?, \?, \?\)$/);
    assert.deepEqual(env.queries[1].params,
      ['isolated-test-user', 'isolated-test@example.invalid', 'isolated-test-hash', 'user']);
    assert.equal(env.hashes[0].rounds, 10);
    assert.equal(env.signatures.length, 0);
  }
});

test('actual signup cannot replace an existing administrator by re-registering', fixtureOptions, async () => {
  const env = harness(() => [[{
    username: 'existing-admin', email: 'admin@example.invalid', role: 'admin',
  }]]);
  const response = await env.request('/signup', {
    username: 'existing-admin', email: 'admin@example.invalid',
    password: 'isolated-test-input', role: 'admin',
  });
  assert.equal(response.statusCode, 400);
  assert.equal(env.queries.length, 1);
  assert.equal(env.hashes.length, 0);
});

test('actual login signs the database user role despite injected admin identity', fixtureOptions, async () => {
  const env = harness(() => [[{
    id: 42, username: 'isolated-test-user', email: 'isolated-test@example.invalid',
    password_hash: 'isolated-test-db-hash', role: 'user',
  }]]);
  const response = await env.request('/login', {
    identifier: 'isolated-test-user', password: 'isolated-test-input',
    id: 1, role: 'admin', isAdmin: true, user: { id: 1, role: 'admin' },
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.role, 'user');
  assert.equal(response.body.user.id, 42);
  assert.equal(env.signatures.length, 1);
  assert.equal(env.signatures[0].payload.role, 'user');
  assert.equal(env.signatures[0].payload.id, 42);
  assert.deepEqual(env.comparisons,
    [{ value: 'isolated-test-input', hash: 'isolated-test-db-hash' }]);
  assert.deepEqual(env.queries[0].params, ['isolated-test-user', 'isolated-test-user']);
});

test('actual login retains admin only when the database account is admin', fixtureOptions, async () => {
  const env = harness(() => [[{
    id: 7, username: 'existing-admin', email: 'admin@example.invalid',
    password_hash: 'isolated-test-db-hash', role: 'admin',
  }]]);
  const response = await env.request('/login', {
    identifier: 'existing-admin', password: 'isolated-test-input', role: 'user',
  });
  assert.equal(response.statusCode, 200);
  assert.equal(response.body.user.role, 'admin');
  assert.equal(env.signatures[0].payload.role, 'admin');
});
