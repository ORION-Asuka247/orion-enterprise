import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Link, useParams } from "react-router-dom";
import Page from "../components/Page";
import { useTenant } from "../lib/tenant";
import {
  loadAssetDetail,
  loadAssetHistory,
  type AssetDefectHistory,
  type AssetDetailRecord,
  type AssetInspectionHistory,
  type AssetStatusHistory
} from "../lib/assets";

type TimelineItem = {
  key: string;
  date: string;
  category: string;
  title: string;
  detail: string;
  state?: string;
};

function displayDate(value: string | null | undefined) {
  if (!value) return "-";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? value : d.toLocaleString();
}

export default function AssetDetail() {
  const { assetId } = useParams();
  const { activeTenant } = useTenant();

  const [asset, setAsset] = useState<AssetDetailRecord | null>(null);
  const [inspections, setInspections] = useState<AssetInspectionHistory[]>([]);
  const [defects, setDefects] = useState<AssetDefectHistory[]>([]);
  const [statusHistory, setStatusHistory] = useState<AssetStatusHistory[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!activeTenant || !assetId) return;

      setLoading(true);
      setError("");

      try {
        const [record, history] = await Promise.all([
          loadAssetDetail(activeTenant.id, assetId),
          loadAssetHistory(activeTenant.id, assetId)
        ]);

        setAsset(record);
        setInspections(history.inspections);
        setDefects(history.defects);
        setStatusHistory(history.statusHistory);
      } catch (e: any) {
        setError(e?.message ?? "Unable to load asset.");
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [activeTenant, assetId]);

  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    inspections.forEach(i => items.push({
      key: `inspection-${i.id}`,
      date: i.submitted_at || i.started_at || i.created_at,
      category: "Inspection",
      title: `Inspection ${i.outcome}`,
      detail: `Status: ${i.status}`,
      state: i.outcome
    }));

    defects.forEach(d => items.push({
      key: `defect-${d.id}`,
      date: d.created_at,
      category: "Defect",
      title: d.title,
      detail: `${d.severity} severity - ${d.status}`,
      state: d.status
    }));

    statusHistory.forEach(s => items.push({
      key: `status-${s.id}`,
      date: s.changed_at,
      category: "Lifecycle",
      title: `${s.from_status || "new"} -> ${s.to_status}`,
      detail: s.reason || "Asset status changed",
      state: s.to_status
    }));

    return items.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [inspections, defects, statusHistory]);

  if (loading) return <Page title="Asset detail" kicker="ASSET IDENTITY"><div className="panel">Loading asset...</div></Page>;

  if (error || !asset) {
    return (
      <Page title="Asset detail" kicker="ASSET IDENTITY">
        <div className="warning">{error || "Asset not found or access is not permitted."}</div>
        <p><Link to="/assets">Return to Asset Register</Link></p>
      </Page>
    );
  }

  const qrUrl = `${window.location.origin}/q/${asset.qr_token}`;
  const location = [
    asset.properties?.name,
    asset.blocks?.name,
    asset.floors?.name,
    asset.areas?.name
  ].filter(Boolean).join(" - ");

  return (
    <Page title={asset.asset_code} kicker="PERMANENT ASSET RECORD">
      <div className="page-toolbar">
        <div>
          <p className="muted">{asset.name || asset.asset_types?.name || "ORION asset"}</p>
        </div>
        <div className="toolbar-actions">
          <Link className="button-link secondary-link" to="/assets">Asset register</Link>
          <Link className="button-link secondary-link" to="/assets/scan">Scan another</Link>
        </div>
      </div>

      <div className="asset-detail-grid">
        <section className="panel asset-identity">
          <div className="asset-title-row">
            <div>
              <div className="eyebrow">{asset.asset_types?.name || "ASSET"}</div>
              <h2>{asset.asset_code}</h2>
              <p>{asset.name || "No description recorded"}</p>
            </div>
            <span className={`status-badge status-${asset.status}`}>{asset.status}</span>
          </div>

          <dl className="detail-list">
            <div><dt>Location</dt><dd>{location || "-"}</dd></div>
            <div><dt>Condition</dt><dd>{asset.condition || "unknown"}</dd></div>
            <div><dt>Manufacturer</dt><dd>{asset.manufacturer || "-"}</dd></div>
            <div><dt>Model</dt><dd>{asset.model || "-"}</dd></div>
            <div><dt>Serial number</dt><dd>{asset.serial_number || "-"}</dd></div>
            <div><dt>Installation date</dt><dd>{asset.install_date || "-"}</dd></div>
            <div><dt>Created</dt><dd>{displayDate(asset.created_at)}</dd></div>
            <div><dt>Last updated</dt><dd>{displayDate(asset.updated_at)}</dd></div>
          </dl>

          {asset.notes && <div className="asset-notes"><strong>Notes</strong><p>{asset.notes}</p></div>}
        </section>

        <aside className="panel qr-card">
          <div className="eyebrow">ORION QR IDENTITY</div>
          <div className="qr-code-wrap">
            <QRCodeSVG
              value={qrUrl}
              size={220}
              level="M"
              bgColor="#ffffff"
              fgColor="#000000"
              title={`ORION ${asset.asset_code}`}
            />
          </div>
          <strong>{asset.asset_code}</strong>
          <small>{asset.qr_token}</small>
          <p>Scanning this code opens the authenticated ORION record for this asset.</p>
          <button type="button" onClick={() => window.print()}>Print QR label</button>
        </aside>
      </div>

      <div className="metrics asset-history-metrics">
        <div className="metric"><span>Inspections</span><strong>{inspections.length}</strong><small>Recorded history</small></div>
        <div className="metric"><span>Defects</span><strong>{defects.length}</strong><small>All linked defects</small></div>
        <div className="metric"><span>Open defects</span><strong>{defects.filter(d => d.status !== "resolved" && d.status !== "closed").length}</strong><small>Requires attention</small></div>
        <div className="metric"><span>Lifecycle events</span><strong>{statusHistory.length}</strong><small>Status history</small></div>
      </div>

      <section className="panel">
        <div className="section-heading">
          <div>
            <div className="eyebrow">AUDITABLE HISTORY</div>
            <h2>Asset timeline</h2>
          </div>
        </div>

        {timeline.length === 0 ? (
          <div className="empty-inline">No inspections, defects or lifecycle events recorded yet.</div>
        ) : (
          <div className="asset-timeline">
            {timeline.map(item => (
              <article className="timeline-item" key={item.key}>
                <div className="timeline-dot" />
                <div>
                  <div className="timeline-meta">
                    <span>{item.category}</span>
                    <time>{displayDate(item.date)}</time>
                  </div>
                  <strong>{item.title}</strong>
                  <p>{item.detail}</p>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="print-only asset-label-print">
        <QRCodeSVG value={qrUrl} size={280} level="M" bgColor="#ffffff" fgColor="#000000" />
        <h1>ORION ENTERPRISE</h1>
        <h2>{asset.asset_code}</h2>
        <p>{asset.asset_types?.name}</p>
        <p>{location}</p>
      </div>
    </Page>
  );
}
