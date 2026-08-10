import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import Page from "../components/Page";
import { loadDefects, updateDefect, type OrionDefect, type OrionDefectStatus } from "../lib/defects";
import { consolidateRemedials } from "../lib/remedials";
import { priceRemedialPackages, RATE_PROFILES, type ClientRateProfile } from "../lib/pricing";
import { canViewCommercialPricing, COMMERCIAL_PRICING_PERMISSION } from "../lib/commercialAccess";
import { useAuth } from "../lib/auth";
import { useTenant } from "../lib/tenant";

const statusOrder: OrionDefectStatus[] = ["open", "assigned", "in_progress", "resolved", "verified", "closed", "cancelled"];

function label(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function money(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

export default function Works() {
  const { activeTenant } = useTenant();
  const { user } = useAuth();
  const commercialAccess = canViewCommercialPricing(user);
  const [rows, setRows] = useState<OrionDefect[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "resolved">("active");
  const [busy, setBusy] = useState("");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [showPackages, setShowPackages] = useState(true);
  const [rateProfile, setRateProfile] = useState<ClientRateProfile>("standard");

  async function refresh() {
    if (!activeTenant) {
      setRows([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError("");
    try {
      setRows(await loadDefects(activeTenant.id));
    } catch (e: any) {
      setError(e?.message || "Unable to load defects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { refresh(); }, [activeTenant]);

  const counts = useMemo(() => ({
    total: rows.length,
    critical: rows.filter(r => r.severity === "critical" && !["closed", "cancelled"].includes(r.status)).length,
    active: rows.filter(r => !["resolved", "verified", "closed", "cancelled"].includes(r.status)).length,
    resolved: rows.filter(r => ["resolved", "verified", "closed"].includes(r.status)).length
  }), [rows]);

  const packages = useMemo(() => consolidateRemedials(rows), [rows]);
  const packagesNeedingReview = useMemo(() => packages.filter(p => p.requiresReview).length, [packages]);
  const technicalActions = useMemo(() => packages.reduce((sum, p) => sum + p.actions.length, 0), [packages]);
  const pricing = useMemo(() => priceRemedialPackages(packages, rateProfile), [packages, rateProfile]);
  const activeRate = RATE_PROFILES[rateProfile];

  const visible = useMemo(() => rows.filter(row => {
    if (filter === "all") return true;
    if (filter === "active") return !["resolved", "verified", "closed", "cancelled"].includes(row.status);
    return ["resolved", "verified", "closed"].includes(row.status);
  }), [rows, filter]);

  async function changeStatus(row: OrionDefect, status: OrionDefectStatus) {
    setBusy(row.id);
    setError("");
    try {
      await updateDefect({
        defectId: row.id,
        status,
        remedialNotes: notes[row.id] || null,
        resolutionNotes: status === "resolved" ? (notes[row.id] || null) : null
      });
      await refresh();
    } catch (e: any) {
      setError(e?.message || "Unable to update defect.");
    } finally {
      setBusy("");
    }
  }

  return (
    <Page title="Works & remedials" kicker="OPERATIONS">
      <div className="inspection-progress panel">
        <div><span>Total defects</span><strong>{counts.total}</strong></div>
        <div><span>Active</span><strong>{counts.active}</strong></div>
        <div><span>Critical</span><strong>{counts.critical}</strong></div>
        <div><span>Resolved</span><strong>{counts.resolved}</strong></div>
      </div>

      <section className="panel">
        <div className="page-toolbar">
          <div>
            <div className="eyebrow">REMEDIAL CONSOLIDATION ENGINE</div>
            <h2>{packages.length} asset work packages from {counts.active} active defects</h2>
            <p className="muted">
              ORION groups all active findings by asset, then converts the source findings into one technical repair package per asset before any commercial calculation is permitted.
            </p>
          </div>
          <button type="button" className="secondary" onClick={() => setShowPackages(v => !v)}>
            {showPackages ? "Hide packages" : "Show packages"}
          </button>
        </div>

        <div className="inspection-progress">
          <div><span>Packages</span><strong>{packages.length}</strong></div>
          <div><span>Technical actions</span><strong>{technicalActions}</strong></div>
          <div><span>Manual review</span><strong>{packagesNeedingReview}</strong></div>
          <div><span>Commercial status</span><strong>{commercialAccess ? `${pricing.readyCount} PRICE READY` : "RESTRICTED"}</strong></div>
        </div>

        <div className="warning" style={{ marginTop: 16 }}>
          Commercial control: ORION must not derive a quotation from raw defect count. Technical findings are consolidated by asset first; internal rate selection, material allowances and selling price are separate approval stages.
        </div>

        {commercialAccess && (
          <section className="panel" style={{ marginTop: 18 }}>
            <div className="eyebrow">INTERNAL ASUKA247 COMMERCIAL CONTROL — AUTHORISED USERS ONLY</div>
            <div className="page-toolbar">
              <div>
                <h3>Client rate profile</h3>
                <p className="muted">Select the commercial profile that applies to the client account. Internal rates, allowances and selling calculations are excluded from engineer and client views.</p>
              </div>
              <label className="inspection-field" style={{ minWidth: 280 }}>
                Rate profile
                <select value={rateProfile} onChange={e => setRateProfile(e.target.value as ClientRateProfile)}>
                  <option value="standard">Standard client rate</option>
                  <option value="account_package">Account / package-holder rate</option>
                </select>
              </label>
            </div>

            <div className="inspection-progress">
              <div><span>Labour rate</span><strong>{money(activeRate.hourlyRate)}/hr</strong></div>
              <div><span>Minimum labour</span><strong>{money(activeRate.minimumCharge)}</strong></div>
              <div><span>Billing increment</span><strong>{activeRate.billingIncrementMinutes} min</strong></div>
              <div><span>Commercial profile</span><strong>{rateProfile === "account_package" ? "ACCOUNT" : "STANDARD"}</strong></div>
            </div>

            <p className="muted">{activeRate.internalNote}</p>

            <div className="inspection-progress" style={{ marginTop: 12 }}>
              <div><span>Price ready</span><strong>{pricing.readyCount}</strong></div>
              <div><span>Price review required</span><strong>{pricing.reviewCount}</strong></div>
              <div><span>Ready-package labour</span><strong>{money(pricing.labour)}</strong></div>
              <div><span>Ready-package materials</span><strong>{money(pricing.materials)}</strong></div>
              <div><span>Ready-package total</span><strong>{money(pricing.total)}</strong></div>
            </div>

            {pricing.reviewCount > 0 && (
              <div className="warning" style={{ marginTop: 12 }}>
                ORION is withholding a complete quotation because {pricing.reviewCount} package{pricing.reviewCount === 1 ? "" : "s"} contain unapproved action rates or require technical review. No incomplete package is included in the displayed price-ready total.
              </div>
            )}
          </section>
        )}

        {!commercialAccess && (
          <div className="panel" style={{ marginTop: 18 }}>
            <div className="eyebrow">COMMERCIAL INFORMATION RESTRICTED</div>
            <p className="muted">Internal ASUKA247 rates, account discounts, material allowances and selling calculations require the <strong>{COMMERCIAL_PRICING_PERMISSION}</strong> permission. Technical remedial packages remain available for operational use.</p>
          </div>
        )}

        {showPackages && packages.length > 0 && (
          <div className="inspection-question-list" style={{ marginTop: 18 }}>
            {(commercialAccess ? pricing.priced : packages.map(pkg => ({ package: pkg, priceReady: false, labourMinutes: 0, materialsCharge: 0, totalCharge: 0, missingRates: [] as string[] }))).map(row => {
              const pkg = row.package;
              return (
                <section className="panel inspection-question" key={pkg.assetId}>
                  <div className="inspection-question-header">
                    <div>
                      <div className="eyebrow">
                        {pkg.sourceDoorId || pkg.assetCode} · {pkg.severity.toUpperCase()} · {pkg.defectCodes.length} SOURCE DEFECT{pkg.defectCodes.length === 1 ? "" : "S"}
                      </div>
                      <h3>{pkg.assetName || pkg.assetCode}</h3>
                    </div>
                    <span className={`inspection-result result-${commercialAccess && row.priceReady ? "pass" : pkg.requiresReview ? "fail" : "na"}`}>
                      {commercialAccess ? (row.priceReady ? "PRICE READY" : pkg.requiresReview ? "TECH REVIEW" : "PRICE REVIEW") : (pkg.requiresReview ? "TECH REVIEW" : "CONSOLIDATED")}
                    </span>
                  </div>

                  <div>
                    <strong>Source findings</strong>
                    {pkg.findings.map((finding, index) => <p key={`${pkg.assetId}-finding-${index}`}>{finding}</p>)}
                  </div>

                  <div className="failure-reason">
                    <strong>Consolidated remedial package</strong>
                    {pkg.actions.length === 0 ? (
                      <p>No deterministic remedial rule matched this finding. Competent-person review is required before pricing.</p>
                    ) : (
                      <ol>
                        {pkg.actions.map(action => <li key={`${pkg.assetId}-${action.code}`}>{action.label}</li>)}
                      </ol>
                    )}
                  </div>

                  {commercialAccess && (
                    <>
                      <div className="inspection-progress" style={{ marginTop: 12 }}>
                        <div><span>Labour allowance</span><strong>{row.labourMinutes ? `${row.labourMinutes} min` : "Pending"}</strong></div>
                        <div><span>Materials</span><strong>{row.priceReady ? money(row.materialsCharge) : "Pending"}</strong></div>
                        <div><span>Internal selling price</span><strong>{row.priceReady ? money(row.totalCharge) : "WITHHELD"}</strong></div>
                      </div>

                      {row.missingRates.length > 0 && (
                        <div className="warning" style={{ marginTop: 12 }}>
                          Price review required for: {row.missingRates.join(", ")}.
                        </div>
                      )}
                    </>
                  )}

                  <div className="inspection-actions">
                    <Link className="button-link secondary-link" to={`/assets/${pkg.assetId}`}>Asset record</Link>
                  </div>
                </section>
              );
            })}
          </div>
        )}
      </section>

      <div className="page-toolbar">
        <div>
          <h2>Defect & remedial register</h2>
          <p className="muted">Failed controlled inspection items remain individually auditable beneath the consolidated work packages.</p>
        </div>
        <div className="inspection-choice-grid">
          {(["active", "resolved", "all"] as const).map(value => (
            <button key={value} type="button" className={filter === value ? "choice-selected" : "secondary"} onClick={() => setFilter(value)}>
              {label(value)}
            </button>
          ))}
        </div>
      </div>

      {error && <div className="warning">{error}</div>}
      {loading && <div className="panel">Loading remedial actions...</div>}

      {!loading && !error && visible.length === 0 && (
        <div className="panel">
          <h2>No matching defects</h2>
          <p>Defects are created automatically when a controlled inspection item fails.</p>
          <Link className="button-link" to="/inspections">Open inspections</Link>
        </div>
      )}

      {!loading && visible.length > 0 && (
        <div className="inspection-question-list">
          {visible.map(row => (
            <section className="panel inspection-question" key={row.id}>
              <div className="inspection-question-header">
                <div>
                  <div className="eyebrow">{row.defect_code} · {row.severity.toUpperCase()}</div>
                  <h2>{row.title}</h2>
                  <p>{row.description}</p>
                  <p className="muted">
                    Asset: {row.assets?.asset_code || row.asset_id}
                    {row.assets?.name ? ` — ${row.assets.name}` : ""}
                    {row.target_date ? ` · Target ${new Date(row.target_date).toLocaleDateString()}` : ""}
                  </p>
                </div>
                <span className={`inspection-result result-${row.status === "resolved" || row.status === "verified" || row.status === "closed" ? "pass" : row.severity === "critical" ? "fail" : "na"}`}>
                  {label(row.status).toUpperCase()}
                </span>
              </div>

              {row.suggested_action && (
                <div className="failure-reason">
                  <strong>Recommended action</strong>
                  <p>{row.suggested_action}</p>
                </div>
              )}

              <label className="inspection-field">
                Remedial / resolution notes
                <textarea
                  value={notes[row.id] ?? row.remedial_notes ?? row.resolution_notes ?? ""}
                  onChange={e => setNotes(current => ({ ...current, [row.id]: e.target.value }))}
                  placeholder="Record attendance, remedial works, materials used, access issues or completion evidence notes."
                />
              </label>

              <div className="inspection-actions">
                <Link className="button-link secondary-link" to={`/assets/${row.asset_id}`}>Asset record</Link>
                <select
                  aria-label={`Update status for ${row.defect_code}`}
                  value={row.status}
                  disabled={busy === row.id}
                  onChange={e => changeStatus(row, e.target.value as OrionDefectStatus)}
                >
                  {statusOrder.map(status => <option key={status} value={status}>{label(status)}</option>)}
                </select>
              </div>

              {(row.resolved_at || row.verified_at) && (
                <small>
                  {row.resolved_at ? `Resolved ${new Date(row.resolved_at).toLocaleString()}` : ""}
                  {row.verified_at ? ` · Verified ${new Date(row.verified_at).toLocaleString()}` : ""}
                </small>
              )}
            </section>
          ))}
        </div>
      )}
    </Page>
  );
}
