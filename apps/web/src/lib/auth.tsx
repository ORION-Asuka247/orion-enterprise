
import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "./supabase";
import { watchVerifiedSession } from "./authSession";

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  error: string;
  passwordSetup: boolean;
  finishPasswordSetup(): void;
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [passwordSetup,setPasswordSetup] = useState(window.location.pathname.endsWith("/setup-password"));

  useEffect(() => {
    if (!supabase) {
      setError("Sign-in is unavailable because the app connection is not configured.");
      setLoading(false);
      return;
    }

    return watchVerifiedSession(supabase.auth, state => {
      setSession(state.session);
      setLoading(state.loading);
      setError(state.error);
    }, () => setPasswordSetup(true));
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    session,
    passwordSetup,
    finishPasswordSetup(){setPasswordSetup(false);window.history.replaceState({}, "", import.meta.env.BASE_URL);},
    user: session?.user ?? null,
    loading,
    error,
    async signIn(email, password) {
      if (!supabase) throw new Error("Supabase is not configured.");
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async signOut() {
      if (!supabase) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setSession(null);
      setPasswordSetup(false);
    }
  }), [session, loading, passwordSetup, error]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
