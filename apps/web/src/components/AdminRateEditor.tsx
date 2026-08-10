import { useMemo, useState } from "react";
import {
  saveActionRate,
  saveRateProfile,
  type ActionRate,
  type ClientRateProfile,
  type LabourRateProfile,
  type PricingConfig
} from "../lib/pricing";

function money(value: number) {
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(value);
}

function optionalNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export default function AdminRateEditor({
  companyId,
  config,
  onSaved
}: {
  companyId: string;
  config: PricingConfig;
  onSaved(config: PricingConfig): void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const profiles = useMemo(
    () => (["standard", "account_package"] as ClientRateProfile[])
      .map(code => config.profiles[code])
      .filter(Boolean) as LabourRateProfile[],
    [config]
  );

  async function updateProfile(code: ClientRateProfile, field: keyof LabourRateProfile, raw: string) {
    const current = config.profiles[code];
    if (!current) return;
    const next: LabourRateProfile = {
      ...current,
      [field]: ["hourlyRate", "minimumCharge", "billingIncrementMinutes"].includes(field)
        ? Number(raw)
        : raw
    } as LabourRateProfile;
    onSaved({ ...config, profiles: { ...config.profiles, [code]: next } });
  }

  async function persistProfile(profile: LabourRateProfile) {
    setBusy(`profile:${profile.code}`);
    setError("");
    setMessage("");
    try {
      await saveRateProfile(companyId, profile);
      setMessage(`${profile.label} saved.`);
    } catch (e: any) {
      setError(e?.message || "Unable to save rate profile.");
    } finally {
      setBusy("");
    }
  }

  function updateAction(actionCode: string, field: keyof ActionRate, raw: string) {
    const current = config.actions[actionCode];
    if (!current) return;
    const next: ActionRate = {
      ...current,
      [field]: field === "labourMinutes" || field === "materialsCost" ? optionalNumber(raw) : raw
    };
    onSaved({ ...config, actions: { ...config.actions, [actionCode]: next } });
  }

  async function persistAction(rate: ActionRate) {
    setBusy(`action:${rate.actionCode}`);
    setError("");
    setMessage("");
    try {
      await saveActionRate(companyId, rate);
      setMessage(`${rate.actionCode} allowance saved.`);
    } catch (e: any) {
      setError(e?.message || "Unable to save action allowance.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="panel" style={{ marginTop: 18 }}>
      <div className="page-toolbar">
        <div>
          <div className="eyebrow">COMPANY ADMINISTRATOR ONLY</div>
          <h3>ASUKA247 rate editor</h3>
          <p className="muted">
            Amend normal and account-holder labour profiles together with internal labour and material allowances.
            Blank action allowances remain deliberately unpriced and require commercial review.
          </p>
        </div>
        <button type="button" className="secondary" onClick={() => setOpen(v => !v)}>
          {open ? "Close rate editor" : "Edit rate card"}
        </button>
      </div>

      {message && <div className="evidence-confirmed">{message}</div>}
      {error && <div className="warning">{error}</div>}

      {open && (
        <>
          <h3 style={{ marginTop: 18 }}>Client labour profiles</h3>
          <div className="inspection-question-list">
            {profiles.map(profile => (
              <section className="panel inspection-question" key={profile.code}>
                <div className="inspection-question-header">
                  <div>
                    <div className="eyebrow">{profile.code.toUpperCase()}</div>
                    <h3>{profile.label}</h3>
                  </div>
                  <strong>{money(Number(profile.hourlyRate))}/hr</strong>
                </div>
                <div className="inspection-progress">
                  <label className="inspection-field">
                    Hourly rate (£)
                    <input type="number" min="0" step="0.01" value={profile.hourlyRate}
                      onChange={e => updateProfile(profile.code, "hourlyRate", e.target.value)} />
                  </label>
                  <label className="inspection-field">
                    Minimum labour (£)
                    <input type="number" min="0" step="0.01" value={profile.minimumCharge}
                      onChange={e => updateProfile(profile.code, "minimumCharge", e.target.value)} />
                  </label>
                  <label className="inspection-field">
                    Billing increment (minutes)
                    <input type="number" min="1" step="1" value={profile.billingIncrementMinutes}
                      onChange={e => updateProfile(profile.code, "billingIncrementMinutes", e.target.value)} />
                  </label>
                </div>
                <label className="inspection-field">
                  Internal note
                  <textarea value={profile.internalNote || ""}
                    onChange={e => updateProfile(profile.code, "internalNote", e.target.value)} />
                </label>
                <div className="inspection-actions">
                  <button type="button" disabled={busy === `profile:${profile.code}`} onClick={() => persistProfile(profile)}>
                    {busy === `profile:${profile.code}` ? "Saving..." : "Save profile"}
                  </button>
                </div>
              </section>
            ))}
          </div>

          <h3 style={{ marginTop: 22 }}>Remedial action allowances</h3>
          <p className="muted">These values are internal only. Materials represent the ASUKA commercial allowance used by the pricing engine, not information shown to engineers or clients.</p>
          <div className="inspection-question-list">
            {Object.values(config.actions).sort((a, b) => a.actionCode.localeCompare(b.actionCode)).map(rate => (
              <section className="panel inspection-question" key={rate.actionCode}>
                <div className="inspection-question-header">
                  <div>
                    <div className="eyebrow">REMEDIAL ACTION</div>
                    <h3>{rate.actionCode.replace(/_/g, " ")}</h3>
                  </div>
                  <span className={`inspection-result result-${rate.labourMinutes == null || rate.materialsCost == null ? "na" : "pass"}`}>
                    {rate.labourMinutes == null || rate.materialsCost == null ? "PRICE REVIEW" : "APPROVED RATE"}
                  </span>
                </div>
                <div className="inspection-progress">
                  <label className="inspection-field">
                    Labour allowance (minutes)
                    <input type="number" min="0" step="1" value={rate.labourMinutes ?? ""}
                      placeholder="Leave blank for review"
                      onChange={e => updateAction(rate.actionCode, "labourMinutes", e.target.value)} />
                  </label>
                  <label className="inspection-field">
                    Materials allowance (£)
                    <input type="number" min="0" step="0.01" value={rate.materialsCost ?? ""}
                      placeholder="Leave blank for review"
                      onChange={e => updateAction(rate.actionCode, "materialsCost", e.target.value)} />
                  </label>
                </div>
                <label className="inspection-field">
                  Internal note
                  <textarea value={rate.internalNote || ""}
                    onChange={e => updateAction(rate.actionCode, "internalNote", e.target.value)} />
                </label>
                <div className="inspection-actions">
                  <button type="button" disabled={busy === `action:${rate.actionCode}`} onClick={() => persistAction(rate)}>
                    {busy === `action:${rate.actionCode}` ? "Saving..." : "Save allowance"}
                  </button>
                </div>
              </section>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
