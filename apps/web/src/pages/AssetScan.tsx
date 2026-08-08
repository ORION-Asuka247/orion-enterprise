import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Page from "../components/Page";
import QrScanner from "../components/QrScanner";
import { resolveAssetIdentifier } from "../lib/assets";
import { useTenant } from "../lib/tenant";

export default function AssetScan() {
  const { activeTenant } = useTenant();
  const navigate = useNavigate();

  const [identifier, setIdentifier] = useState("");
  const [mode, setMode] = useState<"camera" | "manual">("camera");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function resolve(value: string) {
    if (!activeTenant) return;

    setBusy(true);
    setError("");

    try {
      const id = await resolveAssetIdentifier(activeTenant.id, value);

      if (!id) {
        setError("No matching asset was found. Check the asset code or use the Asset Register search.");
        setMode("manual");
        return;
      }

      navigate(`/assets/${id}`);
    } catch (e: any) {
      setError(e?.message || "Unable to resolve this asset.");
      setMode("manual");
    } finally {
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (identifier.trim()) resolve(identifier);
  }

  return (
    <Page title="Scan / find asset" kicker="FIELD ACCESS">
      <div className="page-toolbar">
        <p className="muted">
          Scan an ORION QR code with the device camera or enter the asset code manually.
        </p>
        <Link className="button-link secondary-link" to="/assets">Asset register</Link>
      </div>

      <div className="scan-layout">
        <section className="panel">
          <div className="mode-switch">
            <button
              type="button"
              className={mode === "camera" ? "" : "secondary"}
              onClick={() => setMode("camera")}
            >
              Camera scan
            </button>
            <button
              type="button"
              className={mode === "manual" ? "" : "secondary"}
              onClick={() => setMode("manual")}
            >
              Manual lookup
            </button>
          </div>

          {mode === "camera" && (
            <QrScanner
              onDetected={resolve}
              onCancel={() => setMode("manual")}
            />
          )}

          {mode === "manual" && (
            <form className="manual-lookup" onSubmit={submit}>
              <label>
                Asset code, serial number or QR value
                <input
                  autoFocus
                  value={identifier}
                  onChange={e => setIdentifier(e.target.value)}
                  placeholder="e.g. FD-001"
                />
              </label>
              <button disabled={busy || !identifier.trim()}>
                {busy ? "Finding..." : "Open asset"}
              </button>
            </form>
          )}

          {error && <div className="warning scan-warning">{error}</div>}
        </section>

        <aside className="panel scan-guidance">
          <h2>Field workflow</h2>
          <ol>
            <li>Scan the label or enter the asset code.</li>
            <li>ORION opens the permanent asset record.</li>
            <li>Review location, status and previous history.</li>
            <li>Start the applicable inspection workflow.</li>
          </ol>
          <p>QR scanning is optional. Manual asset lookup always remains available.</p>
        </aside>
      </div>
    </Page>
  );
}
