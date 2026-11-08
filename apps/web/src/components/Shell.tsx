import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { Suspense, useState } from "react";
import { useAuth } from "../lib/auth";
import { useTenant } from "../lib/tenant";

const nav = [
  ["/", "Dashboard"],
  ["/properties", "Properties"],
  ["/assets", "Assets"],
  ["/inspections", "Inspections"],
  ["/works", "Works"],
  ["/reports", "Reports"],
  ["/regulatory", "Regulatory"],
  ["/intelligence", "Intelligence"],
  ["/portal", "Client Portal"]
];

export default function Shell() {
  const { signOut } = useAuth();
  const [signOutError, setSignOutError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  async function leave() {
    setSigningOut(true); setSignOutError("");
    try { await signOut(); }
    catch { setSignOutError("Unable to sign out. Check your connection and try again."); }
    finally { setSigningOut(false); }
  }
  const { tenants, activeTenant, loading, error, setActiveTenant } = useTenant();
  const { pathname } = useLocation();
  const customer = activeTenant?.isCustomer === true;
  const availableNav = customer ? nav.filter(([to]) => to === "/portal" || to === "/reports" || to === "/assets") : nav;
  const customerRoute = pathname === "/assets" || pathname === "/portal" || pathname === "/reports" || pathname.startsWith("/reports/");

  return <div className="app-shell">
    <aside>
      <div className="brand">ORION<span>ENTERPRISE</span></div>
      <a
        href="https://asuka247.uk/"
        className="home-link"
        aria-label="Back to ASUKA247 home page"
        style={{ display: "block", margin: "12px 0 16px", textDecoration: "none", fontWeight: 700 }}
      >← ASUKA247 Home</a>

      {tenants.length > 0 && (
        <select
          className="tenant-select"
          aria-label="Workspace"
          value={activeTenant?.id ?? ""}
          onChange={(e) => {
            const tenant = tenants.find(t => t.id === e.target.value);
            if (tenant) setActiveTenant(tenant);
          }}
        >
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      <nav>{availableNav.map(([to, label]) =>
        <NavLink key={to} to={to} end={to === "/"}>{label}</NavLink>
      )}</nav>

      <button className="signout" disabled={signingOut} onClick={leave}>{signingOut ? "Signing out…" : "Sign out"}</button>
      {signOutError && <p role="alert">{signOutError}</p>}
      <div className="aside-foot">ORION Enterprise v1.0</div>
    </aside>
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">COMPLIANCE OPERATING SYSTEM</div>
          <strong>{activeTenant?.name ?? "ORION Enterprise"}</strong>
        </div>
        <div className="pill">{activeTenant?.slug === "chiswick-cnc-demonstration" ? "Customer demonstration" : "ORION Enterprise"}</div>
      </header>
      <section className="content">
        {loading ? <div className="panel" role="status">Loading workspace…</div> :
          error ? <div className="warning" role="alert">{error}</div> :
          activeTenant ? customer && !customerRoute ? <Navigate to="/portal" replace /> : <div key={`${activeTenant.id}:${pathname}`}><Suspense fallback={<div className="panel" role="status">Loading page…</div>}><Outlet /></Suspense></div> :
          <div className="panel">Your account has no active workspace. Please contact ASUKA247 to arrange access.</div>}
      </section>
    </main>
  </div>;
}
