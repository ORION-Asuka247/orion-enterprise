import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = readFileSync(new URL('../apps/web/src/lib/completionRules.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 } }).outputText;
const { validateCompletion } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'));
const photo = (type='image/jpeg', size=100) => ({type, size});
test('Accepts two supported images and a bounded work note', () => assert.doesNotThrow(() => validateCompletion('Hinges adjusted and latch retested.', [photo(), photo('image/png')])));
test('Rejects missing detail evidence and reuse of the same selected file', () => {
  assert.throws(() => validateCompletion('Repair completed.', [photo(), null]));
  const f = photo(); assert.throws(() => validateCompletion('Repair completed.', [f, f]));
});
test('Rejects empty, oversized or executable uploads', () => {
  for (const f of [photo('image/jpeg', 0), photo('image/jpeg', 10485761), photo('text/html'), photo('image/svg+xml')])
    assert.throws(() => validateCompletion('Repair completed.', [photo(), f]));
});
test('Requires useful notes and limits payload length', () => {
  for (const n of ['', '          ', 'Done', 'x'.repeat(4001)]) assert.throws(() => validateCompletion(n, [photo(), photo()]));
  assert.doesNotThrow(() => validateCompletion('x'.repeat(4000), [photo(), photo('image/webp', 10485760)]));
});
