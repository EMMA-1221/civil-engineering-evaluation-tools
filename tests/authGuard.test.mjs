import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import test from 'node:test';
import vm from 'node:vm';
import { build } from 'esbuild';

// Render the actual route guard, rather than a copy of its authorization test.
// Effects intentionally do not run: no cached claims may reveal a tool before
// the live server has answered the initial verification request.
const result = await build({
  stdin: {
    contents: `
      import React from 'react';
      import { renderToString } from 'react-dom/server';
      import { MemoryRouter } from 'react-router-dom';
      import { AuthContext } from './src/contexts.js';
      import ProtectedRoute from './src/components/ProtectedRoute.jsx';
      export function render(token) {
        const session = {
          token, sessionVersion: 0, user: { username: 'Forged administrator', role: 'admin' },
          logout() {}, syncSession() {}, isCurrentSession() { return false; }, acceptVerifiedUser() { return false; },
        };
        return renderToString(<MemoryRouter initialEntries={['/bid']}>
          <AuthContext.Provider value={session}><ProtectedRoute><div>PRIVATE TOOL CONTENT</div></ProtectedRoute></AuthContext.Provider>
        </MemoryRouter>);
      }`,
    resolveDir: new URL('..', import.meta.url).pathname,
    loader: 'jsx',
  },
  bundle: true, platform: 'node', format: 'cjs', write: false, jsx: 'automatic', logLevel: 'silent',
});
const module = { exports: {} };
vm.runInNewContext(result.outputFiles[0].text, {
  module, exports: module.exports, require: createRequire(import.meta.url), process,
  console: { ...console, log() {} }, window: { location: { hostname: 'localhost' } },
  TextEncoder, TextDecoder, setTimeout, clearTimeout, setImmediate, clearImmediate, queueMicrotask,
  AbortController, URL, URLSearchParams, atob,
});
const unsigned = exp => `unsigned.${Buffer.from(JSON.stringify({ exp })).toString('base64url')}.unsigned`;

test('initial route guard never renders a tool from a cached admin profile without a token', () => {
  assert.equal(module.exports.render('').includes('PRIVATE TOOL CONTENT'), false);
});

test('a forged token with a future expiry cannot reveal a tool before server verification', () => {
  const html = module.exports.render(unsigned(Math.floor(Date.now() / 1000) + 3600));
  assert.equal(html.includes('PRIVATE TOOL CONTENT'), false);
  assert.equal(html.includes('Opening your workspace'), true);
});

test('an already expired token never renders protected children on first paint', () => {
  const html = module.exports.render(unsigned(1));
  assert.equal(html.includes('PRIVATE TOOL CONTENT'), false);
  assert.equal(html.includes('Opening your workspace'), false);
});
