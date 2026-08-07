
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";
import { useTenant } from "../lib/tenant";

const nav = [
  ["/","Dashboard"],
  ["/properties","Properties"],
  ["/assets","Assets"],
  ["/inspections","Inspections"],
  ["/works","Works"],
  ["/reports","Reports"],
  ["/regulatory","Regulatory"],
  ["/intelligence","AI Intelligence"],
  ["/portal","Client Portal"]
];

export default function Shell(){
  const { signOut } = useAuth();
  const { tenants, activeTenant, setActiveTenant } = useTenant();

  return <div className="app-shell">
    <aside>
      <div className="brand">ORION<span>ENTERPRISE</span></div>

      {tenants.length > 0 && (
        <select className="tenant-select"
          value={activeTenant?.id ?? ""}
          onChange={(e) => {
            const tenant = tenants.find(t => t.id === e.target.value);
            if (tenant) setActiveTenant(tenant);
          }}>
          {tenants.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      )}

      <nav>{nav.map(([to,label]) =>
        <NavLink key={to} to={to} end={to==="/"}>
          {label}
        </NavLink>
      )}</nav>

      <button className="signout" onClick={() => signOut()}>Sign out</button>
      <div className="aside-foot">v1.0.0 Implementation</div>
    </aside>
    <main>
      <header className="topbar">
        <div>
          <div className="eyebrow">COMPLIANCE OPERATING SYSTEM</div>
          <strong>{activeTenant?.name ?? "ORION Enterprise"}</strong>
        </div>
        <div className="pill">Development</div>
      </header>
      <section className="content"><Outlet/></section>
    </main>
  </div>
}
