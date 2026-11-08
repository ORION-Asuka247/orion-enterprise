import {FormEvent,useState} from 'react';
import {supabase} from '../lib/supabase';
import {useAuth} from '../lib/auth';
export default function PasswordSetup(){
 const {finishPasswordSetup,signOut}=useAuth();const [password,setPassword]=useState('');const [confirm,setConfirm]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState('');
 async function leave(){setBusy(true);setError('');try{await signOut();}catch{setError('Unable to sign out. Check your connection and try again.');}finally{setBusy(false);}}
 async function submit(e:FormEvent){e.preventDefault();setError('');if(password!==confirm){setError('The passwords do not match.');return;}setBusy(true);
  try{if(!supabase)throw Error('Sign-in service unavailable.');const r=await supabase.auth.updateUser({password});if(r.error)throw r.error;setPassword('');setConfirm('');finishPasswordSetup();window.location.assign(import.meta.env.BASE_URL);}
  catch{setError('Unable to save your password. Check the password requirements or request a fresh reset link.');}finally{setBusy(false);}
 }
 return <div className="login-screen"><form className="login-card" onSubmit={submit}><div className="brand">ORION<span>ENTERPRISE</span></div><h1>Set your password</h1><p>Choose a unique password with at least 12 characters.</p><label>New password<input type="password" autoComplete="new-password" minLength={12} value={password} onChange={e=>setPassword(e.target.value)} required/></label><label>Confirm password<input type="password" autoComplete="new-password" minLength={12} value={confirm} onChange={e=>setConfirm(e.target.value)} required/></label>{error&&<p role="alert">{error}</p>}<button disabled={busy}>{busy?'Saving…':'Save password and continue'}</button><button type="button" className="secondary" disabled={busy} onClick={leave}>Sign out</button></form></div>;
}
