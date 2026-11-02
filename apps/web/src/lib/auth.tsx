
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  passwordSetup: boolean;
  finishPasswordSetup(): void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [passwordSetup,setPasswordSetup] = useState(window.location.pathname.endsWith("/setup-password"));

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    let active = true, authVersion = 0;
    const initialVersion = authVersion;
    supabase.auth.getSession().then(({ data }) => {
      if (!active || authVersion !== initialVersion) return;
      setSession(data.session ?? null); setLoading(false);
    }).catch(() => { if (active && authVersion === initialVersion) { setSession(null); setLoading(false); } });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      authVersion++;
      if (_event === "PASSWORD_RECOVERY") setPasswordSetup(true);
      if (active) { setSession(next); setLoading(false); }
    });

    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    passwordSetup,
    finishPasswordSetup(){setPasswordSetup(false);window.history.replaceState({}, "", import.meta.env.BASE_URL);},
    user: session?.user ?? null,
    loading,
    async signIn(email, password) {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      if (!supabase) return;
      await supabase.auth.signOut();
    }
  }), [session, loading, passwordSetup]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
