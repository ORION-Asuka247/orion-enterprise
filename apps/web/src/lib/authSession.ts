import type { Session, SupabaseClient } from "@supabase/supabase-js";

export type AuthState = { session: Session | null; loading: boolean; error: string };

/** Local storage is a session hint; only Auth can verify the current identity. */
export function watchVerifiedSession(
  auth: SupabaseClient["auth"],
  update: (state: AuthState) => void,
  recovery: () => void
) {
  let active = true;
  let version = 0;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  async function verify(session: Session | null, request: number) {
    if (!active || request !== version) return;
    if (!session) {
      update({ session: null, loading: false, error: "" });
      return;
    }
    update({ session: null, loading: true, error: "" });
    try {
      const { data, error } = await auth.getUser(session.access_token);
      if (!active || request !== version) return;
      if (error || !data.user || data.user.id !== session.user.id) throw error ?? new Error("Invalid session");
      update({ session: { ...session, user: data.user }, loading: false, error: "" });
    } catch {
      if (active && request === version) {
        update({ session: null, loading: false, error: "We could not verify your session. Sign in again or refresh to retry." });
      }
    }
  }

  // Keep Auth calls outside the synchronous Auth event callback.
  const { data: { subscription } } = auth.onAuthStateChange((event, session) => {
    const request = ++version;
    if (!active) return;
    if (event === "PASSWORD_RECOVERY") recovery();
    if (!session) {
      update({ session: null, loading: false, error: "" });
      return;
    }
    update({ session: null, loading: true, error: "" });
    const timer = setTimeout(() => {
      timers.delete(timer);
      void verify(session, request);
    }, 0);
    timers.add(timer);
  });

  const initialVersion = version;
  void auth.getSession().then(({ data, error }) => {
    if (!active || version !== initialVersion) return;
    if (error) throw error;
    return verify(data.session, initialVersion);
  }).catch(() => {
    if (active && version === initialVersion) {
      update({ session: null, loading: false, error: "We could not load your session. Sign in again or refresh to retry." });
    }
  });

  return () => {
    active = false;
    version++;
    timers.forEach(clearTimeout);
    subscription.unsubscribe();
  };
}
