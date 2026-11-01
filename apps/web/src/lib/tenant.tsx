
import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "./supabase";
import { useAuth } from "./auth";
import { resolveTenant } from "./tenantSelection";

export type Tenant = {
  id: string;
  name: string;
  slug: string;
};

type TenantContextValue = {
  tenants: Tenant[];
  activeTenant: Tenant | null;
  loading: boolean;
  setActiveTenant(tenant: Tenant): void;
};

const TenantContext = createContext<TenantContextValue | null>(null);

export function TenantProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [activeTenant, setActiveTenantState] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function load() {
      if (!user || !supabase) {
        setTenants([]);
        setActiveTenantState(null);
        return;
      }

      setLoading(true);
      const { data, error } = await supabase
        .from("company_memberships")
        .select("company_id, companies(id,name,slug)")
        .eq("user_id", user.id)
        .eq("status", "active");

      if (error) {
        setLoading(false);
        throw error;
      }

      const next = (data ?? [])
        .map((row: any) => row.companies)
        .filter(Boolean) as Tenant[];

      setTenants(next);
      let preferredId: string | null = null;
      try { preferredId = localStorage.getItem(`orion:tenant:${user.id}`); } catch { /* Storage may be unavailable in private browsing. */ }
      setActiveTenantState(resolveTenant(next, preferredId));
      setLoading(false);
    }

    load();
  }, [user?.id]);

  function setActiveTenant(tenant: Tenant) {
    const allowed = tenants.find(t => t.id === tenant.id);
    if (!allowed || !user) return;
    setActiveTenantState(allowed);
    try { localStorage.setItem(`orion:tenant:${user.id}`, allowed.id); } catch { /* Session remains usable without persistence. */ }
  }

  return (
    <TenantContext.Provider value={{ tenants, activeTenant, loading, setActiveTenant }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant must be used inside TenantProvider");
  return ctx;
}
