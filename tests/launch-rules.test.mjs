import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = readFileSync(new URL('../apps/web/src/lib/launchRules.ts', import.meta.url), 'utf8');
const js = ts.transpileModule(source, {compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2020}}).outputText;
const {assetQrUrl,inspectionPassRate} = await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
test('A QR label opens the same asset on both hosting locations', () => {
  assert.equal(assetQrUrl('https://asuka247.eu','/app/','door 01'), 'https://asuka247.eu/app/q/door%2001');
  assert.equal(assetQrUrl('https://orion-enterprise.netlify.app/','/','door-01'), 'https://orion-enterprise.netlify.app/q/door-01');
});
test('A portfolio with no assessed outcomes has no invented pass rate', () => {
  assert.equal(inspectionPassRate(0,0),null);
  assert.equal(inspectionPassRate(0,4),0);
  assert.equal(inspectionPassRate(3,1),75);
  assert.throws(()=>inspectionPassRate(-1,1));
});
