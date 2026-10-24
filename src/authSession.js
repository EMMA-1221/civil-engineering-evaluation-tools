// JWT claims only let the client close an expired view sooner. The server still
// verifies the signature and permissions before any protected page is opened.
export function tokenExpiresAt(token) {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    const expiry = payload.exp;
    return typeof expiry === 'number' && Number.isFinite(expiry) && Number.isFinite(expiry * 1000) ? expiry * 1000 : null;
  } catch { return null; }
}

export function tokenIsExpired(token, now = Date.now()) {
  const expiresAt = tokenExpiresAt(token);
  return expiresAt !== null && expiresAt <= now;
}

function readStoredSession(storage) {
  try {
    const token = storage.getItem('token') || '';
    const userText = storage.getItem('user') || '';
    let user = null;
    try {
      const parsed = JSON.parse(userText);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) user = parsed;
    } catch { /* An invalid cached profile never establishes authentication. */ }
    return { token, user: token ? user : null, userText };
  } catch { return { token: '', user: null, userText: '' }; }
}

export function createAuthSessionStore({ storage, now = Date.now, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let snapshot = { ...readStoredSession(storage), version: 0 };
  const listeners = new Set();
  let stopListening = null;
  let expiryTimer = null;

  function publish(stored) {
    if (stored.token === snapshot.token && stored.userText === snapshot.userText) return;
    snapshot = { ...stored, version: snapshot.version + 1 };
    for (const listener of listeners) listener();
  }

  function scheduleExpiry() {
    if (expiryTimer !== null) clearTimer(expiryTimer);
    expiryTimer = null;
    if (!stopListening || !snapshot.token) return;
    const expiry = tokenExpiresAt(snapshot.token);
    if (expiry === null) return;
    const expected = { token: snapshot.token, version: snapshot.version };
    // Long-lived tokens must not overflow the browser's signed timer limit.
    expiryTimer = setTimer(() => {
      expiryTimer = null;
      if (isCurrent(expected) && tokenIsExpired(expected.token, now())) logout(expected);
      else scheduleExpiry();
    }, Math.min(Math.max(expiry - now(), 0), 2147483647));
  }

  function sync() {
    let stored = readStoredSession(storage);
    if (stored.token && tokenIsExpired(stored.token, now())) {
      storage.removeItem('token');
      storage.removeItem('user');
      stored = readStoredSession(storage);
    }
    publish(stored);
    scheduleExpiry();
    return snapshot;
  }

  function isCurrent(expected) {
    const current = sync();
    return current.token === expected.token && current.version === expected.version;
  }

  function login(user, token) {
    if (typeof token !== 'string' || !token || !user || typeof user !== 'object' || Array.isArray(user)) throw new Error('The sign-in response could not be verified.');
    storage.setItem('token', token);
    storage.setItem('user', JSON.stringify(user));
    sync();
  }

  function logout(expected) {
    // Synchronize first: a late response from an old tab must not clear a newer
    // account that has already signed in, even before its storage event arrives.
    if (expected && !isCurrent(expected)) return false;
    storage.removeItem('token');
    storage.removeItem('user');
    sync();
    return true;
  }

  function acceptVerifiedUser(expected, user) {
    if (!isCurrent(expected) || !user || typeof user !== 'object' || Array.isArray(user)) return false;
    // Use the server's profile in memory. Rewriting shared storage on every
    // verification would unnecessarily reset another tab's unsaved editor.
    if (JSON.stringify(snapshot.user) !== JSON.stringify(user)) {
      snapshot = { ...snapshot, user };
      for (const listener of listeners) listener();
    }
    return true;
  }

  function setUser(value) {
    const user = typeof value === 'function' ? value(snapshot.user) : value;
    storage.setItem('user', JSON.stringify(user));
    sync();
  }

  function listen(target) {
    if (stopListening) return stopListening;
    const onStorage = event => {
      if ((event.storageArea == null || event.storageArea === storage) && (event.key == null || event.key === 'token' || event.key === 'user')) sync();
    };
    target.addEventListener('storage', onStorage);
    target.addEventListener('focus', sync);
    target.addEventListener('pageshow', sync);
    stopListening = () => {
      target.removeEventListener('storage', onStorage);
      target.removeEventListener('focus', sync);
      target.removeEventListener('pageshow', sync);
      if (expiryTimer !== null) clearTimer(expiryTimer);
      expiryTimer = null;
      stopListening = null;
    };
    sync();
    return stopListening;
  }

  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); },
    sync, isCurrent, login, logout, setUser, acceptVerifiedUser, listen,
  };
}
