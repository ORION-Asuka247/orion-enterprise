import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';

type Briefing={summary:string;priorities:{title:string;action:string;basis:string}[];limitations:string[]};
type Run={id:string;created_at:string;status:string;model:string;duration_ms:number|null;input_tokens:number|null;output_tokens:number|null;estimated_cost_usd:number|null;error_code:string|null;input_metrics:Record<string,number>;result:Briefing|null};
export default function IntelligenceAssistant({companyId}:{companyId:string}) {
 const [allowed,setAllowed]=useState(false),[configured,setConfigured]=useState(false),[checking,setChecking]=useState(true),[busy,setBusy]=useState(false);
 const [runs,setRuns]=useState<Run[]>([]),[selected,setSelected]=useState<Run|null>(null),[error,setError]=useState('');
 async function history() {
  if(!supabase)return [];
  const r=await supabase.from('orion_ai_runs').select('id,created_at,status,model,duration_ms,input_tokens,output_tokens,estimated_cost_usd,error_code,input_metrics,result').eq('company_id',companyId).order('created_at',{ascending:false}).limit(20);
  if(r.error)throw new Error('Unable to load the AI activity log.');
  return (r.data??[]) as Run[];
 }
 useEffect(()=>{
  let live=true;
  (async()=>{
   if(!supabase)return;
   const access=await supabase.rpc('has_permission',{target_company:companyId,permission_code:'report.generate'});
   if(!live)return;
   setAllowed(access.data===true);
   if(access.data!==true){setChecking(false);return;}
   try {
    const [health,items]=await Promise.all([supabase.functions.invoke('orion-intelligence',{method:'GET'}),history()]);
    if(!live)return;
    if(health.error)throw new Error('The AI connection check failed. Your portfolio records are still available.');
    setConfigured(health.data?.configured===true);setRuns(items);setSelected(items.find(r=>r.status==='completed'&&r.result)||null);
   }catch(e:any){if(live)setError(e.message);}finally{if(live)setChecking(false);}
  })();
  return()=>{live=false;};
 },[companyId]);
 async function generate() {
  if(!supabase||busy||!configured)return;
  setBusy(true);setError('');
  try {
   const r=await supabase.functions.invoke('orion-intelligence',{body:{company_id:companyId}});
   if(r.error){let message='AI analysis failed. Check the activity log before trying again.';try{const b=await r.error.context?.json();if(b?.error)message=b.error;}catch{}throw new Error(message);}
   const items=await history();setRuns(items);setSelected(items.find(i=>i.id===r.data.run_id)||null);
  }catch(e:any){setError(e.message);try{setRuns(await history());}catch{}}
  finally{setBusy(false);}
 }
 if(!allowed)return null;
 const completed=runs.filter(r=>r.status==='completed');
 const timed=completed.filter(r=>r.duration_ms!==null);
 const priced=runs.filter(r=>r.estimated_cost_usd!==null);
 const cost=priced.reduce((s,r)=>s+Number(r.estimated_cost_usd),0);
 return <section className="panel" aria-label="ORION AI assistant">
  <div className="eyebrow">ORION AI ASSISTANT</div>
  <h2>Portfolio briefing &amp; activity</h2>
  <p>{checking?'Checking AI service…':configured?'API key configured. Generate a briefing to verify a live AI response.':'Awaiting API activation. Your live portfolio metrics remain available above.'}</p>
  <p className="muted">Briefings use the selected workspace’s aggregate counts. Names, addresses, photographs and commercial rates are excluded. Recommendations require human review and cannot approve work or certify compliance.</p>
  <button type="button" disabled={checking||busy||!configured} onClick={generate}>{busy?'Analysing portfolio…':'Generate AI briefing'}</button>
  <p><small>Pilot limit: 20 requests per workspace per UTC day, with a 15-second pause between requests. Usage is recorded below.</small></p>
  {error&&<div role="alert" className="warning">{error}</div>}
  <div className="inspection-progress">
   <div><span>Recent requests (up to 20)</span><strong>{runs.length}</strong></div>
   <div><span>Completed / failed</span><strong>{completed.length} / {runs.filter(r=>r.status==='failed').length}</strong></div>
   <div><span>Average completed response</span><strong>{timed.length?`${(timed.reduce((s,r)=>s+(r.duration_ms||0),0)/timed.length/1000).toFixed(1)}s`:'—'}</strong></div>
   <div><span>Estimated cost of priced runs</span><strong>{priced.length?`US$${cost.toFixed(5)}`:'—'}</strong></div>
  </div>
  {selected?.result&&<article className="panel">
   <div className="eyebrow">AI DRAFT · {new Date(selected.created_at).toLocaleString()}</div>
   <h3>Portfolio priorities</h3><p>{selected.result.summary}</p>
   <ol>{selected.result.priorities.map((p,i)=><li key={i}><strong>{p.title}</strong><p>{p.action}<br/><small>Based on: {p.basis.replace(/_/g,' ')}</small></p></li>)}</ol>
   <h4>Limits of this briefing</h4><ul>{selected.result.limitations.map((p,i)=><li key={i}>{p}</li>)}</ul>
   <details><summary>Counts used for this briefing</summary><ul>{Object.entries(selected.input_metrics).map(([k,v])=><li key={k}>{k.replace(/_/g,' ')}: {v}</li>)}</ul></details>
  </article>}
  <h3>AI activity log</h3>
  {runs.length===0?<p>No AI requests have been recorded for this workspace. No successful AI connection is claimed yet.</p>:<ul className="clean">{runs.map(r=><li key={r.id}><b>{r.status.toUpperCase()}</b><span>{new Date(r.created_at).toLocaleString()} · {r.model}<br/><small>{r.duration_ms===null?'Time pending':`${(r.duration_ms/1000).toFixed(1)}s`} · Input {r.input_tokens??'—'} / output {r.output_tokens??'—'} tokens · {r.estimated_cost_usd===null?'Cost not available':`Estimated US$${Number(r.estimated_cost_usd).toFixed(6)}`}{r.error_code?` · ${r.error_code}`:''}</small>{r.result&&<><br/><button type="button" className="secondary" onClick={()=>setSelected(r)}>View briefing</button></>}</span></li>)}</ul>}
  <small>Cost estimates use provider-reported tokens and the stored model rate. They exclude tax, exchange rates and unrelated provider charges; the provider invoice is authoritative. Pending entries may indicate an interrupted request.</small>
 </section>;
}
