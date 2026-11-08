import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = readFileSync(new URL('../apps/web/src/lib/authSession.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { watchVerifiedSession } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const session = { access_token: 'test-token', user: { id: 'user-1' } };
const tick = () => new Promise(resolve => setTimeout(resolve, 10));
function deferred() {
  let resolve;
  const promise = new Promise(r => { resolve = r; });
  return { promise, resolve };
}
function harness({ initial = session, getUser, getSession } = {}) {
  let listener, unsubscribed = false, recoveries = 0;
  const states = [], tokens = [];
  const stop = watchVerifiedSession({
    getSession: getSession ?? (async () => ({ data: { session: initial }, error: null })),
    getUser: async token => {
      tokens.push(token);
      return getUser ? getUser(token) : { data: { user: session.user }, error: null };
    },
    onAuthStateChange(callback) {
      listener = callback;
      return { data: { subscription: { unsubscribe() { unsubscribed = true; } } } };
    }
  }, state => states.push(state), () => recoveries++);
  return { states, tokens, stop, emit: (...args) => listener(...args), get recoveries() { return recoveries; }, get unsubscribed() { return unsubscribed; } };
}

test('stored session cannot open protected content until Auth verifies it', async () => {
  const pending = deferred();
  const h = harness({ getUser: () => pending.promise });
  await tick();
  assert.deepEqual(h.states.at(-1), { session: null, loading: true, error: '' });
  pending.resolve({ data: { user: session.user }, error: null });
  await tick();
  assert.equal(h.states.at(-1).session.user.id, 'user-1');
  assert.deepEqual(h.tokens, ['test-token']);
  h.stop();
});

test('missing session keeps protected content closed without calling getUser', async () => {
  const h = harness({ initial: null }); await tick();
  assert.deepEqual(h.states.at(-1), { session: null, loading: false, error: '' });
  assert.equal(h.tokens.length, 0); h.stop();
});

for (const [name, result] of [
  ['rejected token', { data: { user: null }, error: new Error('invalid JWT') }],
  ['identity mismatch', { data: { user: { id: 'other-user' } }, error: null }]
]) test(name + ' fails closed with a useful error', async () => {
  const h = harness({ getUser: async () => result }); await tick();
  assert.equal(h.states.at(-1).session, null);
  assert.equal(h.states.at(-1).loading, false);
  assert.ok(h.states.at(-1).error); h.stop();
});

test('network failure during verification fails closed', async () => {
  const h = harness({ getUser: async () => { throw new Error('offline'); } }); await tick();
  assert.equal(h.states.at(-1).session, null); assert.ok(h.states.at(-1).error); h.stop();
});

test('late verification cannot undo sign-out', async () => {
  const pending = deferred(); const h = harness({ getUser: () => pending.promise });
  await tick(); h.emit('SIGNED_OUT', null);
  pending.resolve({ data: { user: session.user }, error: null }); await tick();
  assert.deepEqual(h.states.at(-1), { session: null, loading: false, error: '' }); h.stop();
});

test('late initial session cannot overwrite a newer Auth event', async () => {
  const pending = deferred(); const h = harness({ getSession: () => pending.promise });
  h.emit('SIGNED_OUT', null);
  pending.resolve({ data: { session }, error: null }); await tick();
  assert.equal(h.states.at(-1).session, null); assert.equal(h.tokens.length, 0); h.stop();
});

test('recovery waits for verification and cleanup unsubscribes pending callbacks', async () => {
  const h = harness({ initial: null }); await tick();
  h.emit('PASSWORD_RECOVERY', session);
  assert.equal(h.recoveries, 1);
  assert.equal(h.states.at(-1).session, null);
  await tick(); assert.equal(h.states.at(-1).session.user.id, 'user-1');
  h.emit('TOKEN_REFRESHED', session); h.stop();
  const count = h.states.length; await tick();
  assert.equal(h.states.length, count); assert.equal(h.unsubscribed, true);
});
