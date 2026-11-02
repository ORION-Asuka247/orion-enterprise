import {useEffect,useState} from 'react';
import {supabase} from '../lib/supabase';
import {downloadVaultDocument} from '../lib/portal';

type SourceFile={filename:string;sha256:string;storage_path:string;bucket:string;kind:string};
type Photo=SourceFile & {photo_ref:number;source_page:number};
let signing=0;const waiting:(()=>void)[]=[];
async function photoUrl(path:string){
 if(signing>=6)await new Promise<void>(resolve=>waiting.push(resolve));
 signing++;
 try{if(!supabase)throw Error('Storage unavailable');const r=await supabase.storage.from('generated-documents').createSignedUrl(path,900);if(r.error)throw r.error;return r.data.signedUrl;}
 finally{signing--;waiting.shift()?.();}
}
function Photos({photos}:{photos:Photo[]}){
 const [rows,setRows]=useState<{photo:Photo;url:string}[]>([]);const [error,setError]=useState('');
 useEffect(()=>{let active=true;setRows([]);setError('');Promise.all(photos.map(async p=>({photo:p,url:await photoUrl(p.storage_path)}))).then(r=>{if(active)setRows(r);}).catch(()=>{if(active)setError('Some source photographs could not be loaded. Do not treat this as complete evidence.');});return()=>{active=false;};},[photos]);
 return <div className="report-evidence-grid">{error&&<p role="alert">{error}</p>}{!error&&rows.length<photos.length&&<p role="status">Loading source photographs…</p>}{rows.map(({photo:p,url})=><figure key={p.photo_ref}><img src={url} alt={`RPS photograph ${p.photo_ref}; original page ${p.source_page}`} onError={()=>setError('A source photograph is unavailable. Check storage before printing.')} /><figcaption>RPS photograph {p.photo_ref} · original page {p.source_page}</figcaption></figure>)}</div>;
}
function SourceFilesUpload({files,companyId}:{files:SourceFile[];companyId:string}){
 const [selected,setSelected]=useState<File[]>([]);const [progress,setProgress]=useState('');const [uploading,setUploading]=useState(false);const [error,setError]=useState('');
 async function upload(){
  if(!supabase||!selected.length)return;setUploading(true);setError('');let complete=0;const failures:string[]=[];let cursor=0;
  async function worker(){while(cursor<selected.length){const file=selected[cursor++];try{
   const expected=files.find(f=>f.filename===file.name);if(!expected||expected.bucket!=='generated-documents'||!expected.storage_path.startsWith(companyId+'/'))throw Error('Unexpected source file');
   const digest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await file.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');if(digest!==expected.sha256)throw Error('Checksum mismatch');
   const r=await supabase!.storage.from('generated-documents').upload(expected.storage_path,file,{upsert:false,contentType:file.type||'application/octet-stream'});
   if(r.error){const old=await supabase!.storage.from('generated-documents').download(expected.storage_path);if(old.error||!old.data)throw r.error;const oldDigest=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await old.data.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');if(oldDigest!==expected.sha256)throw Error('Existing file differs');}
   complete++;setProgress(`Verified ${complete} of ${selected.length} selected files`);
  }catch(e:any){failures.push(file.name+': '+(e?.message||'upload failed'));}}}
  await Promise.all(Array.from({length:4},worker));setUploading(false);if(failures.length)setError(failures.join('\n'));else setProgress(`Upload complete: ${complete} files verified. Photographs can now be opened below.`);
 }
 return <section className="panel no-print"><h2>Original source files</h2><p>Upload the retained PDFs and extracted photographs. Only the exact filenames and SHA256 hashes registered with this import are accepted. Files remain private.</p><label>Original RPS files and photographs<input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" disabled={uploading} onChange={e=>setSelected(Array.from(e.target.files||[]))}/></label><button type="button" disabled={uploading||!selected.length} onClick={upload}>{uploading?'Uploading source files…':'Upload and verify source files'}</button>{progress&&<p role="status">{progress}</p>}{error&&<p role="alert" style={{whiteSpace:'pre-wrap'}}>{error}</p>}</section>;
}
export default function HistoricFireDoorReport({snapshot:s,documentNumber,version,companyId,canUpload}:{snapshot:any;documentNumber:string;version:number;companyId:string;canUpload:boolean}){
 const source=s.historic_source;const doors:any[]=s.doors||[];const files:SourceFile[]=source.files||[];
 const [allPhotos,setAllPhotos]=useState(false);const [expanded,setExpanded]=useState<Record<string,boolean>>({});const [error,setError]=useState('');
 return <>
  <div className="warning">IMPORT TEST — HISTORIC RPS SOURCE. These are observations recorded in 2026 by RPS, not new ASUKA247 inspections or proof that faults remain open or have been repaired.</div>
  {canUpload&&<SourceFilesUpload files={files} companyId={companyId}/>}
  {error&&<p role="alert">{error}</p>}
  <div className="no-print panel"><button type="button" onClick={()=>setAllPhotos(v=>!v)}>{allPhotos?'Collapse all photographs':'Load all matched photographs for printing'}</button><p>For printing, load photographs and wait for loading messages to disappear. Retained originals include photographs not confidently linked to a door.</p></div>
  <article className="panel report-sheet historic-source-report">
   <div className="eyebrow">ASUKA247 · ORION · HISTORIC SOURCE REVIEW</div><h1>{source.property_name}</h1><p><b>{documentNumber}</b> · Version {version} · {source.provider} · {source.assessment_ref}</p>
   <p><b>Assessed:</b> {source.assessed_on} · <b>Approved:</b> {source.approved_on} · <b>Source export:</b> {source.exported_as_of}</p><p>{source.scope}</p>
   <h2>Source completeness and reconciliation</h2><p>{source.available_pages.length} of {source.expected_pages} original pages available. <b>Missing: pages 321–400 and 561–571.</b> Do not infer a satisfactory result, absence of faults or missing photographs from unavailable pages.</p>
   <p><b>{s.summary.assets}</b> action-plan door identifiers · <b>{s.summary.actions}</b> unique RPS action references · <b>{s.summary.detail_available}</b> doors with available detailed pages · <b>{s.summary.photo_links}</b> matched photograph links.</p>
   <p>Original severity, wording, dates and identifiers are preserved. All proposed work requires a current condition check, compatible repair evidence and appropriate authorisation. Replacement recommendations have not been converted to patch repairs. No pricing or compliance certification is produced by this source import.</p>
   <h2>Original survey documents</h2><ul>{files.filter(f=>f.kind==='document').map(f=><li key={f.filename}>{f.filename} <button className="no-print secondary" onClick={()=>downloadVaultDocument(f.storage_path,f.filename,companyId).catch(()=>setError('Source download failed. Check upload and access.'))}>Download original</button></li>)}</ul>
   <h2>RPS findings by door</h2>
   {doors.map(d=><section className="panel historic-door" key={d.asset_id}>
    <h3>{d.door_type} {d.source_door_id} — {d.floor} / {d.location}</h3><p><b>ORION:</b> {d.asset_code} · <b>Detailed source references:</b> {d.source_rps_refs.join(', ')||'Detail pages not available'}</p>
    <p><b>Recorded RPS condition:</b> {d.recorded_conditions.join('; ')||'Not available in supplied detailed pages'}. <b>Current status:</b> not verified.</p>
    {d.actions.map((a:any)=><div className="historic-action" key={a.reference}><h4>{a.reference} · {a.severity}</h4><p style={{whiteSpace:'pre-line'}}>{a.description}</p><p><b>RPS due field:</b> {a.due_text||'Not stated'} · <b>Original action-plan page:</b> {a.source_page}</p></div>)}
    <p><b>Available detailed pages:</b> {d.detail_pages.join(', ')||'Not supplied / not confidently matched'}. <b>Photograph references unavailable:</b> {d.unavailable_photo_refs.join(', ')||'None identified among referenced photographs'}.</p>
    {d.photos.length>0?<><button className="secondary no-print" type="button" onClick={()=>setExpanded(v=>({...v,[d.asset_id]:!v[d.asset_id]}))}>{expanded[d.asset_id]?'Hide':'Show'} {d.photos.length} matched RPS photographs</button>{(allPhotos||expanded[d.asset_id])&&<Photos photos={d.photos}/>}</>:<p>No source photograph can be confidently attached from the supplied pages. This does not mean no photographs were taken.</p>}
   </section>)}
   <h2>Fault / Risk / Action / Evidence / Who</h2><p><b>Fault:</b> RPS source descriptions are retained above. <b>Risk:</b> historic source severities do not establish present risk. <b>Action:</b> verify current conditions and agree an evidenced scope. <b>Evidence:</b> original PDFs, source page numbers and photograph identifiers. <b>Who:</b> CNC management and its appointed competent advisers/contractors must confirm responsibility and authorisation.</p>
  </article>
 </>;
}
