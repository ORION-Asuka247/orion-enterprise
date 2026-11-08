
import { FormEvent, useState } from "react";
import {supabase} from "../lib/supabase";
import { useAuth } from "../lib/auth";

export default function Login() {
  const { signIn, error: sessionError } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [recovering,setRecovering]=useState(false);
  const [notice,setNotice]=useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      if(recovering){
        if(!supabase)throw Error('Sign-in service unavailable.');
        const {error}=await supabase.auth.resetPasswordForEmail(email,{redirectTo:new URL(import.meta.env.BASE_URL+'setup-password',window.location.origin).href});
        if(error)throw error;
        setNotice('If an account exists for this email, a password reset link will be sent.');
      }else await signIn(email, password);
    } catch (err: any) {
      setError(err?.message ?? "Unable to sign in.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="brand">ORION<span>ENTERPRISE</span></div>
        <div className="eyebrow">SECURE ACCESS</div>
        <h1>{recovering?"Reset your password":"Sign in"}</h1>
        <label htmlFor="orion-email">Email</label>
        <input id="orion-email" autoComplete="username" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
        {!recovering&&<><label htmlFor="orion-password">Password</label>
        <input id="orion-password" autoComplete="current-password" type="password" value={password} onChange={e => setPassword(e.target.value)} required /></>}
        {(error || sessionError) && <div className="warning" role="alert">{error || sessionError}</div>}
        {notice&&<p role="status">{notice}</p>}
        <button disabled={busy}>{busy ? "Please wait…" : recovering?"Send reset link":"Sign in"}</button>
        <button type="button" className="secondary" disabled={busy} onClick={()=>{setRecovering(!recovering);setError('');setNotice('');setPassword('');}}>{recovering?'Back to sign in':'Forgot password?'}</button>
      </form>
    </div>
  );
}
