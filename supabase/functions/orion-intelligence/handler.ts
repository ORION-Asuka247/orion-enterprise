export const MODEL = 'gpt-5.4-mini-2026-03-17';
export const PROMPT_VERSION = 'orion-portfolio-2026-11-v1';
export const COST_BASIS = {currency:'USD',per_million_input:0.75,per_million_cached_input:0.075,per_million_output:4.5,checked_on:'2026-11-01'};
const metricNames = ['properties','assets','passed_inspections','failed_inspections','pending_inspections','open_defects','critical_defects','reports','issued_reports'];
const origins = new Set(['https://asuka247.eu','https://orion-enterprise.netlify.app']);
type Config = {supabaseUrl:string; anonKey:string; serviceKey:string; openaiKey:string};
type Fetch = typeof fetch;
export function checkedMetrics(value: any) {
  if (!value || Object.keys(value).length!==metricNames.length) throw new Error('invalid_metrics');
  const metrics: Record<string,number> = {};
  for (const k of metricNames) {
    if (!Number.isSafeInteger(value[k]) || value[k]<0) throw new Error('invalid_metrics');
    metrics[k]=value[k];
  }
  return metrics;
}
export function checkedResult(value:any) {
  const bounded=(v:any,max:number)=>typeof v==='string' && v.trim().length>0 && v.length<=max;
  if (!value || !bounded(value.summary,2000) || !Array.isArray(value.priorities) || value.priorities.length>5 ||
      !Array.isArray(value.limitations) || value.limitations.length>5) throw new Error('invalid_model_output');
  for (const p of value.priorities) if (!bounded(p.title,200) || !bounded(p.action,700) || !metricNames.includes(p.basis)) throw new Error('invalid_model_output');
  for (const p of value.limitations) if (!bounded(p,700)) throw new Error('invalid_model_output');
  return {summary:value.summary,priorities:value.priorities.map((p:any)=>({title:p.title,action:p.action,basis:p.basis})),limitations:value.limitations};
}
export function usageRecord(usage:any) {
  if (!Number.isSafeInteger(usage?.input_tokens) || !Number.isSafeInteger(usage?.output_tokens) || usage.input_tokens<0 || usage.output_tokens<0) return {};
  const cached=Math.min(usage.input_tokens,Math.max(0,Number.isSafeInteger(usage.input_tokens_details?.cached_tokens)?usage.input_tokens_details.cached_tokens:0));
  return {input_tokens:usage.input_tokens,cached_input_tokens:cached,output_tokens:usage.output_tokens,
    estimated_cost_usd:((usage.input_tokens-cached)*0.75+cached*0.075+usage.output_tokens*4.5)/1e6,cost_basis:COST_BASIS};
}
const schema={type:'object',properties:{summary:{type:'string'},priorities:{type:'array',items:{type:'object',properties:{title:{type:'string'},action:{type:'string'},basis:{type:'string',enum:metricNames}},required:['title','action','basis'],additionalProperties:false}},limitations:{type:'array',items:{type:'string'}}},required:['summary','priorities','limitations'],additionalProperties:false};
export function createHandler(config:Config,request:Fetch=fetch) {
  return async (req:Request):Promise<Response> => {
    const origin=req.headers.get('origin');
    const headers:Record<string,string>={'Content-Type':'application/json','Cache-Control':'no-store','Vary':'Origin'};
    if (origin && origins.has(origin)) Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info, x-retry-count, traceparent, tracestate, baggage','Access-Control-Allow-Methods':'GET, POST, OPTIONS'});
    const reply=(body:any,status=200)=>new Response(JSON.stringify(body),{status,headers});
    if (origin && !origins.has(origin)) return reply({error:'Origin not allowed'},403);
    if(req.method==='OPTIONS') return new Response(null,{status:204,headers});
    // Public health contains no records, credentials or usage data and cannot call the model.
    if(req.method==='GET') return reply({service:'orion-intelligence',configured:!!config.openaiKey,model:MODEL,prompt_version:PROMPT_VERSION,daily_call_limit:20});
    if(req.method!=='POST') return reply({error:'Method not allowed'},405);
    const authorization=req.headers.get('authorization') || '';
    if(!/^Bearer\s+\S+$/i.test(authorization)) return reply({error:'Sign in required'},401);
    if(!config.supabaseUrl || !config.anonKey || !config.serviceKey) return reply({error:'The intelligence service is not configured'},503);
    const userHeaders={apikey:config.anonKey,Authorization:authorization,'Content-Type':'application/json'};
    const serviceHeaders:Record<string,string>={apikey:config.serviceKey,'Content-Type':'application/json'};
    if(config.serviceKey.startsWith('eyJ')) serviceHeaders.Authorization=`Bearer ${config.serviceKey}`;
    let runId:string|null=null,companyId='',userId='',usage:any={}; const start=Date.now();
    async function finish(patch:any) {
      const res=await request(`${config.supabaseUrl}/rest/v1/orion_ai_runs?id=eq.${runId}&company_id=eq.${companyId}&actor_user_id=eq.${userId}&status=eq.pending`,{method:'PATCH',headers:{...serviceHeaders,Prefer:'return=representation'},body:JSON.stringify({...patch,completed_at:new Date().toISOString(),duration_ms:Date.now()-start,...usage}),signal:AbortSignal.timeout(10000)});
      if(!res.ok || (await res.json()).length!==1) throw new Error('audit_write_failed');
    }
    try {
      const auth=await request(`${config.supabaseUrl}/auth/v1/user`,{headers:userHeaders,signal:AbortSignal.timeout(10000)});
      if(!auth.ok) return reply({error:'Sign in required'},401);
      userId=(await auth.json()).id;
      if(!/^[0-9a-f-]{36}$/i.test(userId||'')) return reply({error:'Sign in required'},401);
      if(Number(req.headers.get('content-length')||0)>2048) return reply({error:'Request too large'},413);
      const raw=await req.text(); if(raw.length>2048) return reply({error:'Request too large'},413);
      let body:any;try{body=JSON.parse(raw);}catch{return reply({error:'Invalid request'},400);}
      companyId=body.company_id;
      if(typeof companyId!=='string' || !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(companyId)) return reply({error:'Select a valid workspace'},400);
      const context=await request(`${config.supabaseUrl}/rest/v1/rpc/orion_intelligence_context`,{method:'POST',headers:userHeaders,body:JSON.stringify({p_company_id:companyId}),signal:AbortSignal.timeout(10000)});
      if(!context.ok) return reply({error:'Staff intelligence permission required'},403);
      const metrics=checkedMetrics(await context.json());
      if(!config.openaiKey) return reply({error:'OpenAI is not activated. Add the server-side API key to enable analysis.',code:'not_configured'},503);
      const begin=await request(`${config.supabaseUrl}/rest/v1/rpc/orion_ai_begin_run`,{method:'POST',headers:serviceHeaders,body:JSON.stringify({p_company_id:companyId,p_actor_user_id:userId,p_model:MODEL,p_input_metrics:metrics}),signal:AbortSignal.timeout(10000)});
      if(!begin.ok) {
        const e=await begin.json().catch(()=>({}));
        return reply({error:/limit|cooldown/i.test(e.message||'')?'Pilot request limit reached. Please try later.':'Unable to reserve an audited AI request'},/limit|cooldown/i.test(e.message||'')?429:503);
      }
      runId=await begin.json();
      if(typeof runId!=='string' || !/^[0-9a-f-]{36}$/i.test(runId)) throw new Error('invalid_run_id');
      const result=await request('https://api.openai.com/v1/responses',{method:'POST',headers:{Authorization:`Bearer ${config.openaiKey}`,'Content-Type':'application/json'},body:JSON.stringify({model:MODEL,store:false,max_output_tokens:1200,reasoning:{effort:'none'},instructions:'You are the ASUKA247 ORION portfolio assistant. Use ONLY the supplied aggregate counts. Recommend up to five practical priorities with a basis metric. Be concise. Do not invent dates, addresses, costs, legal requirements, diagnoses or completed work. Do not claim an asset or portfolio is compliant. Explain missing information and human review needs. You cannot change records, approve work, issue certificates or send messages. This is advisory analysis, not a fire safety assessment.',input:JSON.stringify(metrics),text:{format:{type:'json_schema',name:'orion_portfolio_briefing',strict:true,schema}}}),signal:AbortSignal.timeout(45000)});
      if(!result.ok) throw new Error('provider_rejected');
      const provider=await result.json(); usage=usageRecord(provider.usage);
      if(provider.status!=='completed') throw new Error('provider_incomplete');
      const text=(provider.output||[]).filter((i:any)=>i.type==='message').flatMap((i:any)=>i.content||[]).filter((i:any)=>i.type==='output_text').map((i:any)=>i.text).join('');
      if(!text || text.length>14000) throw new Error('invalid_model_output');
      let value;try{value=checkedResult(JSON.parse(text));}catch{throw new Error('invalid_model_output');}
      await finish({status:'completed',result:value});
      return reply({run_id:runId,result:value,metrics,...usage,duration_ms:Date.now()-start,model:MODEL});
    } catch(e) {
      const allowed=['provider_rejected','provider_incomplete','invalid_model_output','audit_write_failed','invalid_metrics'];
      const code=e instanceof Error && allowed.includes(e.message)?e.message:'request_failed';
      if(runId) try{await finish({status:'failed',error_code:code});}catch{console.error('ORION AI audit finalisation failed',runId);}
      return reply({error:'Analysis could not be completed. No operational records were changed.',code,run_id:runId},502);
    }
  };
}
