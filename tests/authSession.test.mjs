import assert from 'node:assert/strict';
import test from 'node:test';
import { createAuthSessionStore, tokenExpiresAt, tokenIsExpired } from '../src/authSession.js';

const jwt = (exp, sub = 'alice') => `test.${Buffer.from(JSON.stringify({ exp, sub })).toString('base64url')}.test`;
const alice = { id: 1, username: 'Alice', role: 'user' };
const bob = { id: 2, username: 'Bob', role: 'user' };

function setup(initial = {}, start = 1000000) {
  const values = new Map(Object.entries(initial));
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, String(value)), removeItem: key => values.delete(key) };
  const target = new EventTarget();
  let time = start;
  let serial = 0;
  const timers = new Map();
  const store = createAuthSessionStore({ storage, now: () => time, setTimer: (callback, delay) => { const id = ++serial; timers.set(id, { callback: () => { timers.delete(id); callback(); }, delay }); return id; }, clearTimer: id => timers.delete(id) });
  const event = (key = null, storageArea = storage) => {
    const change = new Event('storage');
    Object.defineProperties(change, { key: { value: key }, storageArea: { value: storageArea } });
    target.dispatchEvent(change);
  };
  return { store, storage, target, timers, event, setTime: value => { time = value; } };
}

test('untrusted JWT expiry is a denial hint and malformed claims never grant authentication', () => {
  assert.equal(tokenExpiresAt(jwt(1001)), 1001000);
  assert.equal(tokenIsExpired(jwt(1001), 1000999), false);
  assert.equal(tokenIsExpired(jwt(1001), 1001000), true);
  for (const token of ['', 'junk', 'a.@@@.c', jwt('1001'), jwt(null), jwt(Infinity)]) {
    assert.equal(tokenExpiresAt(token), null);
    assert.equal(tokenIsExpired(token, 1000000), false);
  }
});

test('cached profile alone does not create a session; malformed JSON does not crash', () => {
  const noToken = setup({ user: JSON.stringify({ ...alice, role: 'admin' }) });
  assert.equal(noToken.store.getSnapshot().token, '');
  assert.equal(noToken.store.getSnapshot().user, null);
  const malformed = setup({ token: 'not-a-server-verified-token', user: '{' });
  assert.equal(malformed.store.getSnapshot().user, null);
  assert.equal(malformed.store.acceptVerifiedUser({ token: 'wrong', version: 0 }, alice), false);
});

test('same-tab login/logout notify subscribers and change session identity', () => {
  const { store } = setup();
  let changes = 0;
  const unsubscribe = store.subscribe(() => { changes += 1; });
  store.login(alice, jwt(2000));
  const signedIn = store.getSnapshot();
  assert.deepEqual(signedIn.user, alice);
  assert.equal(signedIn.version, 1);
  assert.equal(store.logout({ token: signedIn.token, version: signedIn.version }), true);
  assert.equal(store.getSnapshot().token, '');
  assert.equal(store.getSnapshot().user, null);
  assert.equal(store.getSnapshot().version, 2);
  unsubscribe();
  store.login(bob, jwt(2000, 'bob'));
  assert.equal(changes, 2);
});

test('logout in another tab immediately invalidates mounted session identity', () => {
  const env = setup({ token: jwt(2000), user: JSON.stringify(alice) });
  const stop = env.store.listen(env.target);
  const expected = env.store.getSnapshot();
  env.storage.removeItem('token'); env.storage.removeItem('user');
  env.event('token');
  assert.equal(env.store.getSnapshot().token, '');
  assert.equal(env.store.getSnapshot().user, null);
  assert.equal(env.store.isCurrent(expected), false);
  stop();
});

test('cross-tab account switch replaces user and session identity', () => {
  const env = setup({ token: jwt(2000), user: JSON.stringify(alice) });
  const stop = env.store.listen(env.target);
  const expected = env.store.getSnapshot();
  env.storage.setItem('token', jwt(3000, 'bob')); env.storage.setItem('user', JSON.stringify(bob));
  env.event('token');
  const current = env.store.getSnapshot();
  assert.deepEqual(current.user, bob);
  assert.notEqual(current.version, expected.version);
  assert.equal(env.store.isCurrent(expected), false);
  stop();
});

test('a late rejected verification cannot log out a newer account before its storage event', () => {
  const env = setup({ token: jwt(2000), user: JSON.stringify(alice) });
  const stale = env.store.getSnapshot();
  env.storage.setItem('token', jwt(3000, 'bob')); env.storage.setItem('user', JSON.stringify(bob));
  assert.equal(env.store.logout(stale), false);
  assert.equal(env.storage.getItem('token'), jwt(3000, 'bob'));
  assert.deepEqual(env.store.getSnapshot().user, bob);
  assert.equal(env.store.acceptVerifiedUser(stale, { ...alice, role: 'admin' }), false);
  assert.deepEqual(env.store.getSnapshot().user, bob);
});

test('session version prevents a late response after logout and login with the same token', () => {
  const { store } = setup({ token: jwt(2000), user: JSON.stringify(alice) });
  const stale = store.getSnapshot();
  store.logout(); store.login(alice, stale.token);
  assert.equal(store.logout(stale), false);
  assert.equal(store.acceptVerifiedUser(stale, alice), false);
  assert.equal(store.getSnapshot().token, stale.token);
});

test('expiry timer closes the session at its boundary without route navigation', () => {
  const env = setup({ token: jwt(1001), user: JSON.stringify(alice) });
  const stop = env.store.listen(env.target);
  assert.equal(env.timers.size, 1);
  const timer = [...env.timers.values()][0];
  assert.equal(timer.delay, 1000);
  env.setTime(1001000); timer.callback();
  assert.equal(env.store.getSnapshot().token, '');
  assert.equal(env.storage.getItem('user'), null);
  assert.equal(env.timers.size, 0);
  stop();
});

test('a queued expiry timer cannot clear an account that replaced its token', () => {
  const env = setup({ token: jwt(1001), user: JSON.stringify(alice) });
  const stop = env.store.listen(env.target);
  const oldTimer = [...env.timers.values()][0];
  env.storage.setItem('token', jwt(3000, 'bob')); env.storage.setItem('user', JSON.stringify(bob));
  env.setTime(1001000); oldTimer.callback();
  assert.deepEqual(env.store.getSnapshot().user, bob);
  assert.equal(env.storage.getItem('token'), jwt(3000, 'bob'));
  stop();
});

test('long expiry timers are capped and expired sessions are cleared on startup', () => {
  const long = setup({ token: jwt(99999999), user: JSON.stringify(alice) });
  const stop = long.store.listen(long.target);
  assert.equal([...long.timers.values()][0].delay, 2147483647);
  stop();
  assert.equal(long.timers.size, 0);
  const expired = setup({ token: jwt(999), user: JSON.stringify(alice) });
  const stopExpired = expired.store.listen(expired.target);
  assert.equal(expired.store.getSnapshot().token, '');
  assert.equal(expired.storage.getItem('token'), null);
  stopExpired();
});

test('verified server profile replaces cached role without changing drafts or another tab', () => {
  const env = setup({ token: jwt(2000), user: JSON.stringify({ ...alice, role: 'admin' }) });
  const before = env.store.getSnapshot();
  const storedProfile = env.storage.getItem('user');
  assert.equal(env.store.acceptVerifiedUser(before, alice), true);
  assert.deepEqual(env.store.getSnapshot().user, alice);
  assert.equal(env.store.getSnapshot().version, before.version);
  assert.equal(env.storage.getItem('user'), storedProfile);
  env.store.sync();
  assert.deepEqual(env.store.getSnapshot().user, alice);
  assert.equal(env.store.acceptVerifiedUser(before, null), false);
});

test('focus/pageshow synchronize missed events, unrelated storage events are ignored, cleanup removes listeners', () => {
  const env = setup({ token: jwt(2000), user: JSON.stringify(alice) });
  const stop = env.store.listen(env.target);
  const original = env.store.getSnapshot();
  env.storage.removeItem('token'); env.storage.removeItem('user');
  env.event('unrelated');
  assert.equal(env.store.getSnapshot(), original);
  env.event('token', {});
  assert.equal(env.store.getSnapshot(), original);
  env.target.dispatchEvent(new Event('focus'));
  assert.equal(env.store.getSnapshot().token, '');
  env.storage.setItem('token', jwt(3000, 'bob')); env.storage.setItem('user', JSON.stringify(bob));
  env.target.dispatchEvent(new Event('pageshow'));
  assert.deepEqual(env.store.getSnapshot().user, bob);
  stop();
  const stopped = env.store.getSnapshot();
  env.storage.removeItem('token'); env.target.dispatchEvent(new Event('focus')); env.event();
  assert.equal(env.store.getSnapshot(), stopped);
  assert.equal(env.timers.size, 0);
});
