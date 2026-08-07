import { useEffect, useMemo, useState } from "react";
import { QrScanner } from "../modules/engineer/QrScanner";
import { findAssetByQrToken, searchAssetsManually } from "../modules/assets/assetService";
import { flushSyncQueue, queueCount } from "../modules/offline/syncQueue";
import type { AssetSummary } from "../modules/assets/types";

export default function App() {
  const [online, setOnline] = useState(navigator.onLine);
  const [queue, setQueue] = useState(0);
  const [mode, setMode] = useState<"home" | "scan" | "manual">("home");
  const [manual, setManual] = useState("");
  const [results, setResults] = useState<AssetSummary[]>([]);
  const [selected, setSelected] = useState<AssetSummary | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const refresh = async () => setQueue(await queueCount());
    refresh();

    const up = async () => {
      setOnline(true);
      const result = await flushSyncQueue();
      setQueue(result.remaining);
    };
    const down = () => setOnline(false);

    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
    };
  }, []);

  const scanDetected = async (raw: string) => {
    try {
      const token = raw.includes("/") ? raw.split("/").filter(Boolean).pop()! : raw;
      const asset = await findAssetByQrToken(token);
      if (!asset) {
        setMessage("Asset not found. Use manual search.");
        setMode("manual");
        return;
      }
      setSelected(asset);
      setMode("home");
      setMessage("");
    } catch (e: any) {
      setMessage(e?.message ?? "Unable to read asset.");
      setMode("manual");
    }
  };

  const search = async () => {
    setResults(await searchAssetsManually(manual));
  };

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <div className="eyebrow">ORION ENTERPRISE</div>
          <h1>Engineer</h1>
        </div>
        <div className={`status ${online ? "online" : "offline"}`}>
          {online ? "Online" : "Offline"}
          {queue > 0 && ` · ${queue} pending`}
        </div>
      </header>

      {message && <div className="warning">{message}</div>}

      {mode === "scan" && (
        <section className="panel">
          <h2>Scan asset QR code</h2>
          <QrScanner onDetected={scanDetected} onCancel={() => setMode("manual")} />
        </section>
      )}

      {mode === "manual" && (
        <section className="panel">
          <h2>Find asset manually</h2>
          <p className="muted">Search by asset code, asset name or property.</p>
          <div className="search-row">
            <input
              value={manual}
              onChange={(e) => setManual(e.target.value)}
              placeholder="e.g. 30BR-A-F03-FD-004"
            />
            <button onClick={search}>Search</button>
          </div>
          <div className="results">
            {results.map((asset) => (
              <button
                className="result"
                key={asset.id}
                onClick={() => {
                  setSelected(asset);
                  setMode("home");
                }}
              >
                <strong>{asset.asset_code}</strong>
                <span>{asset.name ?? "Asset"}</span>
                <span>
                  {[asset.property_name, asset.block_name, asset.floor_name, asset.area_name]
                    .filter(Boolean)
                    .join(" · ")}
                </span>
              </button>
            ))}
          </div>
          <button className="secondary full" onClick={() => setMode("home")}>Back</button>
        </section>
      )}

      {mode === "home" && (
        <>
          <section className="hero-card">
            <div className="eyebrow">FIELD WORKFLOW</div>
            <h2>Identify the asset</h2>
            <p>
              Scan the QR code or find the asset manually. Both routes open the same controlled asset record.
            </p>
            <div className="actions">
              <button onClick={() => setMode("scan")}>Scan QR</button>
              <button className="secondary" onClick={() => setMode("manual")}>Manual search</button>
            </div>
          </section>

          {selected && (
            <section className="panel asset-card">
              <div className="eyebrow">SELECTED ASSET</div>
              <h2>{selected.asset_code}</h2>
              <div>{selected.name ?? "Asset"}</div>
              <div className="muted">
                {[selected.property_name, selected.block_name, selected.floor_name, selected.area_name]
                  .filter(Boolean)
                  .join(" · ")}
              </div>
              <div className="actions">
                <button
                  onClick={() =>
                    setMessage(
                      "Asset selected. Connect this screen to the assigned inspection route when Phase 3 is integrated into the main ORION shell."
                    )
                  }
                >
                  Continue to inspection
                </button>
              </div>
            </section>
          )}

          <section className="panel">
            <h2>Field safeguards</h2>
            <ul>
              <li>Manual asset lookup is always available.</li>
              <li>Draft answers and evidence can be held offline.</li>
              <li>Queued changes synchronise when connectivity returns.</li>
              <li>Failed rule evaluations generate traceable defects.</li>
              <li>Required evidence is validated before submission.</li>
            </ul>
          </section>
        </>
      )}
    </main>
  );
}
