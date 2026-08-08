import { FormEvent, useEffect, useMemo, useState } from "react";
import Page from "../components/Page";
import { useTenant } from "../lib/tenant";
import { loadPropertyHierarchy, type PropertyHierarchy } from "../lib/setup";
import {
  createAsset,
  loadAssets,
  loadAssetTypes,
  type AssetRow,
  type AssetType
} from "../lib/assets";

export default function Assets() {
  const { activeTenant } = useTenant();

  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [types, setTypes] = useState<AssetType[]>([]);
  const [properties, setProperties] = useState<PropertyHierarchy[]>([]);
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const [propertyId, setPropertyId] = useState("");
  const [blockId, setBlockId] = useState("");
  const [floorId, setFloorId] = useState("");
  const [assetTypeId, setAssetTypeId] = useState("");
  const [assetCode, setAssetCode] = useState("");
  const [assetName, setAssetName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [model, setModel] = useState("");
  const [serial, setSerial] = useState("");
  const [installDate, setInstallDate] = useState("");
  const [condition, setCondition] = useState("unknown");

  async function refresh(q = search) {
    if (!activeTenant) return;

    setError("");
    try {
      const [a, t, p] = await Promise.all([
        loadAssets(activeTenant.id, q),
        loadAssetTypes(activeTenant.id),
        loadPropertyHierarchy(activeTenant.id)
      ]);

      setAssets(a);
      setTypes(t);
      setProperties(p);
    } catch (e: any) {
      setError(e?.message ?? "Unable to load asset register.");
    }
  }

  useEffect(() => {
    refresh("");
  }, [activeTenant]);

  const selectedProperty = useMemo(
    () => properties.find(p => p.id === propertyId) ?? null,
    [properties, propertyId]
  );

  const selectedBlock = useMemo(
    () => selectedProperty?.blocks.find(b => b.id === blockId) ?? null,
    [selectedProperty, blockId]
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!activeTenant) return;

    setBusy(true);
    setError("");

    try {
      await createAsset({
        companyId: activeTenant.id,
        propertyId,
        blockId: blockId || undefined,
        floorId: floorId || undefined,
        assetTypeId,
        assetCode,
        name: assetName,
        manufacturer,
        model,
        serialNumber: serial,
        installDate: installDate || undefined,
        condition
      });

      setAssetCode("");
      setAssetName("");
      setManufacturer("");
      setModel("");
      setSerial("");
      setInstallDate("");
      setCondition("unknown");
      setShowCreate(false);

      await refresh("");
    } catch (e: any) {
      setError(e?.message ?? "Unable to register asset.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Asset register" kicker="QR + MANUAL ACCESS">
      <div className="page-toolbar">
        <div>
          <p className="muted">
            Every ORION asset receives a permanent code and QR identity while retaining manual lookup as a fallback.
          </p>
        </div>

        <button onClick={() => setShowCreate(v => !v)}>
          {showCreate ? "Close" : "Register asset"}
        </button>
      </div>

      {error && <div className="warning">{error}</div>}

      {showCreate && (
        <form className="panel setup-form asset-create" onSubmit={submit}>
          <h2>Register asset</h2>

          <div className="form-grid">
            <label>
              Asset type
              <select value={assetTypeId} onChange={e => setAssetTypeId(e.target.value)} required>
                <option value="">Select type</option>
                {types.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>

            <label>
              Asset code
              <input
                value={assetCode}
                onChange={e => setAssetCode(e.target.value)}
                placeholder="e.g. FD-001"
                required
              />
            </label>

            <label className="full">
              Description / asset name
              <input
                value={assetName}
                onChange={e => setAssetName(e.target.value)}
                placeholder="e.g. Flat 68 entrance fire door"
              />
            </label>

            <label className="full">
              Property
              <select
                value={propertyId}
                onChange={e => {
                  setPropertyId(e.target.value);
                  setBlockId("");
                  setFloorId("");
                }}
                required
              >
                <option value="">Select property</option>
                {properties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>

            <label>
              Block
              <select
                value={blockId}
                onChange={e => {
                  setBlockId(e.target.value);
                  setFloorId("");
                }}
              >
                <option value="">Not specified</option>
                {selectedProperty?.blocks.map(b => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
            </label>

            <label>
              Floor
              <select value={floorId} onChange={e => setFloorId(e.target.value)}>
                <option value="">Not specified</option>
                {selectedBlock?.floors.map(f => (
                  <option key={f.id} value={f.id}>{f.name}</option>
                ))}
              </select>
            </label>

            <label>
              Manufacturer
              <input value={manufacturer} onChange={e => setManufacturer(e.target.value)} />
            </label>

            <label>
              Model
              <input value={model} onChange={e => setModel(e.target.value)} />
            </label>

            <label>
              Serial number
              <input value={serial} onChange={e => setSerial(e.target.value)} />
            </label>

            <label>
              Installation date
              <input
                type="date"
                value={installDate}
                onChange={e => setInstallDate(e.target.value)}
              />
            </label>

            <label>
              Condition
              <select value={condition} onChange={e => setCondition(e.target.value)}>
                <option value="unknown">Unknown</option>
                <option value="good">Good</option>
                <option value="serviceable">Serviceable</option>
                <option value="attention_required">Attention required</option>
                <option value="poor">Poor</option>
              </select>
            </label>
          </div>

          <div className="setup-actions">
            <button disabled={busy}>
              {busy ? "Registering…" : "Register asset"}
            </button>
          </div>
        </form>
      )}

      <div className="asset-search panel">
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search asset code, name, serial number or manufacturer"
          onKeyDown={e => {
            if (e.key === "Enter") refresh(search);
          }}
        />
        <button onClick={() => refresh(search)}>Search</button>
        <button
          className="secondary"
          onClick={() => {
            setSearch("");
            refresh("");
          }}
        >
          Clear
        </button>
      </div>

      <div className="asset-table panel">
        <div className="asset-row asset-head">
          <span>Asset</span>
          <span>Type</span>
          <span>Location</span>
          <span>Status</span>
          <span>QR ID</span>
        </div>

        {assets.length === 0 && (
          <div className="empty-inline">No assets registered.</div>
        )}

        {assets.map(asset => (
          <div className="asset-row" key={asset.id}>
            <span>
              <strong>{asset.asset_code}</strong>
              <small>{asset.name || [asset.manufacturer, asset.model].filter(Boolean).join(" ")}</small>
            </span>

            <span>{asset.asset_types?.name || "Unclassified"}</span>

            <span>
              {[asset.properties?.name, asset.blocks?.name, asset.floors?.name]
                .filter(Boolean)
                .join(" · ") || "—"}
            </span>

            <span>{asset.status}</span>

            <span>
              <code>{asset.qr_token ? asset.qr_token.slice(0, 8) : "—"}</code>
            </span>
          </div>
        ))}
      </div>
    </Page>
  );
}
