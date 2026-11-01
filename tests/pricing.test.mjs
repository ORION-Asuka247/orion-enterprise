import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
// Exercise the production calculator without opening a live database connection.
const source=readFileSync(new URL('../apps/web/src/lib/pricing.ts',import.meta.url),'utf8').replace('import { supabase } from "./supabase";','const supabase = null;');
const js=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {priceRemedialPackage,priceRemedialPackages}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const pkg={actions:[{code:'REPLACE_HINGES'},{code:'REPLACE_SEALS'}],requiresReview:false};
const config={profiles:{standard:{hourlyRate:60,minimumCharge:80,billingIncrementMinutes:15}},actions:{REPLACE_HINGES:{labourMinutes:90,materialsCost:20},REPLACE_SEALS:{labourMinutes:60,materialsCost:10}}};
test('Consolidated package charges shared labour once and combines materials without VAT',()=>{
 const r=priceRemedialPackage(pkg,'standard',config);assert.equal(r.priceReady,true);assert.equal(r.labourMinutes,120);assert.equal(r.labourCharge,120);assert.equal(r.materialsCharge,30);assert.equal(r.totalCharge,150);
});
test('Unreviewed and unknown work is excluded from quotation totals',()=>{
 const pending={...pkg,requiresReview:true};const unknown={actions:[{code:'UNREVIEWED_ACTION'}],requiresReview:false};
 const r=priceRemedialPackages([pkg,pending,unknown],'standard',config);assert.equal(r.readyCount,1);assert.equal(r.reviewCount,2);assert.equal(r.total,150);
});
test('Invalid rate profiles cannot produce a ready quotation',()=>{
 for(const patch of [{hourlyRate:NaN},{hourlyRate:0},{hourlyRate:-1},{minimumCharge:Infinity},{billingIncrementMinutes:0},{billingIncrementMinutes:1.5}]){
  const c={...config,profiles:{standard:{...config.profiles.standard,...patch}}};assert.equal(priceRemedialPackage(pkg,'standard',c).priceReady,false);
 }
});
test('Missing, negative and nonfinite action allowances require price review',()=>{
 for(const patch of [{materialsCost:null},{materialsCost:-1},{materialsCost:NaN},{labourMinutes:Infinity}]){
  const c={...config,actions:{...config.actions,REPLACE_HINGES:{...config.actions.REPLACE_HINGES,...patch}}};const r=priceRemedialPackage(pkg,'standard',c);assert.equal(r.priceReady,false);
  assert.equal(priceRemedialPackages([pkg],'standard',c).total,0);
 }
});
