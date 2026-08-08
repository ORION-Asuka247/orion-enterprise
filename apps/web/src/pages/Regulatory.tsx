import { useEffect, useMemo, useState } from "react";
import Page from "../components/Page";
import { supabase } from "../lib/supabase";

type Source = {
  id: string;
  code: string;
  name: string;
  organisation: string | null;
  trust_tier: string;
  is_enabled: boolean;
  last_checked_at: string | null;
  last_success_at: string | null;
  last_error: string | null;
};

type Change = {
  id: string;
  change_type: string;
  status: string;
  detected_at: string;
  significance_score: number | null;
  detected_summary: string | null;
  regulatory_documents: { title: string; organisation: string | null } | null;
};

export default function Regulatory() {
  const [sources, setSources] = useState<Source[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      if (!supabase) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError("");
      const [sourceResult, changeResult] = await Promise.all([
        supabase
          .from("regulatory_sources")
          .select("id,code,name,organisation,trust_tier,is_enabled,last_checked_at,last_success_at,last_error")
          .order("name"),
        supabase
          .from("regulatory_changes")
          .select("id,change_type,status,detected_at,significance_score,detected_summary,regulatory_documents(title,organisation)")
          .order("detected_at", { ascending: false })
          .limit(50)
      ]);
      if (sourceResult.error) setError(sourceResult.error.message);
      else if (changeResult.error) setError(changeResult.error.message);
      setSources((sourceResult.data ?? []) as Source[]);
      setChanges((changeResult.data ?? []) as unknown as Change[]);
      setLoading(false);
    }
    load();
  }, []);

  const metrics = useMemo(() => ({
    enabled: sources.filter(s => s.is_enabled).length,
    healthy: sources.filter(s => s.is_enabled && s.last_success_at && !s.last_error).length,
    review: changes.filter(c => c.status === "awaiting_review" || c.status === "detected").length,
    high: changes.filter(c => (c.significance_score ?? 0) >= 70).length
  }), [sources, changes]);

  return (
    <Page title="Regulatory intelligence" kicker="LIVE COMPLIANCE">
      <div className="inspection-progress panel">
        <div><span>Enabled sources</span><strong>{metrics.enabled}</strong></div>
        <div><span>Healthy sources</span><strong>{metrics.healthy}</strong></div>
        <div><span>Awaiting review</span><strong>{metrics.review}</strong></div>
        <div><span>High significance</span><strong>{metrics.high}</strong></div>
      </div>

      {error && <div className="warning">{error}</div>}
      {loading && <div className="panel">Loading regulatory intelligence...</div>}

      {!loading && (
        <div className="grid two">
          <section className="panel">
            <div className="eyebrow">OFFICIAL SOURCE REGISTER</div>
            <h2>Monitored sources</h2>
            {sources.length === 0 ? (
              <p className="muted">No regulatory sources have been commissioned yet. The engine is ready for approved source configuration.</p>
            ) : (
              <ul className="clean">
                {sources.map(source => (
                  <li key={source.id}>
                    <b>{source.is_enabled ? "Live" : "Off"}</b>
                    <span>
                      <strong>{source.name}</strong><br />
                      <small>{source.organisation || source.code} · {source.trust_tier.replace(/_/g, " ")}</small>
                      {source.last_error && <><br /><small>Last error: {source.last_error}</small></>}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="panel">
            <div className="eyebrow">CHANGE CONTROL</div>
            <h2>Detected regulatory changes</h2>
            {changes.length === 0 ? (
              <p className="muted">No regulatory changes have been recorded. Changes will appear here once approved source monitoring is active.</p>
            ) : (
              <div className="inspection-question-list">
                {changes.slice(0, 12).map(change => (
                  <article className="inspection-question" key={change.id}>
                    <div className="inspection-question-header">
                      <div>
                        <div className="eyebrow">{change.change_type.replace(/_/g, " ")}</div>
                        <h3>{change.regulatory_documents?.title || "Regulatory change"}</h3>
                        <p>{change.detected_summary || "Change detected and awaiting controlled review."}</p>
                        <small>{new Date(change.detected_at).toLocaleString()} · {change.regulatory_documents?.organisation || "Official source"}</small>
                      </div>
                      <span className="inspection-result result-na">{change.significance_score == null ? "—" : `${change.significance_score}%`}</span>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </Page>
  );
}
