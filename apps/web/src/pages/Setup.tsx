import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Page from "../components/Page";
import { useTenant } from "../lib/tenant";
import { createBuildingSetup } from "../lib/setup";

export default function Setup() {
  const { activeTenant } = useTenant();
  const navigate = useNavigate();

  const [propertyName, setPropertyName] = useState("");
  const [referenceCode, setReferenceCode] = useState("");
  const [address1, setAddress1] = useState("");
  const [address2, setAddress2] = useState("");
  const [town, setTown] = useState("");
  const [county, setCounty] = useState("");
  const [postcode, setPostcode] = useState("");
  const [blockText, setBlockText] = useState("Main Building");
  const [floorsAbove, setFloorsAbove] = useState(0);
  const [basements, setBasements] = useState(0);
  const [createLobby, setCreateLobby] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const blockNames = useMemo(
    () => blockText.split(",").map(v => v.trim()).filter(Boolean),
    [blockText]
  );

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!activeTenant) return;

    setBusy(true);
    setError("");

    try {
      await createBuildingSetup({
        companyId: activeTenant.id,
        property: {
          name: propertyName,
          reference_code: referenceCode,
          address_line1: address1,
          address_line2: address2,
          town_city: town,
          county,
          postcode,
          country_code: "GB"
        },
        blockNames,
        floorsAbove,
        basementLevels: basements,
        createLobby
      });

      navigate("/properties?created=1");
    } catch (err: any) {
      setError(err?.message ?? "Unable to create the building.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Page title="Building setup wizard" kicker="FIRST-RUN COMMISSIONING">
      <form className="setup-form" onSubmit={submit}>
        <section className="panel setup-section">
          <div className="step-badge">1</div>
          <div>
            <h2>Property</h2>
            <p>Enter the primary building details. These become the permanent property record.</p>
          </div>

          <div className="form-grid">
            <label className="full">
              Property name
              <input
                value={propertyName}
                onChange={e => setPropertyName(e.target.value)}
                placeholder="e.g. 30 Bath Road"
                required
              />
            </label>

            <label>
              Reference code
              <input
                value={referenceCode}
                onChange={e => setReferenceCode(e.target.value)}
                placeholder="e.g. 30BR"
              />
            </label>

            <label>
              Postcode
              <input
                value={postcode}
                onChange={e => setPostcode(e.target.value)}
                placeholder="e.g. SL1 3SS"
              />
            </label>

            <label className="full">
              Address line 1
              <input value={address1} onChange={e => setAddress1(e.target.value)} />
            </label>

            <label className="full">
              Address line 2
              <input value={address2} onChange={e => setAddress2(e.target.value)} />
            </label>

            <label>
              Town / City
              <input value={town} onChange={e => setTown(e.target.value)} />
            </label>

            <label>
              County
              <input value={county} onChange={e => setCounty(e.target.value)} />
            </label>
          </div>
        </section>

        <section className="panel setup-section">
          <div className="step-badge">2</div>
          <div>
            <h2>Blocks</h2>
            <p>For multiple blocks, separate their names with commas.</p>
          </div>

          <label>
            Block names
            <input
              value={blockText}
              onChange={e => setBlockText(e.target.value)}
              placeholder="Block A, Block B"
              required
            />
          </label>

          <div className="hint">
            ORION will create {blockNames.length || 0} block{blockNames.length === 1 ? "" : "s"}.
          </div>
        </section>

        <section className="panel setup-section">
          <div className="step-badge">3</div>
          <div>
            <h2>Floor structure</h2>
            <p>Ground Floor is created automatically for every block.</p>
          </div>

          <div className="form-grid">
            <label>
              Floors above ground
              <input
                type="number"
                min="0"
                max="100"
                value={floorsAbove}
                onChange={e => setFloorsAbove(Number(e.target.value))}
              />
            </label>

            <label>
              Basement levels
              <input
                type="number"
                min="0"
                max="20"
                value={basements}
                onChange={e => setBasements(Number(e.target.value))}
              />
            </label>
          </div>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={createLobby}
              onChange={e => setCreateLobby(e.target.checked)}
            />
            Create a communal Lobby area on each Ground Floor
          </label>
        </section>

        {error && <div className="warning">{error}</div>}

        <div className="setup-actions">
          <button type="button" className="secondary" onClick={() => navigate("/")}>
            Cancel
          </button>
          <button disabled={busy || !activeTenant}>
            {busy ? "Creating building…" : "Create building"}
          </button>
        </div>
      </form>
    </Page>
  );
}
