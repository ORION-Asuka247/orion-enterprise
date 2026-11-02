import {useEffect,useMemo,useState} from 'react';
import {Link} from 'react-router-dom';
import Page from '../components/Page';
import {supabase} from '../lib/supabase';
import {useTenant} from '../lib/tenant';

export default function CustomerAssets(){
 const {activeTenant}=useTenant();const [rows,setRows]=useState<any[]>([]);const [search,setSearch]=useState('');const [error,setError]=useState('');const [loading,setLoading]=useState(true);
 useEffect(()=>{let current=true;setLoading(true);setRows([]);setError('');
  async function load(){
   if(!supabase||!activeTenant)throw Error('Workspace unavailable.');
   const r=await supabase.from('assets').select('id,asset_code,name,condition,historic_rps:metadata->historic_rps,properties(name)').eq('company_id',activeTenant.id).order('asset_code');
   if(r.error)throw r.error;if(current)setRows(r.data||[]);
  }
  load().catch(()=>{if(current)setError('Unable to load the asset register. Please refresh or contact ASUKA247.');}).finally(()=>{if(current)setLoading(false);});return()=>{current=false;};
 },[activeTenant?.id]);
 const filtered=useMemo(()=>{const q=search.trim().toLowerCase();return rows.filter(a=>JSON.stringify([a.asset_code,a.name,a.properties?.name,a.historic_rps?.floor,a.historic_rps?.location,a.historic_rps?.source_door_id,a.historic_rps?.actions]).toLowerCase().includes(q));},[rows,search]);
 const actions=rows.reduce((n,a)=>n+(a.historic_rps?.actions?.length||0),0);
 return <Page title="Your asset register" kicker="CUSTOMER WORKSPACE">
  <p>Search your available asset records by door identifier, floor, location or recorded finding.</p>
  <div className="inspection-progress"><div><span>Available asset records</span><strong>{rows.length}</strong></div><div><span>Historic source actions</span><strong>{actions}</strong></div><div><span>Current condition</span><strong>Not verified</strong></div></div>
  <div className="warning">Historic RPS records describe the original survey, not a new inspection or confirmation that work remains outstanding. Source completeness and reconciliation limitations are shown in the controlled report.</div>
  <label>Search asset records<input type="search" value={search} onChange={e=>setSearch(e.target.value)}/></label>
  <p><Link to="/reports">View controlled reports and photographic evidence</Link></p>
  {loading?<p role="status">Loading your assets…</p>:error?<p role="alert">{error}</p>:<><p>{filtered.length} of {rows.length} records shown</p>{filtered.map(a=>{const d=a.historic_rps;return <section className="panel" key={a.id}><h2>{a.asset_code} · {d?.source_door_id||a.name}</h2><p>{a.properties?.name} · {d?.floor||'Floor not recorded'} / {d?.location||'Location not recorded'}</p><p>Current condition: not verified</p>{d&&<><p>{d.actions.length} historic source action(s) · {d.photos.length} matched photograph(s)</p><details><summary>View original findings</summary>{d.actions.length?d.actions.map((v:any)=><div key={v.reference}><h3>{v.reference} · {v.severity}</h3><p style={{whiteSpace:'pre-line'}}>{v.description}</p></div>):<p>No actions recorded in this source entry. Current condition still requires verification.</p>}</details></>}</section>;})}</>}
 </Page>;
}
