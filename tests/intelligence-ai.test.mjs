import {readFileSync} from 'node:fs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';
const src=readFileSync(new URL('../supabase/functions/orion-intelligence/handler.ts',import.meta.url),'utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.ESNext,target:ts.ScriptTarget.ES2022}}).outputText;
const {createHandler,checkedMetrics,usageRecord}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const company='11111111-1111-4111-8111-111111111111',user='22222222-2222-4222-8222-222222222222',run='33333333-3333-4333-8333-333333333333';
const metrics={properties:1,assets:10,passed_inspections:4,failed_inspections:2,pending_inspections:1,open_defects:2,critical_defects:0,reports:4,issued_reports:2};
const briefing={summary:'Two open defects need review.',priorities:[{title:'Review defects',action:'Review the source findings before planning remedial work.',basis:'open_defects'}],limitations:['Aggregate counts cannot establish asset compliance.']};
const config={supabaseUrl:'https://orion-test.invalid',anonKey:'test-public',serviceKey:'test-server',openaiKey:'test-provider'};
const req=(body={company_id:company},headers={})=>new Request('https://edge.invalid',{method:'POST',headers:{Authorization:'Bearer test-session',Origin:'https://asuka247.eu','Content-Type':'application/json',...headers},body:JSON.stringify(body)});
function fixture(options={}) {
 const calls=[],audits=[];
 const fetcher=async(url,init={})=>{
  calls.push({url,init});
  if(url.endsWith('/auth/v1/user'))return Response.json({id:user},{status:options.unauthorized?401:200});
  if(url.endsWith('/rpc/orion_intelligence_context'))return Response.json(metrics,{status:options.forbidden?403:200});
  if(url.endsWith('/rpc/orion_ai_begin_run'))return options.limit?Response.json({message:'Daily AI request limit reached'},{status:400}):Response.json(run);
  if(url==='https://api.openai.com/v1/responses')return options.providerError?Response.json({error:{code:options.providerError,message:'private upstream detail'}},{status:options.providerStatus||429}):options.providerFails?Response.json({error:'private upstream detail'},{status:429}):Response.json({status:'completed',usage:{input_tokens:1000,output_tokens:100,input_tokens_details:{cached_tokens:200}},output:[{type:'message',content:[{type:'output_text',text:options.badOutput?'not-json':JSON.stringify(briefing)}]}]});
  if(url.includes('/rest/v1/orion_ai_runs?')){audits.push(JSON.parse(init.body));return Response.json([{id:run}]);}
  throw new Error('Unexpected network call');
 };
 return {calls,audits,handler:createHandler({...config,...(options.config||{})},fetcher)};
}
test('Health check reveals no key or records and makes no network calls',async()=>{
 const f=fixture();const r=await f.handler(new Request('https://edge.invalid'));const b=await r.json();assert.equal(b.configured,true);assert.equal(f.calls.length,0);assert.ok(!JSON.stringify(b).includes('test-provider'));
});
test('Missing and invalid authentication never call the AI provider',async()=>{
 const f=fixture({unauthorized:true});assert.equal((await f.handler(req())).status,401);assert.equal(f.calls.length,1);
 const g=fixture();assert.equal((await g.handler(req(undefined,{Authorization:''}))).status,401);assert.equal(g.calls.length,0);
});
test('Workspace permissions are verified before the provider or audit reservation',async()=>{
 const f=fixture({forbidden:true});assert.equal((await f.handler(req())).status,403);assert.equal(f.calls.length,2);
 assert.equal(JSON.parse(f.calls[1].init.body).p_company_id,company);
});
test('Missing API configuration does not invent an analysis or reserve a paid request',async()=>{
 const f=fixture({config:{openaiKey:''}});const r=await f.handler(req());assert.equal(r.status,503);assert.equal((await r.json()).code,'not_configured');assert.equal(f.calls.length,2);
});
test('A successful request uses server-selected aggregate counts and records tokens, latency and cost',async()=>{
 const f=fixture();const r=await f.handler(req({company_id:company,metrics:{client_secret:'must not be sent'}}));const b=await r.json();assert.equal(r.status,200);assert.equal(b.run_id,run);
 const provider=f.calls.find(c=>c.url==='https://api.openai.com/v1/responses');const payload=JSON.parse(provider.init.body);
 assert.deepEqual(JSON.parse(payload.input),metrics);assert.equal(payload.store,false);assert.equal(payload.max_output_tokens,1200);assert.ok(!provider.init.body.includes('client_secret'));assert.ok(!provider.init.body.includes(user));
 assert.equal(f.audits[0].status,'completed');assert.equal(f.audits[0].input_tokens,1000);assert.equal(f.audits[0].output_tokens,100);assert.ok(f.audits[0].duration_ms>=0);assert.ok(Math.abs(f.audits[0].estimated_cost_usd-.001065)<1e-10);
});
test('Rate cap prevents an external AI request',async()=>{
 const f=fixture({limit:true});assert.equal((await f.handler(req())).status,429);assert.ok(!f.calls.some(c=>c.url==='https://api.openai.com/v1/responses'));
});
test('Provider failure is audited without returning private upstream detail',async()=>{
 const f=fixture({providerFails:true});const r=await f.handler(req());assert.equal(r.status,502);assert.ok(!(await r.text()).includes('private upstream detail'));assert.equal(f.audits[0].status,'failed');assert.equal(f.audits[0].error_code,'provider_rejected');assert.equal(f.audits[0].estimated_cost_usd,undefined);
});
test('Malformed model output is rejected while billable usage is retained',async()=>{
 const f=fixture({badOutput:true});assert.equal((await f.handler(req())).status,502);assert.equal(f.audits[0].status,'failed');assert.equal(f.audits[0].input_tokens,1000);assert.equal(f.audits[0].error_code,'invalid_model_output');
});
test('Provider quota, authentication, rate and access failures stay distinct without exposing upstream text',async()=>{
 for(const [providerError,providerStatus,code] of [['insufficient_quota',429,'provider_quota_exhausted'],['invalid_api_key',401,'provider_authentication_failed'],['rate_limit_exceeded',429,'provider_rate_limited'],['model_not_found',404,'provider_access_denied'],['invalid_parameter',400,'provider_invalid_request']]){
  const f=fixture({providerError,providerStatus});const r=await f.handler(req());const b=await r.json();
  assert.equal(r.status,502);assert.equal(b.code,code);assert.equal(f.audits[0].error_code,code);assert.ok(!JSON.stringify(b).includes('private upstream detail'));assert.equal(f.calls.filter(c=>c.url==='https://api.openai.com/v1/responses').length,1);
 }
});
test('Unknown origins, invalid workspace IDs and untrusted context fields cannot reach the provider',async()=>{
 const f=fixture();assert.equal((await f.handler(req(undefined,{Origin:'https://untrusted.invalid'}))).status,403);assert.equal(f.calls.length,0);
 const g=fixture();assert.equal((await g.handler(req({company_id:'../other'}))).status,400);assert.equal(g.calls.length,1);
 assert.throws(()=>checkedMetrics({...metrics,address:'not permitted'}));assert.deepEqual(usageRecord({}),{});
});
